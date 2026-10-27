import type { ManagerSettings } from '../settings/data';
import type { RibbonItem } from '../data/types';

export const DEVICE_TYPES = ['computer', 'tablet', 'phone'] as const;
export type DeviceType = typeof DEVICE_TYPES[number];
export interface DevicePluginState { enabled: boolean; delay: string; }

/** 外观运行状态：主题名与各 CSS 片段的显式开关 / Runtime appearance applied per scope. */
export interface ScopedAppearance {
    theme: string;
    snippets: Record<string, boolean>;
}

export interface DevicePreset {
    plugins: Record<string, DevicePluginState>;
    ribbon: RibbonItem[];
    ribbonEnabled: boolean;
    appearance: ScopedAppearance;
}

/** 单设备只保存自己动过的那几类；未动过的继续跟随设备类型 / Sparse per-scope overrides. */
export interface DeviceOverride {
    plugins?: Record<string, DevicePluginState>;
    ribbon?: RibbonItem[];
    ribbonEnabled?: boolean;
    appearance?: Partial<ScopedAppearance>;
}

export interface ManagedDevice {
    id: string;
    name: string;
    type: DeviceType;
    lastSeen: number;
    overrides?: DeviceOverride;
}

export interface DeviceManagement {
    enabled: boolean;
    presets: Record<DeviceType, DevicePreset>;
    devices: ManagedDevice[];
}

export type ScopePage = 'plugins' | 'themes' | 'ribbon';
export interface DeviceScope {
    key: string;
    type: DeviceType;
    deviceId?: string;
}

export function isDeviceType(value: unknown): value is DeviceType {
    return value === 'computer' || value === 'tablet' || value === 'phone';
}
export function detectDeviceType(platform: { isMobileApp: boolean; isTablet: boolean }): DeviceType {
    return platform.isMobileApp ? (platform.isTablet ? 'tablet' : 'phone') : 'computer';
}

export function scopeKey(type: DeviceType, deviceId?: string): string {
    return deviceId ? `device:${deviceId}` : `type:${type}`;
}
export function parseScopeKey(key: string): DeviceScope | null {
    if (key.startsWith('type:')) {
        const type = key.slice(5);
        return isDeviceType(type) ? { key, type } : null;
    }
    if (key.startsWith('device:')) {
        const deviceId = key.slice(7);
        return deviceId ? { key, type: 'computer', deviceId } : null;
    }
    return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
function recordOfBooleans(value: unknown): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    if (!isRecord(value)) return result;
    for (const [key, flag] of Object.entries(value)) if (typeof flag === 'boolean' && key) result[key] = flag;
    return result;
}
function normalizeAppearance(value: unknown, baseline: ScopedAppearance): ScopedAppearance {
    if (!isRecord(value)) return cloneJson(baseline);
    return {
        theme: typeof value.theme === 'string' ? value.theme : baseline.theme,
        snippets: isRecord(value.snippets) ? recordOfBooleans(value.snippets) : cloneJson(baseline.snippets),
    };
}
function normalizeRibbon(value: unknown, fallback: RibbonItem[]): RibbonItem[] {
    if (!Array.isArray(value)) return cloneJson(fallback);
    const seen = new Set<string>();
    return value.flatMap((item: unknown) => {
        if (!isRecord(item) || typeof item.bpmUniqueId !== 'string' || seen.has(item.bpmUniqueId)
            || typeof item.name !== 'string' || typeof item.icon !== 'string'
            || typeof item.visible !== 'boolean' || typeof item.order !== 'number' || !Number.isFinite(item.order)) return [];
        seen.add(item.bpmUniqueId);
        const ribbonIdMap = isRecord(item.ribbonIdMap) ? item.ribbonIdMap : {};
        return [{ bpmUniqueId: item.bpmUniqueId, name: item.name, icon: item.icon,
            visible: item.visible, order: item.order, ribbonIdMap: {
                en: typeof ribbonIdMap.en === 'string' ? ribbonIdMap.en : undefined,
                zh: typeof ribbonIdMap.zh === 'string' ? ribbonIdMap.zh : undefined,
            } }];
    });
}
export function cloneAppearance(appearance: ScopedAppearance): ScopedAppearance {
    return { theme: appearance.theme, snippets: { ...appearance.snippets } };
}
export function clonePreset(preset: DevicePreset): DevicePreset {
    return {
        plugins: Object.fromEntries(Object.entries(preset.plugins).map(([id, state]) => [id, { ...state }])),
        ribbon: normalizeRibbon(preset.ribbon, []),
        ribbonEnabled: preset.ribbonEnabled,
        appearance: cloneAppearance(preset.appearance),
    };
}

export interface PresetExtras {
    appearance?: ScopedAppearance;
}
/** 快照当前运行设置；外观由调用方补充 / Snapshot runtime settings. */
export function snapshotPreset(settings: ManagerSettings, extras: PresetExtras = {}): DevicePreset {
    return clonePreset({
        plugins: Object.fromEntries(settings.Plugins.map(plugin => [plugin.id, { enabled: plugin.enabled, delay: plugin.delay }])),
        ribbon: settings.RIBBON_SETTINGS,
        ribbonEnabled: settings.RIBBON_MANAGER_ENABLED,
        appearance: extras.appearance ?? { theme: '', snippets: {} },
    });
}

/** 只接纳固定类型及合法字段；Narrow synced data before using it. */
export function normalizeDeviceManagement(value: unknown, baseline: DevicePreset): DeviceManagement {
    const source = isRecord(value) ? value : {};
    const rawPresets = isRecord(source.presets) ? source.presets : {};
    const presets = {} as Record<DeviceType, DevicePreset>;
    for (const type of DEVICE_TYPES) {
        const raw = rawPresets[type];
        const preset = clonePreset(baseline);
        if (isRecord(raw)) {
            if (isRecord(raw.plugins)) {
                for (const [id, state] of Object.entries(raw.plugins)) {
                    if (isRecord(state) && typeof state.enabled === 'boolean') {
                        Object.defineProperty(preset.plugins, id, { value: {
                            enabled: state.enabled, delay: typeof state.delay === 'string' ? state.delay : '',
                        }, enumerable: true, writable: true, configurable: true });
                    }
                }
            }
            if (typeof raw.ribbonEnabled === 'boolean') preset.ribbonEnabled = raw.ribbonEnabled;
            if (Array.isArray(raw.ribbon)) preset.ribbon = normalizeRibbon(raw.ribbon, preset.ribbon);
            preset.appearance = normalizeAppearance(raw.appearance, preset.appearance);
        }
        presets[type] = preset;
    }
    const devices: ManagedDevice[] = [];
    if (Array.isArray(source.devices)) {
        for (const raw of source.devices) {
            if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id || typeof raw.name !== 'string'
                || !isDeviceType(raw.type) || devices.some(device => device.id === raw.id)) continue;
            const device: ManagedDevice = { id: raw.id, name: raw.name, type: raw.type,
                lastSeen: typeof raw.lastSeen === 'number' && Number.isFinite(raw.lastSeen) ? raw.lastSeen : 0 };
            const overrides = normalizeOverride(raw.overrides, presets[raw.type]);
            if (overrides) device.overrides = overrides;
            devices.push(device);
        }
    }
    return { enabled: source.enabled === true, presets, devices };
}

function normalizeOverride(value: unknown, typePreset: DevicePreset): DeviceOverride | undefined {
    if (!isRecord(value)) return undefined;
    const overrides: DeviceOverride = {};
    if (isRecord(value.plugins)) {
        const plugins: Record<string, DevicePluginState> = {};
        for (const [id, state] of Object.entries(value.plugins)) {
            if (isRecord(state) && typeof state.enabled === 'boolean') {
                plugins[id] = { enabled: state.enabled, delay: typeof state.delay === 'string' ? state.delay : '' };
            }
        }
        overrides.plugins = plugins;
    }
    if (Array.isArray(value.ribbon)) overrides.ribbon = normalizeRibbon(value.ribbon, typePreset.ribbon);
    if (typeof value.ribbonEnabled === 'boolean') overrides.ribbonEnabled = value.ribbonEnabled;
    if (isRecord(value.appearance)) {
        overrides.appearance = {
            theme: typeof value.appearance.theme === 'string' ? value.appearance.theme : undefined,
            snippets: isRecord(value.appearance.snippets) ? recordOfBooleans(value.appearance.snippets) : undefined,
        };
    }
    return Object.keys(overrides).length ? overrides : undefined;
}

/** 类型预设与单设备覆盖合并；未被覆盖的字段继续跟随类型。 */
export function resolveScope(typePreset: DevicePreset, overrides?: DeviceOverride): DevicePreset {
    const preset = clonePreset(typePreset);
    if (!overrides) return preset;
    if (overrides.plugins) preset.plugins = { ...preset.plugins, ...cloneJson(overrides.plugins) };
    if (overrides.ribbon) preset.ribbon = normalizeRibbon(overrides.ribbon, preset.ribbon);
    if (typeof overrides.ribbonEnabled === 'boolean') preset.ribbonEnabled = overrides.ribbonEnabled;
    if (overrides.appearance) {
        preset.appearance = {
            theme: overrides.appearance.theme ?? preset.appearance.theme,
            snippets: { ...preset.appearance.snippets, ...(overrides.appearance.snippets ?? {}) },
        };
    }
    return preset;
}

/** 保留未安装插件，避免另一设备的配置被裁剪；Keep remote-only plugin choices. */
export function capturePreset(preset: DevicePreset, settings: ManagerSettings, extras: PresetExtras = {}): void {
    const snapshot = snapshotPreset(settings, extras ?? {});
    preset.plugins = { ...preset.plugins, ...snapshot.plugins };
    preset.ribbon = snapshot.ribbon;
    preset.ribbonEnabled = snapshot.ribbonEnabled;
    if (extras.appearance) preset.appearance = cloneAppearance(extras.appearance);
}

/** 共享元数据不分叉，仅投影运行设置；Project runtime settings without splitting shared metadata. */
export function applyPresetToSettings(preset: DevicePreset, settings: ManagerSettings, selfId: string): void {
    for (const plugin of settings.Plugins) {
        if (plugin.id === selfId || plugin.tags.includes('bpm-ignore')) continue;
        const state = Object.prototype.hasOwnProperty.call(preset.plugins, plugin.id) ? preset.plugins[plugin.id] : undefined;
        if (state) { plugin.enabled = state.enabled; plugin.delay = state.delay; }
    }
    settings.RIBBON_SETTINGS = clonePreset(preset).ribbon;
    settings.RIBBON_MANAGER_ENABLED = preset.ribbonEnabled;
}
