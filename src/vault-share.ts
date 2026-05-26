import { normalizePath, PluginManifest } from "obsidian";
import type Manager from "main";
import { SharedVaultEntry } from "./data/types";

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

type NodeFs = typeof import("fs");
type NodePath = typeof import("path");

interface NodeDeps {
	fs: NodeFs;
	path: NodePath;
}

const SHARED_FOLDER_NAMES: Record<SharedFolderKind, string> = {
	plugins: "plugins",
	themes: "themes",
};

const CONFIG_DIR_NAME = ".obsidian";

const getNodeDeps = (): NodeDeps | null => {
	try {
		if (typeof require !== "function") return null;
		return {
			fs: require("fs") as NodeFs,
			path: require("path") as NodePath,
		};
	} catch {
		return null;
	}
};

export const isSharedVaultFsAvailable = (): boolean => Boolean(getNodeDeps());

const cleanInputPath = (value: string): string => {
	const trimmed = (value || "").trim();
	if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
};

const pathKey = (deps: NodeDeps, value: string): string => {
	const resolved = deps.path.resolve(value || "");
	return deps.path.sep === "\\" ? resolved.toLowerCase() : resolved;
};

const pathsEqual = (deps: NodeDeps, a?: string, b?: string): boolean => {
	if (!a || !b) return false;
	return pathKey(deps, a) === pathKey(deps, b);
};

const getVaultName = (deps: NodeDeps, vaultPath: string): string => deps.path.basename(vaultPath) || vaultPath;

const createVaultId = (deps: NodeDeps, vaultPath: string): string => {
	const key = pathKey(deps, vaultPath);
	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
	}
	return `vault-${Math.abs(hash)}`;
};

const resolveVaultPath = (deps: NodeDeps, inputPath: string): string => {
	let resolved = deps.path.resolve(cleanInputPath(inputPath));
	const baseName = deps.path.basename(resolved).toLowerCase();
	const parent = deps.path.dirname(resolved);
	const parentName = deps.path.basename(parent).toLowerCase();

	if (baseName === CONFIG_DIR_NAME) return parent;
	if ((baseName === "plugins" || baseName === "themes") && parentName === CONFIG_DIR_NAME) {
		return deps.path.dirname(parent);
	}
	return resolved;
};

const getConfigDir = (deps: NodeDeps, vaultPath: string): string => deps.path.join(vaultPath, CONFIG_DIR_NAME);

const getSharedFolderPath = (deps: NodeDeps, vaultPath: string, kind: SharedFolderKind): string =>
	deps.path.join(getConfigDir(deps, vaultPath), SHARED_FOLDER_NAMES[kind]);

const pathExists = async (fs: NodeFs, targetPath: string): Promise<boolean> => {
	try {
		await fs.promises.lstat(targetPath);
		return true;
	} catch {
		return false;
	}
};

const readJsonFile = async <T>(fs: NodeFs, filePath: string): Promise<T | null> => {
	try {
		const raw = await fs.promises.readFile(filePath, "utf8");
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
};

const writeJsonFile = async (fs: NodeFs, filePath: string, value: unknown): Promise<void> => {
	await fs.promises.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const uniq = (ids: string[]): string[] => {
	const seen = new Set<string>();
	return ids.filter((id) => {
		if (!id || seen.has(id)) return false;
		seen.add(id);
		return true;
	});
};

const readDirectoryEntries = async (fs: NodeFs, dirPath: string): Promise<string[]> => {
	try {
		return await fs.promises.readdir(dirPath);
	} catch {
		return [];
	}
};

const inferVaultPathFromSharedFolder = (deps: NodeDeps, folderPath?: string): string => {
	if (!folderPath) return "";
	const resolved = deps.path.resolve(folderPath);
	const folderName = deps.path.basename(resolved).toLowerCase();
	if (folderName !== "plugins" && folderName !== "themes") return "";
	const configDir = deps.path.dirname(resolved);
	if (deps.path.basename(configDir).toLowerCase() !== CONFIG_DIR_NAME) return "";
	return deps.path.dirname(configDir);
};

const ensureSharedVaultSettings = (manager: Manager): SharedVaultEntry[] => {
	const settings = manager.settings as unknown as { SHARED_VAULTS?: SharedVaultEntry[] };
	if (!Array.isArray(settings.SHARED_VAULTS)) settings.SHARED_VAULTS = [];
	return settings.SHARED_VAULTS;
};

const getStoredMainVaultPath = (manager: Manager, deps: NodeDeps): string => {
	const settings = manager.settings as unknown as { SHARED_VAULT_MAIN_PATH?: string };
	return settings.SHARED_VAULT_MAIN_PATH ? resolveVaultPath(deps, settings.SHARED_VAULT_MAIN_PATH) : "";
};

const setStoredMainVaultPath = (manager: Manager, deps: NodeDeps, vaultPath: string): void => {
	(manager.settings as unknown as { SHARED_VAULT_MAIN_PATH?: string }).SHARED_VAULT_MAIN_PATH = deps.path.resolve(vaultPath);
};

const upsertSharedVaultEntry = (
	manager: Manager,
	deps: NodeDeps,
	vaultPath: string,
	patch: Partial<SharedVaultEntry> = {}
): SharedVaultEntry => {
	const normalizedPath = deps.path.resolve(vaultPath);
	const entries = ensureSharedVaultSettings(manager);
	const existing = entries.find((entry) => pathsEqual(deps, entry.path, normalizedPath));
	if (existing) {
		existing.path = normalizedPath;
		existing.name = patch.name || existing.name || getVaultName(deps, normalizedPath);
		existing.pluginsLinked = patch.pluginsLinked ?? existing.pluginsLinked;
		existing.themesLinked = patch.themesLinked ?? existing.themesLinked;
		existing.lastSeenAt = patch.lastSeenAt ?? Date.now();
		return existing;
	}

	const entry: SharedVaultEntry = {
		id: createVaultId(deps, normalizedPath),
		name: patch.name || getVaultName(deps, normalizedPath),
		path: normalizedPath,
		pluginsLinked: patch.pluginsLinked,
		themesLinked: patch.themesLinked,
		createdAt: Date.now(),
		lastSeenAt: Date.now(),
	};
	entries.push(entry);
	return entry;
};

export const getCurrentVaultPath = (manager: Manager): string => {
	const deps = getNodeDeps();
	if (!deps) return "";
	const adapter = manager.app.vault.adapter as unknown as {
		getBasePath?: () => string;
		basePath?: string;
	};
	const basePath = adapter.getBasePath?.() || adapter.basePath || "";
	return basePath ? deps.path.resolve(basePath) : "";
};

export const getSharedVaultFolderStatus = async (
	vaultPathInput: string,
	kind: SharedFolderKind
): Promise<SharedVaultFolderStatus> => {
	const deps = getNodeDeps();
	if (!deps) {
		return {
			kind,
			path: "",
			exists: false,
			isSymlink: false,
			itemCount: 0,
			error: "Node file system is not available.",
		};
	}

	const vaultPath = resolveVaultPath(deps, vaultPathInput);
	const folderPath = getSharedFolderPath(deps, vaultPath, kind);
	try {
		const stats = await deps.fs.promises.lstat(folderPath);
		const isSymlink = stats.isSymbolicLink();
		let realPath = "";
		let targetPath = "";
		if (isSymlink) {
			try {
				const linkTarget = await deps.fs.promises.readlink(folderPath);
				targetPath = deps.path.isAbsolute(linkTarget)
					? linkTarget
					: deps.path.resolve(deps.path.dirname(folderPath), linkTarget);
			} catch {
				targetPath = "";
			}
		}
		try {
			realPath = await deps.fs.promises.realpath(folderPath);
		} catch {
			realPath = targetPath;
		}
		const entries = stats.isDirectory() || isSymlink ? await readDirectoryEntries(deps.fs, folderPath) : [];
		return {
			kind,
			path: folderPath,
			exists: true,
			isSymlink,
			realPath: realPath || undefined,
			targetPath: targetPath || undefined,
			itemCount: entries.length,
		};
	} catch (error) {
		return {
			kind,
			path: folderPath,
			exists: false,
			isSymlink: false,
			itemCount: 0,
			error: (error as Error)?.message,
		};
	}
};

export const resolveSharedMainVaultPath = async (manager: Manager): Promise<string> => {
	const deps = getNodeDeps();
	if (!deps) return "";

	const stored = getStoredMainVaultPath(manager, deps);
	if (stored) return stored;

	const currentVaultPath = getCurrentVaultPath(manager);
	if (!currentVaultPath) return "";

	for (const kind of ["plugins", "themes"] as SharedFolderKind[]) {
		const status = await getSharedVaultFolderStatus(currentVaultPath, kind);
		if (!status.isSymlink) continue;
		const inferred = inferVaultPathFromSharedFolder(deps, status.realPath || status.targetPath);
		if (inferred) return inferred;
	}

	return currentVaultPath;
};

export const setCurrentVaultAsSharedMain = async (manager: Manager): Promise<string> => {
	const deps = getNodeDeps();
	if (!deps) throw new Error("Node file system is not available.");
	const currentVaultPath = getCurrentVaultPath(manager);
	if (!currentVaultPath) throw new Error("Current vault path is not available.");
	const [pluginsStatus, themesStatus] = await Promise.all([
		getSharedVaultFolderStatus(currentVaultPath, "plugins"),
		getSharedVaultFolderStatus(currentVaultPath, "themes"),
	]);
	if (pluginsStatus.isSymlink || themesStatus.isSymlink) {
		throw new Error("Current vault already uses symlink folders. Open the real main vault or unlink first.");
	}

	const configDir = getConfigDir(deps, currentVaultPath);
	await deps.fs.promises.mkdir(configDir, { recursive: true });
	await deps.fs.promises.mkdir(getSharedFolderPath(deps, currentVaultPath, "plugins"), { recursive: true });
	await deps.fs.promises.mkdir(getSharedFolderPath(deps, currentVaultPath, "themes"), { recursive: true });

	setStoredMainVaultPath(manager, deps, currentVaultPath);
	upsertSharedVaultEntry(manager, deps, currentVaultPath, {
		name: getVaultName(deps, currentVaultPath),
		pluginsLinked: false,
		themesLinked: false,
	});
	await manager.saveSettings();
	return currentVaultPath;
};

const getSharedFolderSourcePath = async (manager: Manager, kind: SharedFolderKind): Promise<string> => {
	const deps = getNodeDeps();
	if (!deps) throw new Error("Node file system is not available.");

	const mainVaultPath = await resolveSharedMainVaultPath(manager);
	const sourcePath = getSharedFolderPath(deps, mainVaultPath, kind);
	if (await pathExists(deps.fs, sourcePath)) return sourcePath;

	const currentVaultPath = getCurrentVaultPath(manager);
	const currentStatus = currentVaultPath ? await getSharedVaultFolderStatus(currentVaultPath, kind) : null;
	return currentStatus?.realPath || sourcePath;
};

const createBackupName = (): string => {
	const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
	return `bpm-backup-${stamp}`;
};

export const createSharedVaultLinks = async (
	manager: Manager,
	targetVaultInput: string,
	kinds: SharedFolderKind[],
	backupExisting: boolean
): Promise<SharedVaultLinkResult[]> => {
	const deps = getNodeDeps();
	if (!deps) throw new Error("Node file system is not available.");

	const targetVaultPath = resolveVaultPath(deps, targetVaultInput);
	const currentVaultPath = getCurrentVaultPath(manager);
	const mainVaultPath = await resolveSharedMainVaultPath(manager);
	if (!targetVaultPath) throw new Error("Target vault path is empty.");
	if (pathsEqual(deps, targetVaultPath, currentVaultPath) && !pathsEqual(deps, targetVaultPath, mainVaultPath)) {
		throw new Error("Do not link the currently open vault. Set it as the main vault first.");
	}
	if (pathsEqual(deps, targetVaultPath, mainVaultPath)) {
		throw new Error("The main vault does not need to link to itself.");
	}

	const targetConfigDir = getConfigDir(deps, targetVaultPath);
	if (!(await pathExists(deps.fs, targetConfigDir))) {
		throw new Error("The target path is not an Obsidian vault because .obsidian was not found.");
	}

	const results: SharedVaultLinkResult[] = [];
	for (const kind of kinds) {
		const sourcePath = deps.path.resolve(await getSharedFolderSourcePath(manager, kind));
		await deps.fs.promises.mkdir(sourcePath, { recursive: true });

		const targetPath = getSharedFolderPath(deps, targetVaultPath, kind);
		const parentDir = deps.path.dirname(targetPath);
		await deps.fs.promises.mkdir(parentDir, { recursive: true });

		let backupPath: string | undefined;
		if (await pathExists(deps.fs, targetPath)) {
			const stats = await deps.fs.promises.lstat(targetPath);
			if (stats.isSymbolicLink()) {
				const realPath = await deps.fs.promises.realpath(targetPath).catch(() => "");
				if (pathsEqual(deps, realPath, sourcePath)) {
					results.push({ kind, status: "already-linked", sourcePath, targetPath });
					continue;
				}
				if (!backupExisting) {
					throw new Error(`${SHARED_FOLDER_NAMES[kind]} is already linked to another folder.`);
				}
				await deps.fs.promises.rmdir(targetPath);
			} else if (stats.isDirectory()) {
				const entries = await readDirectoryEntries(deps.fs, targetPath);
				if (entries.length === 0) {
					await deps.fs.promises.rmdir(targetPath);
				} else {
					if (!backupExisting) {
						throw new Error(`${SHARED_FOLDER_NAMES[kind]} already exists and is not empty.`);
					}
					backupPath = deps.path.join(parentDir, `${SHARED_FOLDER_NAMES[kind]}.${createBackupName()}`);
					await deps.fs.promises.rename(targetPath, backupPath);
				}
			} else {
				throw new Error(`${SHARED_FOLDER_NAMES[kind]} exists but is not a directory.`);
			}
		}

		await deps.fs.promises.symlink(sourcePath, targetPath, deps.path.sep === "\\" ? "junction" : "dir");
		results.push({ kind, status: "linked", sourcePath, targetPath, backupPath });
	}

	upsertSharedVaultEntry(manager, deps, targetVaultPath, {
		pluginsLinked: kinds.includes("plugins") || undefined,
		themesLinked: kinds.includes("themes") || undefined,
	});
	await manager.saveSettings();
	return results;
};

export const unlinkSharedVaultFolder = async (
	manager: Manager,
	vaultPathInput: string,
	kind: SharedFolderKind
): Promise<void> => {
	const deps = getNodeDeps();
	if (!deps) throw new Error("Node file system is not available.");

	const vaultPath = resolveVaultPath(deps, vaultPathInput);
	const folderPath = getSharedFolderPath(deps, vaultPath, kind);
	const stats = await deps.fs.promises.lstat(folderPath);
	if (!stats.isSymbolicLink()) {
		throw new Error(`${SHARED_FOLDER_NAMES[kind]} is not a symbolic link.`);
	}

	await deps.fs.promises.rmdir(folderPath);
	await deps.fs.promises.mkdir(folderPath, { recursive: true });

	const entry = ensureSharedVaultSettings(manager).find((item) => pathsEqual(deps, item.path, vaultPath));
	if (entry) {
		if (kind === "plugins") entry.pluginsLinked = false;
		if (kind === "themes") entry.themesLinked = false;
		entry.lastSeenAt = Date.now();
		await manager.saveSettings();
	}
};

const readCommunityPluginIdsFromVault = async (deps: NodeDeps, vaultPath: string): Promise<string[]> => {
	const filePath = deps.path.join(getConfigDir(deps, vaultPath), "community-plugins.json");
	const parsed = await readJsonFile<unknown>(deps.fs, filePath);
	if (!Array.isArray(parsed)) return [];
	return uniq(parsed.filter((id): id is string => typeof id === "string"));
};

const writeCommunityPluginIdsToVault = async (deps: NodeDeps, vaultPath: string, pluginIds: string[]): Promise<void> => {
	const configDir = getConfigDir(deps, vaultPath);
	await deps.fs.promises.mkdir(configDir, { recursive: true });
	await writeJsonFile(deps.fs, deps.path.join(configDir, "community-plugins.json"), uniq(pluginIds));
};

const readActiveThemeNameFromVault = async (deps: NodeDeps, vaultPath: string): Promise<string> => {
	const filePath = deps.path.join(getConfigDir(deps, vaultPath), "appearance.json");
	const parsed = await readJsonFile<Record<string, unknown>>(deps.fs, filePath);
	return typeof parsed?.cssTheme === "string" ? parsed.cssTheme : "";
};

const writeActiveThemeNameToVault = async (deps: NodeDeps, vaultPath: string, themeName: string): Promise<void> => {
	const configDir = getConfigDir(deps, vaultPath);
	await deps.fs.promises.mkdir(configDir, { recursive: true });
	const filePath = deps.path.join(configDir, "appearance.json");
	const parsed = await readJsonFile<Record<string, unknown>>(deps.fs, filePath) || {};
	if (themeName) {
		parsed.cssTheme = themeName;
	} else {
		delete parsed.cssTheme;
	}
	await writeJsonFile(deps.fs, filePath, parsed);
};

const readSharedVaultStatus = async (
	manager: Manager,
	deps: NodeDeps,
	vaultPath: string,
	currentVaultPath: string,
	mainVaultPath: string
): Promise<SharedVaultStatus> => {
	const normalizedVaultPath = deps.path.resolve(vaultPath);
	const configDir = getConfigDir(deps, normalizedVaultPath);
	const exists = await pathExists(deps.fs, configDir);
	const [plugins, themes] = await Promise.all([
		getSharedVaultFolderStatus(normalizedVaultPath, "plugins"),
		getSharedVaultFolderStatus(normalizedVaultPath, "themes"),
	]);
	const pluginSource = getSharedFolderPath(deps, mainVaultPath, "plugins");
	const themeSource = getSharedFolderPath(deps, mainVaultPath, "themes");
	const [pluginSourceReal, themeSourceReal] = await Promise.all([
		deps.fs.promises.realpath(pluginSource).catch(() => pluginSource),
		deps.fs.promises.realpath(themeSource).catch(() => themeSource),
	]);
	const pluginLinkedToMain = plugins.isSymlink && (
		pathsEqual(deps, plugins.realPath || plugins.targetPath, pluginSourceReal) ||
		pathsEqual(deps, plugins.targetPath, pluginSource)
	);
	const themeLinkedToMain = themes.isSymlink && (
		pathsEqual(deps, themes.realPath || themes.targetPath, themeSourceReal) ||
		pathsEqual(deps, themes.targetPath, themeSource)
	);
	const role: SharedVaultRole = !exists
		? "missing"
		: pathsEqual(deps, normalizedVaultPath, mainVaultPath)
			? "main"
			: pluginLinkedToMain && themeLinkedToMain
				? "linked"
				: pluginLinkedToMain || themeLinkedToMain
					? "mixed"
					: "local";

	return {
		id: createVaultId(deps, normalizedVaultPath),
		name: getVaultName(deps, normalizedVaultPath),
		path: normalizedVaultPath,
		configDir,
		exists,
		isCurrent: pathsEqual(deps, normalizedVaultPath, currentVaultPath),
		role,
		plugins,
		themes,
		enabledPluginIds: exists ? await readCommunityPluginIdsFromVault(deps, normalizedVaultPath) : [],
		activeTheme: exists ? await readActiveThemeNameFromVault(deps, normalizedVaultPath) : "",
	};
};

export const getSharedVaultSnapshot = async (manager: Manager): Promise<SharedVaultSnapshot> => {
	const deps = getNodeDeps();
	if (!deps) {
		return {
			available: false,
			currentVaultPath: "",
			mainVaultPath: "",
			vaults: [],
			error: "Node file system is not available.",
		};
	}

	const currentVaultPath = getCurrentVaultPath(manager);
	if (!currentVaultPath) {
		return {
			available: false,
			currentVaultPath: "",
			mainVaultPath: "",
			vaults: [],
			error: "Current vault path is not available.",
		};
	}

	const mainVaultPath = await resolveSharedMainVaultPath(manager);
	const vaultMap = new Map<string, string>();
	const addVault = (vaultPath?: string) => {
		if (!vaultPath) return;
		const resolved = resolveVaultPath(deps, vaultPath);
		vaultMap.set(pathKey(deps, resolved), resolved);
	};

	addVault(currentVaultPath);
	addVault(mainVaultPath);
	for (const entry of ensureSharedVaultSettings(manager)) {
		addVault(entry.path);
	}

	const vaults: SharedVaultStatus[] = [];
	for (const vaultPath of vaultMap.values()) {
		vaults.push(await readSharedVaultStatus(manager, deps, vaultPath, currentVaultPath, mainVaultPath));
	}

	vaults.sort((a, b) => {
		if (a.role === "main" && b.role !== "main") return -1;
		if (b.role === "main" && a.role !== "main") return 1;
		if (a.isCurrent && !b.isCurrent) return -1;
		if (b.isCurrent && !a.isCurrent) return 1;
		return a.name.localeCompare(b.name);
	});

	return {
		available: true,
		currentVaultPath,
		mainVaultPath,
		vaults,
	};
};

export const readSharedPluginCatalog = async (manager: Manager): Promise<SharedPluginCatalogItem[]> => {
	const deps = getNodeDeps();
	if (!deps) return [];
	const sourcePath = await getSharedFolderSourcePath(manager, "plugins");
	const entries = await deps.fs.promises.readdir(sourcePath, { withFileTypes: true }).catch(() => []);
	const plugins: SharedPluginCatalogItem[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const manifest = await readJsonFile<PluginManifest>(deps.fs, deps.path.join(sourcePath, entry.name, "manifest.json"));
		if (!manifest?.id) continue;
		plugins.push({
			id: manifest.id,
			name: manifest.name || manifest.id,
			version: manifest.version,
			description: manifest.description,
			folder: entry.name,
		});
	}

	return plugins.sort((a, b) => a.name.localeCompare(b.name));
};

export const readSharedThemeCatalog = async (manager: Manager): Promise<SharedThemeCatalogItem[]> => {
	const deps = getNodeDeps();
	if (!deps) return [];
	const sourcePath = await getSharedFolderSourcePath(manager, "themes");
	const entries = await deps.fs.promises.readdir(sourcePath, { withFileTypes: true }).catch(() => []);
	const themes: SharedThemeCatalogItem[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const manifest = await readJsonFile<{ name?: string; version?: string; author?: string }>(
			deps.fs,
			deps.path.join(sourcePath, entry.name, "manifest.json")
		);
		themes.push({
			name: manifest?.name || entry.name,
			folder: entry.name,
			version: manifest?.version,
			author: manifest?.author,
		});
	}

	return themes.sort((a, b) => a.name.localeCompare(b.name));
};

export const setSharedVaultPluginEnabled = async (
	manager: Manager,
	vaultPathInput: string,
	pluginId: string,
	enabled: boolean
): Promise<void> => {
	const deps = getNodeDeps();
	if (!deps) throw new Error("Node file system is not available.");
	const vaultPath = resolveVaultPath(deps, vaultPathInput);
	const currentVaultPath = getCurrentVaultPath(manager);
	if (pathsEqual(deps, vaultPath, currentVaultPath)) {
		if (pluginId === manager.manifest.id && !enabled) throw new Error("BPM cannot disable itself.");
		const record = manager.settings.Plugins.find((plugin) => plugin.id === pluginId);
		if (manager.settings.DELAY) {
			if (enabled) {
				await manager.appPlugins.enablePlugin(pluginId);
			} else {
				await manager.appPlugins.disablePlugin(pluginId);
			}
		} else if (enabled) {
			await manager.appPlugins.enablePluginAndSave(pluginId);
		} else {
			await manager.appPlugins.disablePluginAndSave(pluginId);
		}
		if (record) record.enabled = enabled;
		await manager.savePluginAndExport(pluginId);
		return;
	}

	const current = await readCommunityPluginIdsFromVault(deps, vaultPath);
	const next = enabled
		? uniq([...current, pluginId])
		: current.filter((id) => id !== pluginId);
	await writeCommunityPluginIdsToVault(deps, vaultPath, next);
};

export const setSharedVaultTheme = async (
	manager: Manager,
	vaultPathInput: string,
	themeName: string
): Promise<void> => {
	const deps = getNodeDeps();
	if (!deps) throw new Error("Node file system is not available.");
	const vaultPath = resolveVaultPath(deps, vaultPathInput);
	const currentVaultPath = getCurrentVaultPath(manager);
	if (pathsEqual(deps, vaultPath, currentVaultPath)) {
		(manager.app as unknown as { customCss?: { setTheme?: (name: string) => void } }).customCss?.setTheme?.(themeName);
	}
	await writeActiveThemeNameToVault(deps, vaultPath, themeName);
};

export const forgetSharedVault = async (manager: Manager, vaultPathInput: string): Promise<void> => {
	const deps = getNodeDeps();
	if (!deps) return;
	const vaultPath = resolveVaultPath(deps, vaultPathInput);
	const currentVaultPath = getCurrentVaultPath(manager);
	const mainVaultPath = await resolveSharedMainVaultPath(manager);
	if (pathsEqual(deps, vaultPath, currentVaultPath) || pathsEqual(deps, vaultPath, mainVaultPath)) return;
	const entries = ensureSharedVaultSettings(manager);
	(manager.settings as unknown as { SHARED_VAULTS?: SharedVaultEntry[] }).SHARED_VAULTS = entries.filter((entry) => !pathsEqual(deps, entry.path, vaultPath));
	await manager.saveSettings();
};

export const normalizeSharedVaultInputPath = (inputPath: string): string => {
	const deps = getNodeDeps();
	return deps ? resolveVaultPath(deps, inputPath) : normalizePath(cleanInputPath(inputPath));
};
