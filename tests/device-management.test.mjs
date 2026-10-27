import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

// 无浏览器、无个人库副作用；Exercise production modules with a native API test double.
const nativeRequire = createRequire(import.meta.url);
const platform = { isMobileApp: false, isTablet: false };
const notices = [];
class NativeBase {}
const obsidian = { Platform: platform, Plugin: NativeBase, Modal: NativeBase, SuggestModal: NativeBase, PluginSettingTab: NativeBase,
    Notice: class { constructor(message) { notices.push(message); } } };
async function load(entry) {
    const result = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs',
        write: false, external: ['obsidian', 'electron'], logLevel: 'silent' });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', 'crypto', result.outputFiles[0].text)(name => {
        if (name === 'obsidian') return obsidian;
        if (name === 'electron') return {};
        return nativeRequire(name);
    }, module, module.exports, { randomUUID });
    return module.exports;
}
const model = await load('src/devices/device-presets.ts');
const { DeviceManager } = await load('src/devices/device-manager.ts');
const { default: Manager } = await load('src/main.ts');
const { DEFAULT_SETTINGS } = await load('src/settings/data.ts');
const record = (id, enabled, tags = []) => ({ id, name: id, desc: '', group: '', tags, enabled, delay: '', note: '' });
const ribbon = { bpmUniqueId: 'a', name: 'A', icon: 'star', visible: true, order: 0, ribbonIdMap: { en: 'a' } };
async function fixture() {
    platform.isMobileApp = false;
    platform.isTablet = false;
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.Plugins = [record('self', true), record('a', true), record('b', false), record('ignored', true, ['bpm-ignore'])];
    settings.RIBBON_SETTINGS = [structuredClone(ribbon)];
    const calls = [];
    let local;
    const manager = new Manager();
    manager.settings = settings;
    manager.manifest = { id: 'self' };
    manager.translator = { t: (key, vars) => `${key}${vars?.names || ''}` };
    manager.app = { loadLocalStorage: () => local, saveLocalStorage: (_key, value) => { local = value; } };
    manager.appPlugins = {
        manifests: Object.fromEntries(settings.Plugins.map(plugin => [plugin.id, { id: plugin.id, name: plugin.name }])),
        enabledPlugins: new Set(['self', 'a', 'ignored']),
        plugins: { self: {}, a: {}, ignored: {} },
        async enablePluginAndSave(id) { calls.push(['enable', id]); this.enabledPlugins.add(id); this.plugins[id] = {}; },
        async disablePluginAndSave(id) { calls.push(['disable', id]); this.enabledPlugins.delete(id); delete this.plugins[id]; },
    };
    manager.saveData = async () => { calls.push(['save']); };
    manager.refreshRibbonManagerFeature = async () => { calls.push(['ribbon']); };
    manager.devices = new DeviceManager(manager);
    await manager.devices.initialize();
    return { manager, settings, calls };
}

test('exactly three independent presets migrate without changing the current configuration', async () => {
    const { settings } = await fixture();
    const data = settings.DEVICE_MANAGEMENT;
    assert.equal(data.enabled, false);
    assert.deepEqual(Object.keys(data.presets), ['computer', 'tablet', 'phone']);
    data.presets.tablet.plugins.a.enabled = false;
    data.presets.tablet.ribbon[0].ribbonIdMap.en = 'changed';
    assert.equal(data.presets.computer.plugins.a.enabled, true);
    assert.equal(settings.RIBBON_SETTINGS[0].ribbonIdMap.en, 'a');
    assert.equal(data.presets.phone.ribbon[0].ribbonIdMap.en, 'a');
});

test('platform fallback distinguishes tablets, phones and desktop independently of device IDs', async () => {
    assert.equal(model.detectDeviceType({ isMobileApp: false, isTablet: false }), 'computer');
    assert.equal(model.detectDeviceType({ isMobileApp: true, isTablet: true }), 'tablet');
    assert.equal(model.detectDeviceType({ isMobileApp: true, isTablet: false }), 'phone');
});

test('synced unknown data cannot introduce extra presets or invalid ribbon entries', async () => {
    const { settings } = await fixture();
    const normalized = model.normalizeDeviceManagement({ enabled: 'yes', presets: {
        car: {}, phone: { plugins: { x: { enabled: 'yes' } }, ribbon: [null, {}, ribbon, ribbon, { ...ribbon, order: Infinity }] },
    }, devices: [null, { id: '1', name: 'A', type: 'car' }, { id: '2', name: 'B', type: 'phone' }] }, model.snapshotPreset(settings));
    assert.equal(normalized.enabled, false);
    assert.equal(Object.keys(normalized.presets).length, 3);
    assert.equal(normalized.presets.phone.plugins.x, undefined);
    assert.equal(normalized.presets.phone.ribbon.length, 1);
    assert.equal(normalized.devices.length, 1);
});

test('saving a remote preset never changes this device and keeps remote-only plugin choices', async () => {
    const { manager, settings, calls } = await fixture();
    settings.DEVICE_MANAGEMENT.enabled = true;
    const phone = model.clonePreset(settings.DEVICE_MANAGEMENT.presets.phone);
    phone.plugins.a.enabled = false;
    phone.plugins.remote = { enabled: true, delay: 'later' };
    phone.ribbon[0].visible = false;
    await manager.devices.savePreset('phone', phone);
    assert.equal(settings.Plugins.find(plugin => plugin.id === 'a').enabled, true);
    assert.equal(settings.RIBBON_SETTINGS[0].visible, true);
    assert.equal(calls.some(([action]) => action === 'disable'), false);
    await manager.saveSettings();
    assert.equal(settings.DEVICE_MANAGEMENT.presets.phone.plugins.remote.enabled, true);
    assert.equal(settings.DEVICE_MANAGEMENT.presets.phone.ribbon[0].visible, false);
});

test('current preset reconciles runtime state, protects self/ignored plugins and updates Ribbon', async () => {
    const { manager, settings, calls } = await fixture();
    const current = settings.DEVICE_MANAGEMENT.presets.computer;
    current.plugins.self.enabled = false;
    current.plugins.ignored.enabled = false;
    current.plugins.a.enabled = false;
    current.plugins.b.enabled = true;
    current.ribbon[0].visible = false;
    await manager.devices.setEnabled(true);
    assert.deepEqual(calls.filter(([action]) => ['enable', 'disable'].includes(action)), [['disable', 'a'], ['enable', 'b']]);
    assert.equal(settings.Plugins.find(plugin => plugin.id === 'self').enabled, true);
    assert.equal(settings.Plugins.find(plugin => plugin.id === 'ignored').enabled, true);
    assert.equal(settings.RIBBON_SETTINGS[0].visible, false);
});

test('manual type reassignment saves the old preset and applies the new one', async () => {
    const { manager, settings } = await fixture();
    await manager.devices.setEnabled(true);
    settings.RIBBON_SETTINGS[0].visible = false;
    await manager.devices.assign(manager.devices.id, 'tablet');
    assert.equal(settings.DEVICE_MANAGEMENT.presets.computer.ribbon[0].visible, false);
    assert.equal(settings.RIBBON_SETTINGS[0].visible, true);
    const restarted = new DeviceManager(manager);
    await restarted.initialize();
    assert.equal(restarted.type, 'tablet');
    assert.equal(restarted.id, manager.devices.id);
});

test('mobile never enables a desktop-only plugin, but preserves its configured intent', async () => {
    const { manager, settings, calls } = await fixture();
    platform.isMobileApp = true;
    manager.appPlugins.manifests.b.isDesktopOnly = true;
    settings.DEVICE_MANAGEMENT.presets.computer.plugins.b.enabled = true;
    await manager.devices.setEnabled(true);
    assert.equal(calls.some(([action, id]) => action === 'enable' && id === 'b'), false);
    assert.equal(settings.Plugins.find(plugin => plugin.id === 'b').enabled, true);
    assert.equal(manager.buildDelayQueue(Date.now()).some(item => item.id === 'b'), false);
});

test('delayed presets remove native autostart and reuse the existing queue', async () => {
    const { manager, settings, calls } = await fixture();
    settings.DELAY = true;
    let queue;
    manager.drainDelayQueue = async function () { queue = [...this.delayQueue]; };
    await manager.devices.setEnabled(true);
    assert.ok(calls.some(([action, id]) => action === 'disable' && id === 'a'));
    assert.deepEqual(queue.map(item => item.id), ['a']);
    assert.equal(settings.Plugins.find(plugin => plugin.id === 'a').enabled, true);
});

test('runtime failures are surfaced, retain saved intent and release the operation lock', async () => {
    const { manager, settings } = await fixture();
    settings.DEVICE_MANAGEMENT.presets.computer.plugins.b.enabled = true;
    manager.appPlugins.enablePluginAndSave = async () => { throw new Error('fixture failure'); };
    await assert.rejects(manager.devices.setEnabled(true), /设备_插件失败b/);
    assert.equal(manager.devices.busy, false);
    assert.equal(settings.DEVICE_MANAGEMENT.presets.computer.plugins.b.enabled, true);
});

test('ordinary saves only update the active preset and disabling management preserves runtime state', async () => {
    const { manager, settings, calls } = await fixture();
    await manager.devices.setEnabled(true);
    settings.Plugins.find(plugin => plugin.id === 'a').enabled = false;
    await manager.saveSettings();
    assert.equal(settings.DEVICE_MANAGEMENT.presets.computer.plugins.a.enabled, false);
    assert.equal(settings.DEVICE_MANAGEMENT.presets.phone.plugins.a.enabled, true);
    calls.length = 0;
    await manager.devices.setEnabled(false);
    assert.deepEqual(calls, [['save']]);
});

test('failed persistence does not reassign this device or overwrite its saved preset', async () => {
    const { manager, settings } = await fixture();
    await manager.devices.setEnabled(true);
    const before = structuredClone(settings.DEVICE_MANAGEMENT.presets.computer);
    manager.saveData = async () => { throw new Error('disk full'); };
    await assert.rejects(manager.devices.assign(manager.devices.id, 'tablet'), /disk full/);
    assert.equal(manager.devices.type, 'computer');
    assert.equal(settings.DEVICE_MANAGEMENT.devices[0].type, 'computer');
    const draft = model.clonePreset(before);
    draft.plugins.a.enabled = false;
    await assert.rejects(manager.devices.savePreset('computer', draft), /disk full/);
    assert.deepEqual(settings.DEVICE_MANAGEMENT.presets.computer, before);
    await assert.rejects(manager.devices.setEnabled(false), /disk full/);
    assert.equal(settings.DEVICE_MANAGEMENT.enabled, true);
});

test('startup application persists newly discovered Ribbon icons in the active preset', async () => {
    const { manager, settings } = await fixture();
    settings.DEVICE_MANAGEMENT.enabled = true;
    manager.refreshRibbonManagerFeature = async () => {
        settings.RIBBON_SETTINGS.push({ ...ribbon, bpmUniqueId: 'new-icon' });
        await manager.saveSettings();
    };
    await manager.devices.apply();
    assert.equal(settings.DEVICE_MANAGEMENT.presets.computer.ribbon.length, 2);
    assert.equal(settings.DEVICE_MANAGEMENT.presets.phone.ribbon.length, 1);
});

test('concurrent device operations are rejected while an application is in progress', async () => {
    const { manager } = await fixture();
    let finish;
    const pending = manager.devices.run(() => new Promise(resolve => { finish = resolve; }));
    await assert.rejects(manager.devices.setEnabled(true), /设备_忙碌/);
    finish();
    await pending;
    assert.equal(manager.devices.busy, false);
});

test('per-device overrides inherit untouched categories and survive later type changes', async () => {
    const { manager, settings } = await fixture();
    await manager.devices.setEnabled(true);
    const data = settings.DEVICE_MANAGEMENT;
    await manager.devices.selectScope('themes', `device:${manager.devices.id}`);
    await manager.devices.writeAppearance('themes', { theme: 'device-theme' });
    const device = data.devices.find(item => item.id === manager.devices.id);
    assert.equal(device.overrides.appearance.theme, 'device-theme');
    assert.equal(device.overrides.ribbon, undefined);
    assert.equal(device.overrides.sources, undefined);
    data.presets.computer.appearance.theme = 'type-theme';
    assert.equal(manager.devices.scopeAppearance('themes').theme, 'device-theme');
    await manager.devices.selectScope('themes', 'type:computer');
    assert.equal(manager.devices.scopeAppearance('themes').theme, 'type-theme');
});

test('projecting a foreign scope rewrites memory but never the persisted live values', async () => {
    const { manager, settings } = await fixture();
    await manager.devices.setEnabled(true);
    settings.DEVICE_MANAGEMENT.presets.phone.plugins.a.enabled = false;
    await manager.devices.selectScope('plugins', 'type:phone');
    assert.equal(settings.Plugins.find(plugin => plugin.id === 'a').enabled, false);
    assert.equal(manager.devices.persistedSettings().Plugins.find(plugin => plugin.id === 'a').enabled, true);
    await manager.devices.closeProjection();
    assert.equal(settings.Plugins.find(plugin => plugin.id === 'a').enabled, true);
    assert.equal(settings.DEVICE_MANAGEMENT.presets.phone.plugins.a.enabled, false);
});

test('ribbon edits while projecting a foreign scope land in that scope only', async () => {
    const { manager, settings } = await fixture();
    await manager.devices.setEnabled(true);
    settings.RIBBON_SETTINGS[0].visible = true;
    await manager.devices.selectScope('ribbon', 'type:phone');
    settings.RIBBON_SETTINGS[0].visible = false;
    await manager.saveSettings();
    assert.equal(settings.DEVICE_MANAGEMENT.presets.phone.ribbon[0].visible, false);
    assert.equal(settings.DEVICE_MANAGEMENT.presets.computer.ribbon[0].visible, true);
    assert.equal(manager.devices.persistedSettings().RIBBON_SETTINGS[0].visible, true);
    await manager.devices.closeProjection();
    assert.equal(settings.RIBBON_SETTINGS[0].visible, true);
});

test('plugin edits under a foreign type stay out of runtime and land in that preset', async () => {
    const { manager, settings } = await fixture();
    await manager.devices.setEnabled(true);
    await manager.devices.selectScope('plugins', 'type:phone');
    settings.Plugins.find(plugin => plugin.id === 'a').enabled = false;
    await manager.saveSettings();
    assert.equal(settings.DEVICE_MANAGEMENT.presets.phone.plugins.a.enabled, false);
    assert.equal(settings.DEVICE_MANAGEMENT.presets.computer.plugins.a.enabled, true);
    assert.equal(manager.devices.persistedSettings().Plugins.find(plugin => plugin.id === 'a').enabled, true);
    await manager.devices.closeProjection();
    assert.equal(settings.Plugins.find(plugin => plugin.id === 'a').enabled, true);
});

test('the current device scope stores only the plugins that differ from its type', async () => {
    const { manager, settings } = await fixture();
    await manager.devices.setEnabled(true);
    await manager.devices.selectScope('plugins', `device:${manager.devices.id}`);
    settings.Plugins.find(plugin => plugin.id === 'a').enabled = false;
    await manager.saveSettings();
    const device = settings.DEVICE_MANAGEMENT.devices[0];
    assert.equal(device.overrides.plugins.a.enabled, false);
    assert.equal(device.overrides.plugins.b, undefined);
    assert.equal(settings.DEVICE_MANAGEMENT.presets.computer.plugins.a.enabled, true);
    assert.equal(settings.Plugins.find(plugin => plugin.id === 'a').enabled, false);
});

test('group and tag edits stay global while delay stays scoped', async () => {
    const { manager, settings } = await fixture();
    await manager.devices.setEnabled(true);
    await manager.devices.selectScope('plugins', 'type:phone');
    const record = settings.Plugins.find(plugin => plugin.id === 'a');
    record.group = 'shared-group';
    record.tags = ['shared-tag'];
    record.delay = 'later';
    await manager.saveSettings();
    const persisted = manager.devices.persistedSettings().Plugins.find(plugin => plugin.id === 'a');
    assert.equal(persisted.group, 'shared-group');
    assert.deepEqual(persisted.tags, ['shared-tag']);
    assert.equal(settings.DEVICE_MANAGEMENT.presets.phone.plugins.a.delay, 'later');
    assert.deepEqual(Object.keys(settings.DEVICE_MANAGEMENT.presets.phone.plugins.a).sort(), ['delay', 'enabled']);
});
