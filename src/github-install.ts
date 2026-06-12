import { Notice, normalizePath, requestUrl } from "obsidian";
import type { PluginManifest, RequestUrlResponse } from "obsidian";
import Manager from "main";
import type { ManagerPlugin } from "./data/types";
import { BPM_TAG_ID } from "./repo-resolver";

/**
 * GitHub release 资源描述。
 *
 * BPM 安装插件时只关心 release asset 的文件名和下载地址：
 * - manifest.json 是 Obsidian 插件元信息。
 * - main.js 是编译后的插件入口。
 * - styles.css 是可选样式文件。
 */
interface ReleaseAsset {
	name: string;
	browser_download_url: string;
}

/**
 * GitHub releases API 的最小响应结构。
 *
 * 这里没有完整建模 GitHub API，只保留安装和版本选择需要的字段。
 */
interface ReleaseResponse {
	tag_name?: string;
	name?: string;
	body?: string;
	draft?: boolean;
	prerelease?: boolean;
	published_at?: string;
	html_url?: string;
	assets?: ReleaseAsset[];
}

/** manifest.json 中 BPM 安装流程需要读取的字段。 */
interface PluginManifestJson {
	id: string;
	name?: string;
	description?: string;
	version?: string;
}

/** 带 GitHub 状态信息的错误，方便 catch 阶段给出更准确提示。 */
interface GithubRequestError extends Error {
	status?: number;
	rateRemaining?: string;
	rateReset?: string;
}

interface PluginFiles {
	manifestText: string | null;
	mainJs: string | null;
	styles: string | null;
}

export interface ReleaseVersion {
	version: string;
	prerelease: boolean;
	name?: string;
	body?: string;
	publishedAt?: string;
	url?: string;
}

const API_BASE = "https://api.github.com";
const RELEASES_PER_PAGE = 100;
const RELEASE_VERSION_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * release 列表缓存。
 *
 * 更新检查和版本选择弹窗都可能在短时间内反复查询同一个仓库。
 * 用一个很短的内存 TTL 可以明显减少 GitHub API 请求量，同时又不会让版本信息长期陈旧。
 */
const releaseVersionCache = new Map<string, { expiresAt: number; versions: ReleaseVersion[] }>();

const getToken = async (manager: Manager): Promise<string | undefined> => manager.getGithubToken();

const buildHeaders = (token?: string, accept = "application/vnd.github+json"): Record<string, string> => {
	const headers: Record<string, string> = {
		Accept: accept,
		"User-Agent": "better-plugins-manager",
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
};

const getHeader = (headers: Record<string, string> | undefined, name: string): string | undefined => {
	if (!headers) return undefined;
	const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
	return entry?.[1];
};

/**
 * 将用户输入归一化为 GitHub 的 owner/repo 形式。
 *
 * 支持：
 * - owner/repo
 * - https://github.com/owner/repo
 * - git@github.com:owner/repo.git
 * - 带 releases/tree 等后续路径的 GitHub URL
 */
export const sanitizeRepo = (input: string): string => {
	let repo = (input || "").trim();
	repo = repo.split(/[?#]/)[0];
	repo = repo.replace(/^https?:\/\/github.com\//i, "");
	repo = repo.replace(/^git@github.com:/i, "");
	repo = repo.replace(/\.git$/i, "");
	repo = repo.replace(/\/+$/g, "");

	const parts = repo.split("/").filter(Boolean);
	return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : repo;
};

const enrichError = (res: RequestUrlResponse, msg?: string): GithubRequestError => {
	const err = new Error(msg || `GitHub request failed: ${res.status}`) as GithubRequestError;
	err.status = res.status;
	err.rateRemaining = getHeader(res.headers, "x-ratelimit-remaining");
	err.rateReset = getHeader(res.headers, "x-ratelimit-reset");
	return err;
};

/**
 * 读取 JSON 响应。
 *
 * requestUrl 默认会在 400+ 时直接 throw；这里显式设置 throw: false，
 * 让我们能保留 GitHub rate limit 等响应头，后续错误提示会更准确。
 */
const fetchJson = async <T>(url: string, token?: string): Promise<T> => {
	const res = await requestUrl({ url, headers: buildHeaders(token), throw: false });
	if (res.status >= 400) throw enrichError(res);
	return res.json as T;
};

/** 读取文本响应，主要用于下载 release asset 和 raw.githubusercontent.com 文件。 */
const fetchText = async (url: string, token?: string): Promise<string> => {
	const res = await requestUrl({ url, headers: buildHeaders(token, "*/*"), throw: false });
	if (res.status >= 400) throw enrichError(res);
	return res.text;
};

/**
 * 获取指定 release。
 *
 * version 为空时使用 latest release；不为空时按 tag 精确查找。
 * tag 中可能出现斜杠等特殊字符，所以放入 URL 前要 encodeURIComponent。
 */
const getRelease = async (repo: string, version?: string, token?: string): Promise<ReleaseResponse> => {
	const requestedVersion = version?.trim();
	const url = requestedVersion
		? `${API_BASE}/repos/${repo}/releases/tags/${encodeURIComponent(requestedVersion)}`
		: `${API_BASE}/repos/${repo}/releases/latest`;
	return fetchJson<ReleaseResponse>(url, token);
};

const pickAsset = (release: ReleaseResponse, name: string): string | null =>
	release.assets?.find((asset) => asset.name === name)?.browser_download_url ?? null;

const cloneReleaseVersions = (versions: ReleaseVersion[]): ReleaseVersion[] =>
	versions.map((version) => ({ ...version }));

const buildReleaseCacheKey = (repo: string, token?: string): string => `${repo}\n${token ? "authenticated" : "anonymous"}`;

/**
 * 生成 raw 文件候选地址。
 *
 * 许多插件 release tag 使用 v1.2.3，也有一些直接使用 1.2.3。
 * 当 release asset 不完整时，BPM 会在 tag 和 v 前缀变体之间做兜底尝试。
 */
const buildRawTagCandidates = (tag: string): string[] => {
	const candidates = [tag];
	if (tag.startsWith("v") && tag.length > 1) {
		candidates.push(tag.slice(1));
	} else {
		candidates.push(`v${tag}`);
	}
	return Array.from(new Set(candidates));
};

const fetchRawFromTag = async (repo: string, tag: string, file: string, token?: string): Promise<string> => {
	for (const candidateTag of buildRawTagCandidates(tag)) {
		try {
			return await fetchText(`https://raw.githubusercontent.com/${repo}/${candidateTag}/${file}`, token);
		} catch {
			// Try the next common tag spelling.
		}
	}
	throw new Error(`Raw file missing: ${file}`);
};

const settledValue = <T>(result: PromiseSettledResult<T | null>): T | null =>
	result.status === "fulfilled" ? result.value : null;

/**
 * 并行读取 release asset 中的插件文件。
 *
 * 原实现按 manifest -> main.js -> styles.css 顺序请求。
 * 这里改为并行请求，安装时可以少等多个网络往返；任一资源失败时返回 null，
 * 调用方再决定是否回退到 raw tag。
 */
const fetchPluginFilesFromReleaseAssets = async (release: ReleaseResponse, token?: string): Promise<PluginFiles> => {
	const manifestUrl = pickAsset(release, "manifest.json");
	const mainJsUrl = pickAsset(release, "main.js");
	const stylesUrl = pickAsset(release, "styles.css");

	const [manifestText, mainJs, styles] = await Promise.allSettled([
		manifestUrl ? fetchText(manifestUrl, token) : Promise.resolve(null),
		mainJsUrl ? fetchText(mainJsUrl, token) : Promise.resolve(null),
		stylesUrl ? fetchText(stylesUrl, token) : Promise.resolve(null),
	]);

	return {
		manifestText: settledValue(manifestText),
		mainJs: settledValue(mainJs),
		styles: settledValue(styles),
	};
};

/**
 * 从仓库 tag 的 raw 文件中补齐缺失文件。
 *
 * release asset 不完整时仍有不少仓库会在 tag 对应源码里保留 manifest.json/main.js。
 * 已经从 release asset 成功拿到的文件会直接复用，不重复下载。
 */
const fetchPluginFilesFromRawTag = async (
	repo: string,
	tag: string,
	token: string | undefined,
	current: PluginFiles
): Promise<PluginFiles> => {
	const [manifestText, mainJs, styles] = await Promise.all([
		current.manifestText ?? fetchRawFromTag(repo, tag, "manifest.json", token),
		current.mainJs ?? fetchRawFromTag(repo, tag, "main.js", token),
		current.styles ?? fetchRawFromTag(repo, tag, "styles.css", token).catch(() => null),
	]);

	return { manifestText, mainJs, styles };
};

/**
 * 更新 BPM 的单个插件记录。
 *
 * 过去安装完成后会调用 synchronizePlugins()，它会扫描全部插件并导出所有插件笔记。
 * 安装/更新 GitHub 单个插件时，只需要 upsert 当前插件记录即可，这能避免插件很多时的
 * 大量无关文件写入。
 */
const upsertInstalledPluginRecord = (
	manager: Manager,
	manifest: PluginManifestJson,
	loadedManifest: PluginManifest | undefined,
	markAsBpm: boolean
) => {
	const pluginId = manifest.id;
	const plugin = manager.settings.Plugins.find((item) => item.id === pluginId);
	const shouldHaveBpmTag = markAsBpm || manager.settings.BPM_INSTALLED.includes(pluginId);
	const nextName = loadedManifest?.name || manifest.name || pluginId;
	const nextDesc = loadedManifest?.description || manifest.description || "";

	if (plugin) {
		plugin.name = nextName;
		plugin.desc = nextDesc || plugin.desc;
		plugin.enabled = true;
		if (shouldHaveBpmTag && !plugin.tags.includes(BPM_TAG_ID)) plugin.tags.push(BPM_TAG_ID);
		manager.applySpecialPluginTags(plugin);
		return;
	}

	const record: ManagerPlugin = {
		id: pluginId,
		name: nextName,
		desc: nextDesc,
		group: "",
		tags: shouldHaveBpmTag ? [BPM_TAG_ID] : [],
		enabled: true,
		delay: "",
		note: "",
	};
	manager.applySpecialPluginTags(record);
	manager.settings.Plugins.push(record);
};

/**
 * 拉取指定仓库的 release 版本列表。
 *
 * 返回值用于下拉选择和更新检查。短 TTL 缓存可以避免用户打开弹窗、点击刷新、
 * 批量检查更新时反复打同一个 GitHub API。
 */
export const fetchReleaseVersions = async (manager: Manager, repoInput: string): Promise<ReleaseVersion[]> => {
	const repo = sanitizeRepo(repoInput);
	const token = await getToken(manager);
	const cacheKey = buildReleaseCacheKey(repo, token);
	const cached = releaseVersionCache.get(cacheKey);
	const now = Date.now();

	if (cached && cached.expiresAt > now) {
		return cloneReleaseVersions(cached.versions);
	}

	const releases: ReleaseResponse[] = [];
	for (let page = 1; ; page++) {
		const url = `${API_BASE}/repos/${repo}/releases?per_page=${RELEASES_PER_PAGE}&page=${page}`;
		const pageReleases = await fetchJson<ReleaseResponse[]>(url, token);
		if (!Array.isArray(pageReleases) || pageReleases.length === 0) break;
		releases.push(...pageReleases);
		if (pageReleases.length < RELEASES_PER_PAGE) break;
	}

	const versions = releases
		.filter((release) => !release.draft)
		.map((release) => ({
			version: release.tag_name || "",
			prerelease: Boolean(release.prerelease),
			name: release.name || undefined,
			body: release.body || undefined,
			publishedAt: release.published_at || undefined,
			url: release.html_url || undefined,
		}))
		.filter((release) => release.version);

	releaseVersionCache.set(cacheKey, {
		expiresAt: now + RELEASE_VERSION_CACHE_TTL_MS,
		versions: cloneReleaseVersions(versions),
	});

	return versions;
};

/**
 * 从 GitHub release 安装或更新 Obsidian 插件。
 *
 * 设计要点：
 * - 优先使用 release asset，因为这是 Obsidian 社区插件推荐的发布方式。
 * - 如果 asset 不完整，再回退到 tag 对应源码里的 raw manifest/main/styles。
 * - manifest/main 是必需文件，styles.css 是可选文件。
 * - 网络下载和文件写入都尽量并行，减少安装等待时间。
 * - 安装后只更新当前插件的 BPM 记录，避免触发全量插件笔记导出。
 */
export const installPluginFromGithub = async (
	manager: Manager,
	repoInput: string,
	version?: string,
	markAsBpm = true
): Promise<boolean> => {
	try {
		const repo = sanitizeRepo(repoInput);
		const token = await getToken(manager);
		const release = await getRelease(repo, version, token);
		const tag = release.tag_name || version || "";

		if (manager.settings.DEBUG) console.log("[BPM] install from GitHub", { repo, version, tag });

		let files = await fetchPluginFilesFromReleaseAssets(release, token);

		if (manager.settings.DEBUG) {
			console.log("[BPM] release assets picked", {
				manifest: Boolean(files.manifestText),
				main: Boolean(files.mainJs),
				styles: Boolean(files.styles),
			});
		}

		if (!files.manifestText || !files.mainJs) {
			if (!tag) throw new Error("未找到发布 tag，无法下载原始文件。");
			try {
				files = await fetchPluginFilesFromRawTag(repo, tag, token, files);
				if (manager.settings.DEBUG) {
					console.log("[BPM] fallback to raw tag", {
						repo,
						tag,
						manifest: Boolean(files.manifestText),
						main: Boolean(files.mainJs),
						styles: Boolean(files.styles),
					});
				}
			} catch (error) {
				console.error("[BPM] fallback to raw tag failed", error);
			}
		}

		if (!files.manifestText || !files.mainJs) {
			new Notice(manager.translator.t("安装_错误_缺少插件资源"));
			return false;
		}

		const manifest = JSON.parse(files.manifestText) as PluginManifestJson;
		if (!manifest?.id) {
			new Notice(manager.translator.t("安装_错误_manifest缺少ID"));
			return false;
		}

		if (manager.settings.DEBUG) console.log("[BPM] manifest parsed", { id: manifest.id, version: manifest.version });

		const adapter = manager.app.vault.adapter;
		const pluginDir = normalizePath(`${manager.app.vault.configDir}/plugins/${manifest.id}`);
		const pluginPath = `${pluginDir}/`;
		if (!(await adapter.exists(pluginDir))) await adapter.mkdir(pluginDir);

		if (manager.settings.DEBUG) {
			console.log("[BPM] writing files", {
				pluginDir,
				manifestSize: files.manifestText.length,
				mainSize: files.mainJs.length,
				stylesSize: files.styles?.length,
			});
		}

		const writes = [
			adapter.write(`${pluginPath}manifest.json`, files.manifestText),
			adapter.write(`${pluginPath}main.js`, files.mainJs),
		];
		if (files.styles) writes.push(adapter.write(`${pluginPath}styles.css`, files.styles));
		await Promise.all(writes);

		try {
			await manager.appPlugins.disablePlugin(manifest.id);
		} catch {
			// The plugin may not be enabled yet; enabling below is still the desired final state.
		}
		await manager.appPlugins.enablePluginAndSave(manifest.id);

		if (markAsBpm && !manager.settings.BPM_INSTALLED.includes(manifest.id)) {
			manager.settings.BPM_INSTALLED.push(manifest.id);
		}

		await manager.repoResolver.setRepo(manifest.id, repo);
		await manager.appPlugins.loadManifests();

		const loadedManifest = (manager.appPlugins.manifests as Record<string, PluginManifest | undefined>)[manifest.id];
		upsertInstalledPluginRecord(manager, manifest, loadedManifest, markAsBpm);

		if (manager.settings.DEBUG) {
			console.log("[BPM] manifest after reload", {
				id: manifest.id,
				loadedVersion: loadedManifest?.version,
				expected: manifest.version,
			});
		}

		await manager.saveSettings();

		if (manager.settings.DEBUG) console.log("[BPM] install complete", { id: manifest.id, markAsBpm });

		new Notice(manager.translator.t("安装_成功_提示", { name: manifest.name || manifest.id }));
		return true;
	} catch (error) {
		const err = error as GithubRequestError;
		console.error(error);
		if (err?.status === 403 && !manager.hasGithubToken()) {
			new Notice(manager.translator.t("安装_错误_限速"));
		} else if (err?.status === 404) {
			new Notice(manager.translator.t("安装_错误_缺少资源"));
		} else {
			new Notice(manager.translator.t("安装_错误_通用"));
		}
		return false;
	}
};

/**
 * 从 GitHub release 安装 Obsidian 主题。
 *
 * 主题安装比插件简单：manifest.json 和 theme.css 都是必需 asset。
 * 下载和写入同样使用并行流程，安装完成后调用 Obsidian 的 customCss 设置当前主题。
 */
export const installThemeFromGithub = async (manager: Manager, repoInput: string, version?: string): Promise<boolean> => {
	try {
		const repo = sanitizeRepo(repoInput);
		const token = await getToken(manager);
		const release = await getRelease(repo, version, token);

		const manifestUrl = pickAsset(release, "manifest.json");
		const themeUrl = pickAsset(release, "theme.css") ?? pickAsset(release, "themes.css") ?? pickAsset(release, "theme-beta.css");
		if (!manifestUrl || !themeUrl) {
			new Notice(manager.translator.t("安装_错误_缺少主题资源"));
			return false;
		}

		const [manifestText, themeCss] = await Promise.all([
			fetchText(manifestUrl, token),
			fetchText(themeUrl, token),
		]);

		const manifest = JSON.parse(manifestText) as { name: string };
		if (!manifest?.name) {
			new Notice(manager.translator.t("安装_错误_主题manifest缺少名称"));
			return false;
		}

		const adapter = manager.app.vault.adapter;
		const themeDir = normalizePath(`${manager.app.vault.configDir}/themes/${manifest.name}`);
		const themePath = `${themeDir}/`;
		if (!(await adapter.exists(themeDir))) await adapter.mkdir(themeDir);

		await Promise.all([
			adapter.write(`${themePath}theme.css`, themeCss),
			adapter.write(`${themePath}manifest.json`, manifestText),
		]);

		// customCss is an internal Obsidian API, so optional chaining keeps older builds safe.
		// @ts-ignore
		manager.app.customCss?.setTheme?.(manifest.name);

		new Notice(manager.translator.t("安装_主题成功_提示", { name: manifest.name }));
		return true;
	} catch (error) {
		console.error(error);
		new Notice(manager.translator.t("安装_主题错误_通用"));
		return false;
	}
};
