import { Notice, normalizePath, requestUrl } from "obsidian";
import Manager from "main";
import { BPM_TAG_ID } from "./repo-resolver";

interface ReleaseAsset {
	name: string;
	browser_download_url: string;
}

interface ReleaseResponse {
	tag_name?: string;
	assets?: ReleaseAsset[];
}

const API_BASE = "https://api.github.com";

const buildHeaders = (token?: string) => {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
};

export const sanitizeRepo = (input: string): string => {
	let repo = (input || "").trim();
	repo = repo.replace(/^https?:\/\/github.com\//i, "");
	repo = repo.replace(/^git@github.com:/i, "");
	repo = repo.replace(/\.git$/i, "");
	repo = repo.replace(/\/$/, "");
	// 只保留 owner/repo 前两段
	const parts = repo.split("/");
	if (parts.length >= 2) repo = `${parts[0]}/${parts[1]}`;
	return repo;
};

const fetchJson = async (url: string, token?: string) => {
	const res = await requestUrl({ url, headers: buildHeaders(token) });
	if (res.status >= 400) throw new Error(`GitHub request failed: ${res.status}`);
	return res.json as Record<string, unknown>;
};

const fetchText = async (url: string, token?: string) => {
	const res = await requestUrl({ url, headers: buildHeaders(token) });
	if (res.status >= 400) throw new Error(`GitHub request failed: ${res.status}`);
	return res.text;
};

const getRelease = async (repo: string, version?: string, token?: string): Promise<ReleaseResponse> => {
	const url = version && version.trim() !== ""
		? `${API_BASE}/repos/${repo}/releases/tags/${version}`
		: `${API_BASE}/repos/${repo}/releases/latest`;
	return (await fetchJson(url, token)) as ReleaseResponse;
};

const pickAsset = (release: ReleaseResponse, name: string) => release.assets?.find((a) => a.name === name)?.browser_download_url ?? null;

export interface ReleaseVersion {
	version: string;
	prerelease: boolean;
}

export const fetchReleaseVersions = async (manager: Manager, repoInput: string): Promise<ReleaseVersion[]> => {
	const repo = sanitizeRepo(repoInput);
	const token = manager.settings.GITHUB_TOKEN?.trim() || undefined;
	const url = `${API_BASE}/repos/${repo}/releases?per_page=50`;
	const releases = (await fetchJson(url, token)) as unknown as ReleaseResponse[];
	if (!Array.isArray(releases)) return [];
	return releases.map((r) => ({
		version: r.tag_name || "",
		prerelease: Boolean((r as any).prerelease),
	})).filter((r) => r.version);
};

export const installPluginFromGithub = async (manager: Manager, repoInput: string, version?: string): Promise<boolean> => {
	try {
		const repo = sanitizeRepo(repoInput);
		const token = manager.settings.GITHUB_TOKEN?.trim() || undefined;
		const release = await getRelease(repo, version, token);

		const manifestUrl = pickAsset(release, "manifest.json");
		const mainJsUrl = pickAsset(release, "main.js");
		if (!manifestUrl || !mainJsUrl) {
			new Notice("未找到 manifest.json 或 main.js 资源，请确认该仓库的发布资产。");
			return false;
		}

		const manifestText = await fetchText(manifestUrl, token);
		const manifest = JSON.parse(manifestText) as { id: string; name: string };
		if (!manifest?.id) {
			new Notice("manifest.json 缺少 id 字段，无法安装。");
			return false;
		}

		const stylesUrl = pickAsset(release, "styles.css");
		const mainJs = await fetchText(mainJsUrl, token);
		const styles = stylesUrl ? await fetchText(stylesUrl, token) : null;

		const adapter = manager.app.vault.adapter;
		const pluginDir = normalizePath(`${manager.app.vault.configDir}/plugins/${manifest.id}`);
		const pluginPath = `${pluginDir}/`;
		if (!(await adapter.exists(pluginDir))) await adapter.mkdir(pluginDir);

		await adapter.write(`${pluginPath}manifest.json`, manifestText);
		await adapter.write(`${pluginPath}main.js`, mainJs);
		if (styles) await adapter.write(`${pluginPath}styles.css`, styles);

		// 如果已安装则重载，否则加载并启用
		try {
			await manager.appPlugins.disablePlugin(manifest.id);
		} catch { /* noop */ }
		await manager.appPlugins.enablePluginAndSave(manifest.id);

		// 记录来源
		if (!manager.settings.BPM_INSTALLED.includes(manifest.id)) {
			manager.settings.BPM_INSTALLED.push(manifest.id);
		}
		await manager.repoResolver.setRepo(manifest.id, repo);
		// 刷新设置并标签
		await manager.appPlugins.loadManifests();
		manager.synchronizePlugins(Object.values(manager.appPlugins.manifests).filter((pm: any) => pm.id !== manager.manifest.id) as any);
		const mp = manager.settings.Plugins.find((p) => p.id === manifest.id);
		if (mp && !mp.tags.includes(BPM_TAG_ID)) mp.tags.push(BPM_TAG_ID);
		manager.saveSettings();
		manager.exportPluginNote(manifest.id);

		new Notice(`已安装/更新插件：${manifest.name || manifest.id}`);
		return true;
	} catch (error) {
		console.error(error);
		new Notice("安装失败，请检查仓库地址/版本或网络状态。");
		return false;
	}
};

export const installThemeFromGithub = async (manager: Manager, repoInput: string, version?: string): Promise<boolean> => {
	try {
		const repo = sanitizeRepo(repoInput);
		const token = manager.settings.GITHUB_TOKEN?.trim() || undefined;
		const release = await getRelease(repo, version, token);

		const manifestUrl = pickAsset(release, "manifest.json");
		const themeUrl = pickAsset(release, "theme.css") ?? pickAsset(release, "themes.css") ?? pickAsset(release, "theme-beta.css");
		if (!manifestUrl || !themeUrl) {
			new Notice("未找到 manifest.json 或 theme.css 资源。");
			return false;
		}

		const manifestText = await fetchText(manifestUrl, token);
		const manifest = JSON.parse(manifestText) as { name: string };
		if (!manifest?.name) {
			new Notice("主题 manifest 缺少 name 字段。");
			return false;
		}

		const themeCss = await fetchText(themeUrl, token);
		const adapter = manager.app.vault.adapter;
		const themeDir = normalizePath(`${manager.app.vault.configDir}/themes/${manifest.name}`);
		const themePath = `${themeDir}/`;
		if (!(await adapter.exists(themeDir))) await adapter.mkdir(themeDir);

		await adapter.write(`${themePath}theme.css`, themeCss);
		await adapter.write(`${themePath}manifest.json`, manifestText);

		// 应用主题
		// @ts-ignore
		manager.app.customCss?.setTheme?.(manifest.name);

		new Notice(`已安装/更新主题：${manifest.name}`);
		return true;
	} catch (error) {
		console.error(error);
		new Notice("主题安装失败，请检查仓库地址/版本或网络状态。");
		return false;
	}
};
