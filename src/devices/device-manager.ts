import { Notice, Platform } from 'obsidian';
import type Manager from '../main';
import type { RibbonGroup, RibbonItem } from '../data/types';
import { applyPresetToSettings, capturePreset, cloneAppearance, clonePreset,
    allPresets, detectDeviceType, DEVICE_TYPES, DeviceManagement, DevicePluginState, DevicePreset, DeviceScope, DeviceType,
    findPreset, isDeviceType, normalizeDeviceManagement, parseScopeKey, scopeKey, ScopedAppearance,
    ScopePage, snapshotPreset, normalizeRibbonGroups, ManagedDevice } from './device-presets';

/** 磁盘上的设备记录在写回前要校验，避免坏数据进入设置 / Validate records read back from disk. */
const isManagedDevice = (value: unknown): value is ManagedDevice => {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return typeof record.id === 'string' && record.id.length > 0
        && typeof record.name === 'string'
        && typeof record.lastSeen === 'number' && Number.isFinite(record.lastSeen)
        && typeof record.type === 'string' && isDeviceType(record.type);
};

type LocalStorageApp = { loadLocalStorage(key: string): unknown; saveLocalStorage(key: string, value: unknown): void; };
type CustomCssLike = {
    theme?: string;
    enabledSnippets?: Set<string> | string[];
    setTheme?(theme: string): void;
    setCssEnabledStatus?(id: string, enabled: boolean): void;
    loadSnippets?(): Promise<void>;
};
type CapacitorDevice = { getId?(): Promise<{ identifier?: string }> };
interface StoredIdentity { id?: unknown; type?: unknown; platformId?: unknown; presetId?: unknown; }
interface LiveSnapshot {
    ribbon: RibbonItem[];
    ribbonGroups: RibbonGroup[];
    ribbonEnabled: boolean;
    plugins: Record<string, DevicePluginState>;
}
interface Projection {
    page: ScopePage;
    scope: DeviceScope;
    live: LiveSnapshot;
}

/** 设备身份留在本机；三类型下可有多份命名预设，本机手动绑定其中一份。 */
export class DeviceManager {
    public id = '';
    public type: DeviceType = detectDeviceType(Platform);
    public busy = false;
    public boundPresetId = '';
    private ready = false;
    private readonly storageKey = 'better-plugins-manager-device';
    /** 本次会话里手动删除的设备，合并磁盘记录时不得复活 / IDs removed in this session. */
    private readonly removedDeviceIds = new Set<string>();
    private selection = '';
    private projection?: Projection;

    constructor(private readonly manager: Manager) {}
    get data(): DeviceManagement {
        const data = this.manager.settings.DEVICE_MANAGEMENT;
        if (!data) throw new Error('Device management has not been initialized');
        return data;
    }

    async initialize(): Promise<void> {
        const settings = this.manager.settings;
        const legacy = settings.DEVICE_MANAGEMENT;
        // 旧版非延迟模式以原生启用表为准；Migrate the actual non-delayed enabled state.
        if (!legacy && !settings.DELAY) {
            settings.Plugins.forEach(plugin => { plugin.enabled = this.manager.appPlugins.enabledPlugins.has(plugin.id); });
        }
        settings.DEVICE_MANAGEMENT = normalizeDeviceManagement(legacy,
            snapshotPreset(settings, { appearance: this.readLiveAppearance() }));
        const stored = await this.loadIdentity();
        this.migrateDeviceRecord(typeof stored?.id === 'string' ? stored.id : '');
        const known = this.data.devices.find(device => device.id === this.id);
        if (known) {
            this.type = known.type;
            known.lastSeen = Date.now();
            if (this.isGeneratedName(known.name)) known.name = this.detectDeviceName();
        } else {
            this.data.devices.push({ id: this.id, type: this.type, name: this.detectDeviceName(), lastSeen: Date.now() });
        }
        this.migrateLegacyOverrides(legacy);
        this.ensureBinding(typeof stored?.presetId === 'string' ? stored.presetId : '', true);
        this.persistIdentity();
        if (this.data.enabled) {
            this.adoptIfNeeded(this.type);
            this.applyEffective();
        }
        this.ready = true;
        // 记录文件是跨设备的唯一通道：启动时先收别人的，再写自己的。
        await this.mergeDeviceRecords();
        await this.persistOwnDevice();
    }

    /* ---------- 预设复用 / Reuse ---------- */

    /** 未配置的类型在只有一份已配置预设时自动复用；多份时留给设备页手动选择。 */
    private adoptIfNeeded(type: DeviceType): void {
        const own = this.presetsFor(type);
        if (own.some(preset => preset.configured)) return;
        const candidates = allPresets(this.data.presets)
            .filter(entry => entry.type !== type && entry.preset.configured)
            .map(entry => entry.preset);
        if (candidates.length !== 1) return;
        const target = own[0];
        const source = candidates[0];
        if (!target || !source) return;
        const copy = clonePreset(source);
        target.plugins = copy.plugins;
        target.ribbon = copy.ribbon;
        target.ribbonGroups = copy.ribbonGroups;
        target.ribbonEnabled = copy.ribbonEnabled;
        target.appearance = copy.appearance;
        target.configured = true;
        new Notice(this.manager.translator.t('设备_自动复用', { type: this.label(type), source: source.name }));
    }

    /** 手动复用某个预设的配置（保留目标预设的 id 与名称）。 */
    async copyConfig(targetId: string, sourceId: string): Promise<void> {
        await this.run(async () => {
            const target = this.presetById(targetId);
            const source = this.presetById(sourceId);
            if (!target || !source || targetId === sourceId) return;
            const copy = clonePreset(source.preset);
            target.preset.plugins = copy.plugins;
            target.preset.ribbon = copy.ribbon;
            target.preset.ribbonGroups = copy.ribbonGroups;
            target.preset.ribbonEnabled = copy.ribbonEnabled;
            target.preset.appearance = copy.appearance;
            target.preset.configured = true;
            if (this.data.enabled && targetId === this.boundPresetId) await this.applyCurrent();
            await this.manager.saveSettings({ captureDevice: false });
        });
    }

    label(type: DeviceType): string { return this.manager.translator.t(`设备_${type}`); }

    /** 设备默认名：桌面取主机名，移动端取型号；都取不到才回落类型名。 */
    private detectDeviceName(): string {
        return this.readHostname() || this.readMobileModel() || this.label(this.type);
    }
    private readHostname(): string {
        if (!Platform.isDesktopApp) return '';
        try {
            const nodeRequire = (globalThis as { require?: (id: string) => unknown }).require;
            const os = nodeRequire?.('os') as { hostname?: () => string } | undefined;
            return String(os?.hostname?.() || '').trim();
        } catch (error) {
            if (this.manager.settings.DEBUG) console.error('[BPM] Hostname unavailable', error);
            return '';
        }
    }
    /** 仅用于没有原生 API 的硬件型号；OS 判定仍以 Platform 为准。 */
    private readMobileModel(): string {
        if (!Platform.isMobileApp) return '';
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        if (Platform.isIosApp || /iPhone|iPad|iPod/.test(ua)) {
            if (Platform.isTablet || /iPad/.test(ua)) return 'iPad';
            return /iPod/.test(ua) ? 'iPod' : 'iPhone';
        }
        if (/Android/i.test(ua)) {
            const block = (ua.match(/\(([^)]*)\)/) || [])[1] || '';
            const segments = block.split(';').map(segment => segment.trim());
            const androidIndex = segments.findIndex(segment => /^Android\s/i.test(segment));
            for (let index = androidIndex >= 0 ? androidIndex + 1 : 0; index < segments.length; index += 1) {
                const segment = segments[index];
                if (!segment || /^wv$/i.test(segment) || /^[a-z]{2}(-[A-Za-z]{2})?$/.test(segment)) continue;
                return segment.replace(/\s*Build\/.*$/i, '').trim();
            }
        }
        return '';
    }
    /** 空名或三种语言的类型名都视为自动生成，允许升级；用户命名保持不动。 */
    private isGeneratedName(name: string): boolean {
        const trimmed = (name || '').trim();
        if (!trimmed) return true;
        const generated = new Set(['Computer', 'Tablet', 'Phone', '电脑', '平板', '手机']);
        for (const type of DEVICE_TYPES) generated.add(this.label(type));
        return generated.has(trimmed);
    }

    /* ---------- 预设与绑定 / Presets and binding ---------- */

    presetsFor(type: DeviceType): DevicePreset[] { return this.data.presets[type]; }
    presetById(id: string): { type: DeviceType; preset: DevicePreset } | null { return findPreset(this.data.presets, id); }
    boundPreset(): DevicePreset | null {
        return this.presetById(this.boundPresetId)?.preset ?? null;
    }
    /** 平台标识刷新时把旧记录迁到新 id，避免设备列表累积幽灵条目。 */
    private migrateDeviceRecord(previousId: string): void {
        if (!previousId || previousId === this.id) return;
        const devices = this.data.devices;
        const previous = devices.find(device => device.id === previousId);
        if (!previous) return;
        const current = devices.find(device => device.id === this.id);
        if (current) {
            // 新 id 已有记录：旧记录是同一安装的上一身份，直接移除。
            this.data.devices = devices.filter(device => device !== previous);
            return;
        }
        previous.id = this.id;
    }

    /** 本机没有可绑定的预设时，回落到该类型的第一份。 */
    private ensureBinding(storedPresetId: string, notifyFallback = false): void {
        const found = storedPresetId ? this.presetById(storedPresetId) : null;
        if (found && found.type === this.type) { this.boundPresetId = found.preset.id; return; }
        const fallback = this.presetsFor(this.type)[0];
        this.boundPresetId = fallback?.id ?? '';
        if (notifyFallback && storedPresetId && fallback) {
            new Notice(this.manager.translator.t('设备_预设回退', { name: fallback.name }));
        }
    }
    async bindPreset(id: string): Promise<void> {
        await this.run(async () => {
            const found = this.presetById(id);
            if (!found) throw new Error(this.manager.translator.t('设备_未找到'));
            await this.closeProjection();
            if (found.type !== this.type) {
                this.type = found.type;
                const device = this.data.devices.find(item => item.id === this.id);
                if (device) device.type = found.type;
            }
            this.boundPresetId = found.preset.id;
            this.selection = scopeKey(this.boundPresetId);
            this.adoptIfNeeded(found.type);
            this.persistIdentity();
            if (this.data.enabled) await this.applyCurrent();
            await this.manager.saveSettings({ captureDevice: false });
        });
    }
    async createPreset(type: DeviceType, sourceId?: string): Promise<string | null> {
        return this.run(async () => {
            const list = this.presetsFor(type);
            const bound = list.find(item => item.id === this.boundPresetId);
            const source = (sourceId ? list.find(item => item.id === sourceId) : undefined) ?? bound ?? list[0];
            const base = source ? clonePreset(source) : snapshotPreset(this.manager.settings, { appearance: this.readLiveAppearance() });
            const id = `preset-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
            list.push({ ...base, id, name: this.uniquePresetName(type, `${this.label(type)} ${list.length + 1}`), configured: true });
            this.data.presets[type] = list;
            await this.manager.saveSettings({ captureDevice: false });
            return id;
        });
    }
    async duplicatePreset(id: string): Promise<string | null> {
        return this.run(async () => {
            const found = this.presetById(id);
            if (!found) return null;
            const list = this.presetsFor(found.type);
            const copyId = `preset-${found.type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
            const name = this.uniquePresetName(found.type, `${found.preset.name} ${this.manager.translator.t('设备_副本后缀')}`);
            list.push({ ...clonePreset(found.preset), id: copyId, name, configured: true });
            this.data.presets[found.type] = list;
            await this.manager.saveSettings({ captureDevice: false });
            return copyId;
        });
    }
    private uniquePresetName(type: DeviceType, base: string): string {
        const names = new Set(this.presetsFor(type).map(preset => preset.name));
        if (!names.has(base)) return base;
        let index = 2;
        while (names.has(`${base} ${index}`)) index += 1;
        return `${base} ${index}`;
    }
    async renamePreset(id: string, name: string): Promise<void> {
        const found = this.presetById(id);
        if (!found || !name.trim()) throw new Error(this.manager.translator.t('设备_名称为空'));
        found.preset.name = name.trim();
        await this.manager.saveSettings();
    }
    async deletePreset(id: string): Promise<void> {
        await this.run(async () => {
            const found = this.presetById(id);
            if (!found) return;
            const list = this.presetsFor(found.type);
            if (list.length <= 1) throw new Error(this.manager.translator.t('设备_至少保留预设'));
            this.data.presets[found.type] = list.filter(item => item.id !== id);
            if (this.boundPresetId === id) {
                this.boundPresetId = this.presetsFor(found.type)[0]?.id ?? '';
                this.persistIdentity();
                if (this.data.enabled) await this.applyCurrent();
            }
            if (this.selection === scopeKey(id)) this.selection = scopeKey(this.boundPresetId);
            await this.manager.saveSettings({ captureDevice: false });
        });
    }

    effectiveForScope(scope: DeviceScope): DevicePreset {
        return clonePreset(this.presetById(scope.presetId)?.preset ?? this.presetsFor(scope.type)[0]);
    }
    isLiveScope(scope: DeviceScope): boolean { return scope.presetId === this.boundPresetId; }
    isProjectingForeign(page?: ScopePage): boolean {
        if (!this.projection) return false;
        return page ? this.projection.page === page : true;
    }

    /* ---------- 作用域选择 / Scope selection ---------- */

    scopeOptions(): DeviceScope[] {
        const options: DeviceScope[] = [];
        for (const type of DEVICE_TYPES) {
            for (const preset of this.presetsFor(type)) {
                options.push({ key: scopeKey(preset.id), type, presetId: preset.id });
            }
        }
        return options;
    }
    scopeLabel(scope: DeviceScope): string {
        const preset = this.presetById(scope.presetId)?.preset;
        const name = preset?.name || scope.presetId;
        return `${name} · ${this.label(scope.type)}`;
    }
    selectedScopeKey(_page: ScopePage): string {
        const parsed = this.selection ? parseScopeKey(this.selection) : null;
        if (parsed && this.presetById(parsed.presetId)) return this.selection;
        return scopeKey(this.boundPresetId);
    }
    selectedScope(page: ScopePage): DeviceScope {
        const parsed = parseScopeKey(this.selectedScopeKey(page));
        const found = parsed ? this.presetById(parsed.presetId) : null;
        if (found) return { key: scopeKey(found.preset.id), type: found.type, presetId: found.preset.id };
        const fallback = this.presetsFor(this.type)[0];
        return { key: scopeKey(fallback.id), type: this.type, presetId: fallback.id };
    }

    /** 切换一栏的编辑作用域：先落盘旧作用域，再投影新作用域。 */
    async selectScope(page: ScopePage, key: string): Promise<void> {
        const parsed = parseScopeKey(key);
        const found = parsed ? this.presetById(parsed.presetId) : null;
        if (!found) return;
        const scope: DeviceScope = { key: scopeKey(found.preset.id), type: found.type, presetId: found.preset.id };
        await this.run(async () => {
            await this.closeProjection();
            this.selection = scope.key;
            if (this.data.enabled && !this.isLiveScope(scope)) this.project(scope, page);
            await this.manager.saveSettings({ captureDevice: false });
        });
    }

    private project(scope: DeviceScope, page: ScopePage): void {
        const settings = this.manager.settings;
        this.projection = {
            page,
            scope,
            live: {
                ribbon: settings.RIBBON_SETTINGS.map(item => ({ ...item, ribbonIdMap: item.ribbonIdMap ? { ...item.ribbonIdMap } : undefined })),
                ribbonGroups: normalizeRibbonGroups(settings.RIBBON_GROUPS),
                ribbonEnabled: settings.RIBBON_MANAGER_ENABLED,
                plugins: this.pluginStates(),
            },
        };
        const preset = this.effectiveForScope(scope);
        settings.RIBBON_SETTINGS = preset.ribbon.map(item => ({ ...item, ribbonIdMap: item.ribbonIdMap ? { ...item.ribbonIdMap } : undefined }));
        settings.RIBBON_GROUPS = normalizeRibbonGroups(preset.ribbonGroups);
        settings.RIBBON_MANAGER_ENABLED = preset.ribbonEnabled;
        for (const plugin of settings.Plugins) {
            const state = Object.prototype.hasOwnProperty.call(preset.plugins, plugin.id) ? preset.plugins[plugin.id] : undefined;
            if (state) { plugin.enabled = state.enabled; plugin.delay = state.delay; }
        }
    }

    /** 关闭投影：把外域改动写回该预设，并恢复本机实时值。 */
    async closeProjection(): Promise<void> {
        const projection = this.projection;
        if (!projection) return;
        const settings = this.manager.settings;
        this.projection = undefined;
        this.storeSnapshot(projection.scope.presetId, {
            ribbon: settings.RIBBON_SETTINGS,
            ribbonGroups: settings.RIBBON_GROUPS,
            ribbonEnabled: settings.RIBBON_MANAGER_ENABLED,
            plugins: this.pluginStates(),
        });
        this.restoreLive(projection.live);
        await this.manager.saveSettings({ captureDevice: false });
    }

    /** 离开带作用域的栏目时恢复本机视图；Switch pages restore live values. */
    noteActivePage(page: string): void {
        if (this.projection && this.projection.page !== page) void this.closeProjection().catch(error => this.report(error));
    }
    /** 栏目重新渲染时补投影，避免从其他页返回后丢掉外域视图。 */
    ensureProjection(page: ScopePage): void {
        if (!this.ready || !this.data.enabled) return;
        const scope = this.selectedScope(page);
        if (this.isLiveScope(scope)) return;
        if (this.projection) return;
        this.project(scope, page);
    }
    async flushProjection(): Promise<void> { await this.closeProjection(); }

    private restoreLive(live: LiveSnapshot): void {
        const settings = this.manager.settings;
        settings.RIBBON_SETTINGS = live.ribbon;
        settings.RIBBON_GROUPS = live.ribbonGroups;
        settings.RIBBON_MANAGER_ENABLED = live.ribbonEnabled;
        for (const plugin of settings.Plugins) {
            const state = live.plugins[plugin.id];
            if (state) { plugin.enabled = state.enabled; plugin.delay = state.delay; }
        }
    }

    private storeSnapshot(presetId: string, snapshot: LiveSnapshot): void {
        const found = this.presetById(presetId);
        if (!found) return;
        const before = JSON.stringify([found.preset.plugins, found.preset.ribbon, found.preset.ribbonGroups, found.preset.ribbonEnabled]);
        found.preset.ribbon = cloneRibbon(snapshot.ribbon);
        found.preset.ribbonGroups = normalizeRibbonGroups(snapshot.ribbonGroups);
        found.preset.ribbonEnabled = snapshot.ribbonEnabled;
        found.preset.plugins = { ...found.preset.plugins, ...snapshot.plugins };
        if (!found.preset.configured && before !== JSON.stringify([found.preset.plugins, found.preset.ribbon, found.preset.ribbonGroups, found.preset.ribbonEnabled])) {
            found.preset.configured = true;
        }
    }

    /** 捕获时只有值真的变了才标记“已配置”，避免空保存把新类型锁死。 */
    private captureInto(preset: DevicePreset, extras: { appearance?: ScopedAppearance }): void {
        const before = JSON.stringify([preset.plugins, preset.ribbon, preset.ribbonGroups, preset.ribbonEnabled, preset.appearance]);
        capturePreset(preset, this.manager.settings, extras);
        if (!preset.configured && before !== JSON.stringify([preset.plugins, preset.ribbon, preset.ribbonGroups, preset.ribbonEnabled, preset.appearance])) {
            preset.configured = true;
        }
    }

    private pluginStates(): Record<string, DevicePluginState> {
        return Object.fromEntries(this.manager.settings.Plugins.map(plugin => [plugin.id, { enabled: plugin.enabled, delay: plugin.delay }]));
    }

    /* ---------- 外观作用域 / Scoped appearance ---------- */

    readLiveAppearance(): ScopedAppearance {
        const customCss = this.customCss();
        const theme = customCss?.theme || (customCss as { getTheme?(): string } | undefined)?.getTheme?.() || '';
        const enabled = customCss?.enabledSnippets;
        const snippets: Record<string, boolean> = {};
        const list = enabled instanceof Set ? [...enabled] : Array.isArray(enabled) ? enabled : [];
        for (const id of list) if (typeof id === 'string') snippets[id] = true;
        return { theme, snippets };
    }
    scopeAppearance(page: ScopePage): ScopedAppearance {
        return cloneAppearance(this.effectiveForScope(this.selectedScope(page)).appearance);
    }
    /** 读写当前栏目的外观状态：外域只存储，本机实时应用。 */
    writeAppearance(page: ScopePage, patch: { theme?: string; snippets?: Record<string, boolean> }): Promise<void> {
        return this.run(async () => {
            const scope = this.selectedScope(page);
            const live = this.isLiveScope(scope);
            if (live) {
                if (typeof patch.theme === 'string') this.customCss()?.setTheme?.(patch.theme);
                for (const [snippetId, enabled] of Object.entries(patch.snippets ?? {})) {
                    this.customCss()?.setCssEnabledStatus?.(snippetId, enabled);
                }
            }
            const next = live ? { ...this.readLiveAppearance() } : this.scopeAppearance(page);
            if (typeof patch.theme === 'string') next.theme = patch.theme;
            Object.assign(next.snippets, patch.snippets ?? {});
            const found = this.presetById(scope.presetId);
            if (found) {
                found.preset.appearance = cloneAppearance(next);
                found.preset.configured = true;
            }
            await this.manager.saveSettings({ captureDevice: false });
        });
    }

    /* ---------- 捕获 / Capture ---------- */

    capture(): void {
        if (!this.ready || !this.data.enabled || this.busy) return;
        const projection = this.projection;
        if (projection) {
            this.storeSnapshot(projection.scope.presetId, {
                ribbon: this.manager.settings.RIBBON_SETTINGS,
                ribbonGroups: this.manager.settings.RIBBON_GROUPS,
                ribbonEnabled: this.manager.settings.RIBBON_MANAGER_ENABLED,
                plugins: this.pluginStates(),
            });
            return;
        }
        const bound = this.boundPreset();
        if (bound) this.captureInto(bound, { appearance: this.readLiveAppearance() });
    }

    /** 保存时写回的“本机真实值”；投影期间不能让外域值污染 data.json。 */
    persistedSettings(): Manager['settings'] {
        if (!this.projection) return this.manager.settings;
        const settings = this.manager.settings;
        return {
            ...settings,
            Plugins: settings.Plugins.map(plugin => {
                const live = this.projection?.live.plugins[plugin.id];
                return live ? { ...plugin, enabled: live.enabled, delay: live.delay } : plugin;
            }),
            RIBBON_SETTINGS: this.projection.live.ribbon,
            RIBBON_GROUPS: this.projection.live.ribbonGroups,
            RIBBON_MANAGER_ENABLED: this.projection.live.ribbonEnabled,
        };
    }

    /* ---------- 身份 / Identity ---------- */

    private persistIdentity(): void {
        const storage = this.manager.app as unknown as LocalStorageApp;
        storage.saveLocalStorage(this.storageKey, { id: this.id, type: this.type,
            platformId: this.platformIdentity, presetId: this.boundPresetId });
    }
    private platformIdentity = '';

    private async loadIdentity(): Promise<StoredIdentity | undefined> {
        const storage = this.manager.app as unknown as LocalStorageApp;
        let stored: StoredIdentity | undefined;
        try {
            const value = storage.loadLocalStorage(this.storageKey);
            if (typeof value === 'object' && value !== null) stored = value as StoredIdentity;
        } catch (error) {
            this.report(error);
        }
        const platformId = await this.readPlatformIdentity();
        this.platformIdentity = platformId;
        const storedId = typeof stored?.id === 'string' && stored.id ? stored.id : '';
        const storedPlatform = typeof stored?.platformId === 'string' ? stored.platformId : '';
        if (platformId && storedPlatform === platformId && storedId) this.id = storedId;
        else if (platformId) this.id = `device-${platformId.slice(0, 24)}`;
        else if (storedId) this.id = storedId;
        else this.id = this.randomId();
        this.type = stored && isDeviceType(stored.type) ? stored.type : detectDeviceType(Platform);
        return stored;
    }

    /** 旧版单设备覆盖一次性合并进对应类型的首份预设。 */
    private migrateLegacyOverrides(legacy: unknown): void {
        const rawDevices = (legacy as { devices?: unknown } | undefined)?.devices;
        if (!Array.isArray(rawDevices)) return;
        const raw = rawDevices.find(item => (item as { id?: unknown })?.id === this.id) as
            { overrides?: Record<string, unknown> } | undefined;
        const overrides = raw?.overrides;
        if (!overrides) return;
        const target = this.presetsFor(this.type)[0];
        if (!target) return;
        const plugins = overrides.plugins as Record<string, { enabled?: unknown; delay?: unknown }> | undefined;
        if (plugins && typeof plugins === 'object') {
            for (const [id, state] of Object.entries(plugins)) {
                if (!state || typeof state.enabled !== 'boolean') continue;
                target.plugins[id] = { enabled: state.enabled, delay: typeof state.delay === 'string' ? state.delay : '' };
            }
        }
        if (Array.isArray(overrides.ribbon)) {
            const ribbon = overrides.ribbon as unknown[];
            if (ribbon.every(item => item && typeof item === 'object')) target.ribbon = cloneRibbon(ribbon as RibbonItem[]);
        }
        if (typeof overrides.ribbonEnabled === 'boolean') target.ribbonEnabled = overrides.ribbonEnabled;
        const appearance = overrides.appearance as { theme?: unknown; snippets?: unknown } | undefined;
        if (appearance && typeof appearance === 'object') {
            if (typeof appearance.theme === 'string') target.appearance.theme = appearance.theme;
            if (appearance.snippets && typeof appearance.snippets === 'object') {
                for (const [id, enabled] of Object.entries(appearance.snippets as Record<string, unknown>)) {
                    if (typeof enabled === 'boolean') target.appearance.snippets[id] = enabled;
                }
            }
        }
        target.configured = true;
        if (this.manager.settings.DEBUG) console.log('[BPM] Migrated legacy device overrides into preset', target.id);
    }

    /** 移动端用 Capacitor 的设备标识做稳定身份；桌面端没有该插件。 */
    private async readPlatformIdentity(): Promise<string> {
        try {
            const capacitor = (globalThis as { Capacitor?: { Plugins?: { Device?: CapacitorDevice } } }).Capacitor;
            const identifier = await capacitor?.Plugins?.Device?.getId?.();
            const value = identifier?.identifier;
            if (typeof value !== 'string' || !value) return '';
            return await this.hashIdentity(value);
        } catch (error) {
            if (this.manager.settings.DEBUG) console.error('[BPM] Platform identity unavailable', error);
            return '';
        }
    }
    private async hashIdentity(value: string): Promise<string> {
        const prefix = Platform.isMobileApp ? (Platform.isAndroidApp ? 'android' : 'ios') : 'desktop';
        const input = `${prefix}:${value}`;
        const subtle = globalThis.crypto?.subtle;
        if (subtle) {
            const data = new TextEncoder().encode(input);
            const digest = await subtle.digest('SHA-256', data);
            return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        }
        let hash = 0x811c9dc5;
        for (let index = 0; index < input.length; index += 1) {
            hash ^= input.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        return (hash >>> 0).toString(16).padStart(8, '0').repeat(4);
    }
    private randomId(): string {
        return typeof globalThis.crypto?.randomUUID === 'function'
            ? globalThis.crypto.randomUUID()
            : `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    private customCss(): CustomCssLike | undefined {
        return (this.manager.app as unknown as { customCss?: CustomCssLike }).customCss;
    }

    report(error: unknown): void {
        if (this.manager.settings.DEBUG) console.error('[BPM] Device management failed', error);
        const message = error instanceof Error ? error.message : this.manager.translator.t('通用_失败_文本');
        new Notice(`${this.manager.translator.t('设备_失败')}: ${message}`);
    }

    /** 统一串行入口，阻止连续触控交叉应用；Serialize all preset mutations. */
    async run<T>(task: () => Promise<T>): Promise<T> {
        if (this.busy) throw new Error(this.manager.translator.t('设备_忙碌'));
        this.busy = true;
        try { return await task(); } finally { this.busy = false; }
    }

    async setEnabled(enabled: boolean): Promise<void> {
        await this.run(async () => {
            await this.closeProjection();
            const previous = this.data.enabled;
            this.data.enabled = enabled;
            try { await this.manager.saveSettings({ captureDevice: false }); }
            catch (error) { this.data.enabled = previous; throw error; }
            if (enabled) {
                this.adoptIfNeeded(this.type);
                await this.applyCurrent();
            }
        });
    }

    async savePresetById(id: string, preset: DevicePreset): Promise<void> {
        await this.run(async () => {
            const found = this.presetById(id);
            if (!found) throw new Error(this.manager.translator.t('设备_未找到'));
            const previous = found.preset;
            this.data.presets[found.type] = this.presetsFor(found.type).map(item => item.id === id ? clonePreset(preset) : item);
            try { await this.manager.saveSettings({ captureDevice: false }); }
            catch (error) {
                this.data.presets[found.type] = this.presetsFor(found.type).map(item => item.id === id ? previous : item);
                throw error;
            }
            if (this.data.enabled && id === this.boundPresetId) await this.applyCurrent();
        });
    }

    async assign(id: string, type: DeviceType): Promise<void> {
        await this.run(async () => {
            await this.closeProjection();
            const device = this.data.devices.find(item => item.id === id);
            if (!device) throw new Error(this.manager.translator.t('设备_未找到'));
            const previous = device.type;
            const previousType = this.type;
            const previousPreset = this.boundPresetId;
            const previousSelection = this.selection;
            if (id === this.id) {
                if (this.data.enabled) {
                    const bound = this.boundPreset();
                    if (bound) capturePreset(bound, this.manager.settings, { appearance: this.readLiveAppearance() });
                }
                this.type = type;
                this.adoptIfNeeded(type);
                this.ensureBinding(this.boundPresetId);
                this.selection = scopeKey(this.boundPresetId);
                this.persistIdentity();
            }
            device.type = type;
            if (id === this.id) await this.persistOwnDevice();
            try { await this.manager.saveSettings({ captureDevice: false }); }
            catch (error) {
                device.type = previous;
                this.type = previousType;
                this.boundPresetId = previousPreset;
                this.selection = previousSelection;
                if (id === this.id) {
                    try { this.persistIdentity(); } catch (storageError) { this.report(storageError); }
                }
                throw error;
            }
            if (id === this.id && this.data.enabled) await this.applyCurrent();
        });
    }

    async rename(id: string, name: string): Promise<void> {
        const device = this.data.devices.find(item => item.id === id);
        if (!device || !name.trim()) throw new Error(this.manager.translator.t('设备_名称为空'));
        device.name = name.trim();
        // 只有本机记录由本机写盘，改名其他设备保持本地展示。
        if (id === this.id) await this.persistOwnDevice();
        await this.manager.saveSettings();
    }

    async remove(id: string): Promise<void> {
        if (id === this.id) return;
        this.removedDeviceIds.add(id);
        this.data.devices = this.data.devices.filter(device => device.id !== id);
        await this.removeDeviceFile(id);
        await this.manager.saveSettings();
    }

    /* ---------- 设备记录文件 / Device record files ---------- */

    /** 记录文件放在 .obsidian 根目录：同步工具会处理这里的 JSON，插件子目录里的额外文件会漏掉。 */
    private deviceFilePath(id: string): string | undefined {
        const configDir = this.manager.app?.vault?.configDir;
        if (!configDir) return undefined;
        return `${configDir}/better-plugins-manager-device-${id}.json`;
    }

    private deviceFilePrefix(): string | undefined {
        const configDir = this.manager.app?.vault?.configDir;
        if (!configDir) return undefined;
        return `${configDir}/better-plugins-manager-device-`;
    }

    private async writeDeviceFile(device: ManagedDevice): Promise<void> {
        const path = this.deviceFilePath(device.id);
        const adapter = this.manager.app?.vault?.adapter;
        if (!path || !adapter) return;
        try {
            await adapter.write(path, JSON.stringify(device, null, 2));
        } catch (error) { this.report(error); }
    }

    private async removeDeviceFile(id: string): Promise<void> {
        const path = this.deviceFilePath(id);
        const adapter = this.manager.app?.vault?.adapter;
        if (!path || !adapter) return;
        try {
            if (await adapter.exists(path)) await adapter.remove(path);
        } catch (error) { this.report(error); }
    }

    /** 本机记录与名称/类型变化后立即写盘，其他设备才能同步到。 */
    private async persistOwnDevice(): Promise<void> {
        const own = this.data.devices.find(device => device.id === this.id);
        if (own) await this.writeDeviceFile(own);
    }

    /**
     * 读取其他设备写入的记录文件并并回内存。
     * 设备记录不走 data.json：那份文件容易被同步规则排除，且多设备共享会互相覆盖。
     * Merge device records from their own files (one file per device).
     */
    async mergeDeviceRecords(): Promise<boolean> {
        if (!this.ready) return false;
        const configDir = this.manager.app?.vault?.configDir;
        const prefix = this.deviceFilePrefix();
        const adapter = this.manager.app?.vault?.adapter;
        if (!configDir || !prefix || !adapter) return false;
        let listed: { files: string[] } | undefined;
        try {
            listed = await adapter.list(configDir);
        } catch {
            return false;
        }
        let changed = false;
        for (const path of listed?.files ?? []) {
            if (!path.startsWith(prefix) || !path.endsWith('.json')) continue;
            let parsed: unknown;
            try {
                parsed = JSON.parse(await adapter.read(path));
            } catch {
                continue;
            }
            if (!isManagedDevice(parsed) || parsed.id === this.id) continue;
            if (this.removedDeviceIds.has(parsed.id)) continue;
            const incoming: ManagedDevice = parsed;
            const known = this.data.devices.find(device => device.id === incoming.id);
            if (known) {
                // 名称与类型以本机为准，只更新上线时间 / Keep local name/type, refresh the heartbeat.
                if (incoming.lastSeen > known.lastSeen) { known.lastSeen = incoming.lastSeen; changed = true; }
                continue;
            }
            this.data.devices.push({ ...incoming });
            changed = true;
        }
        return changed;
    }

    async apply(): Promise<void> { await this.run(() => this.applyCurrent()); }

    /** 应用本机绑定的预设：投影设置、重算插件运行态，再把新登记的项写回。 */
    private async applyCurrent(): Promise<void> {
        this.applyEffective();
        await this.manager.applyDeviceConfiguration();
        const bound = this.boundPreset();
        if (bound) this.captureInto(bound, { appearance: this.readLiveAppearance() });
        await this.manager.saveSettings({ captureDevice: false });
    }

    private applyEffective(): void {
        const preset = this.boundPreset();
        if (!preset) return;
        applyPresetToSettings(preset, this.manager.settings, this.manager.manifest.id);
        this.applyAppearance(preset.appearance);
    }

    private applyAppearance(appearance: ScopedAppearance): void {
        const customCss = this.customCss();
        if (!customCss) return;
        try {
            if (customCss.theme !== appearance.theme) customCss.setTheme?.(appearance.theme);
            const live = this.readLiveAppearance();
            const enabled = new Set(Object.entries(appearance.snippets).filter(([, flag]) => flag).map(([id]) => id));
            for (const id of Object.keys(live.snippets)) if (!enabled.has(id)) customCss.setCssEnabledStatus?.(id, false);
            for (const id of enabled) if (!live.snippets[id]) customCss.setCssEnabledStatus?.(id, true);
        } catch (error) {
            if (this.manager.settings.DEBUG) console.error('[BPM] Apply device appearance failed', error);
        }
    }
}

function cloneRibbon(items: RibbonItem[]): RibbonItem[] {
    return items.map(item => ({ ...item, ribbonIdMap: item.ribbonIdMap ? { ...item.ribbonIdMap } : undefined }));
}
