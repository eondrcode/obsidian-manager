import { App, ExtraButtonComponent, PluginManifest, Workspace } from "obsidian";

export type TranslationVars = Record<string, string | number | boolean | null | undefined>;

export type ExtraButtonComponentWithEl = ExtraButtonComponent & {
    extraSettingsEl?: HTMLElement;
    buttonEl?: HTMLElement;
};

export function getExtraButtonElement(button: ExtraButtonComponent): HTMLElement | undefined {
    const component = button as ExtraButtonComponentWithEl;
    return component.extraSettingsEl || component.buttonEl;
}

export type AppPluginInstanceLike = {
    manifest?: PluginManifest & {
        pluginUrl?: string;
        author2?: string;
        installLink?: string;
    };
    [key: string]: unknown;
};

export type ObsidianPluginRegistry = {
    manifests: Record<string, PluginManifest>;
    enabledPlugins: Set<string>;
    plugins?: Record<string, AppPluginInstanceLike>;
    installPlugin: (repo: string, version: string, manifest: PluginManifest | Record<string, unknown>) => Promise<void>;
    uninstallPlugin: (id: string) => Promise<void>;
    loadManifests: () => Promise<void>;
    loadPlugin: (id: string) => Promise<void>;
    enablePlugin: (id: string) => Promise<void>;
    disablePlugin: (id: string) => Promise<void>;
    enablePluginAndSave: (id: string) => Promise<void>;
    disablePluginAndSave: (id: string) => Promise<void>;
};

export type SettingTabLike = {
    searchComponent?: { inputEl: HTMLInputElement };
    updateHotkeyVisibility?: () => void;
    containerEl?: HTMLElement;
};

export type ActiveTabLike = SettingTabLike & {
    searchComponent: { inputEl: HTMLInputElement };
    updateHotkeyVisibility: () => void;
};

export type AppSettingsLike = {
    activeTab?: ActiveTabLike;
    open: () => Promise<void>;
    openTabById: (id: string) => Promise<void>;
};

export type ObsidianAppWithInternals = App & {
    plugins: ObsidianPluginRegistry;
    setting: AppSettingsLike;
    i18n?: {
        locale?: string;
        lang?: string;
        language?: string;
    };
};

export type RibbonNativeItem = {
    id?: string;
    title?: string;
    name?: string;
    ariaLabel?: string;
    icon?: string;
};

export type LeftRibbonLike = {
    items?: Array<RibbonNativeItem | null | undefined>;
};

export type WorkspaceWithRibbon = Workspace & {
    leftRibbon?: LeftRibbonLike;
};

export type VaultAdapterWithBasePath = {
    getBasePath?: () => string;
};

export type WindowWithMoment = Window & {
    moment?: {
        locale?: () => string;
    };
};
