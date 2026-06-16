import { normalizePath } from "obsidian";
import type Manager from "main";

export type SharedFolderKind = "plugins" | "themes";
export type SharedVaultRole = "main" | "linked" | "mixed" | "local" | "missing";

export interface SharedVaultFolderStatus {
    kind: SharedFolderKind;
    path: string;
    exists: boolean;
    isSymlink: boolean;
    realPath?: string;
    targetPath?: string;
    itemCount: number;
    error?: string;
}

export interface SharedVaultStatus {
    id: string;
    name: string;
    path: string;
    configDir: string;
    exists: boolean;
    isCurrent: boolean;
    role: SharedVaultRole;
    plugins: SharedVaultFolderStatus;
    themes: SharedVaultFolderStatus;
    enabledPluginIds: string[];
    activeTheme: string;
}

export interface SharedVaultSnapshot {
    available: boolean;
    currentVaultPath: string;
    mainVaultPath: string;
    vaults: SharedVaultStatus[];
    error?: string;
}

export interface SharedPluginCatalogItem {
    id: string;
    name: string;
    version?: string;
    description?: string;
    folder: string;
}

export interface SharedThemeCatalogItem {
    name: string;
    folder: string;
    version?: string;
    author?: string;
}

export interface SharedVaultLinkResult {
    kind: SharedFolderKind;
    status: "linked" | "already-linked";
    sourcePath: string;
    targetPath: string;
    backupPath?: string;
}

const UNAVAILABLE_ERROR = "Shared vault filesystem features are unavailable in the community-store build.";

const cleanInputPath = (value: string): string => {
    const trimmed = (value || "").trim();
    if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
};

const unavailableFolderStatus = (kind: SharedFolderKind): SharedVaultFolderStatus => ({
    kind,
    path: "",
    exists: false,
    isSymlink: false,
    itemCount: 0,
    error: UNAVAILABLE_ERROR,
});

export const isSharedVaultFsAvailable = (): boolean => false;

export const getCurrentVaultPath = (_manager: Manager): string => "";

export const getSharedVaultFolderStatus = async (
    _vaultPathInput: string,
    kind: SharedFolderKind
): Promise<SharedVaultFolderStatus> => unavailableFolderStatus(kind);

export const resolveSharedMainVaultPath = async (_manager: Manager): Promise<string> => "";

export const setCurrentVaultAsSharedMain = async (_manager: Manager): Promise<string> => {
    throw new Error(UNAVAILABLE_ERROR);
};

export const createSharedVaultLinks = async (
    _manager: Manager,
    _targetVaultInput: string,
    _kinds: SharedFolderKind[],
    _backupExisting: boolean
): Promise<SharedVaultLinkResult[]> => {
    throw new Error(UNAVAILABLE_ERROR);
};

export const unlinkSharedVaultFolder = async (
    _manager: Manager,
    _vaultPathInput: string,
    _kind: SharedFolderKind
): Promise<void> => {
    throw new Error(UNAVAILABLE_ERROR);
};

export const getSharedVaultSnapshot = async (_manager: Manager): Promise<SharedVaultSnapshot> => ({
    available: false,
    currentVaultPath: "",
    mainVaultPath: "",
    vaults: [],
    error: UNAVAILABLE_ERROR,
});

export const readSharedPluginCatalog = async (_manager: Manager): Promise<SharedPluginCatalogItem[]> => [];

export const readSharedThemeCatalog = async (_manager: Manager): Promise<SharedThemeCatalogItem[]> => [];

export const setSharedVaultPluginEnabled = async (
    _manager: Manager,
    _vaultPathInput: string,
    _pluginId: string,
    _enabled: boolean
): Promise<void> => {
    throw new Error(UNAVAILABLE_ERROR);
};

export const setSharedVaultTheme = async (
    _manager: Manager,
    _vaultPathInput: string,
    _themeName: string
): Promise<void> => {
    throw new Error(UNAVAILABLE_ERROR);
};

export const forgetSharedVault = async (_manager: Manager, _vaultPathInput: string): Promise<void> => undefined;

export const normalizeSharedVaultInputPath = (inputPath: string): string => normalizePath(cleanInputPath(inputPath));
