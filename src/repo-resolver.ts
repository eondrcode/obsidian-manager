import { normalizePath, requestUrl } from "obsidian";
import Manager from "main";

export const BPM_TAG_ID = "bpm-install";
const BPM_TAG_NAME = "bpm安装";
const CACHE_FILE = "community-plugins-cache.json";
type RepoMap = Record<string, string>;

export class RepoResolver {
	private manager: Manager;
	private cacheLoaded = false;
	private cache: RepoMap = {};

	constructor(manager: Manager) {
		this.manager = manager;
	}

	private get cachePath() {
		return normalizePath(`${this.manager.app.vault.configDir}/plugins/${this.manager.manifest.id}/${CACHE_FILE}`);
	}

	private async loadCacheFromFile() {
		const adapter = this.manager.app.vault.adapter;
		if (await adapter.exists(this.cachePath)) {
			try {
				const content = await adapter.read(this.cachePath);
				this.cache = JSON.parse(content) as RepoMap;
			} catch (e) {
				console.error("加载仓库缓存失败", e);
				this.cache = {};
			}
		}
	}

	private async writeCache() {
		const adapter = this.manager.app.vault.adapter;
		try {
			await adapter.write(this.cachePath, JSON.stringify(this.cache));
		} catch (e) {
			console.error("写入仓库缓存失败", e);
		}
	}

	private async ensureCacheLoaded() {
		if (this.cacheLoaded) return;
		await this.loadCacheFromFile();
		// 合并设置中的映射
		this.cache = { ...this.cache, ...(this.manager.settings.REPO_MAP || {}) };
		this.cacheLoaded = true;
	}

	private async fetchCommunityList(): Promise<RepoMap> {
		const url = "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json";
		try {
			const res = await requestUrl({ url });
			const list = res.json as { id: string; repo: string }[];
			const map: RepoMap = {};
			list.forEach((item) => { if (item.id && item.repo) map[item.id] = item.repo; });
			this.cache = { ...this.cache, ...map };
			await this.writeCache();
			return map;
		} catch (e) {
			console.error("获取社区插件清单失败", e);
			return {};
		}
	}

	public async resolveRepo(pluginId: string): Promise<string | null> {
		await this.ensureCacheLoaded();
		const fromSettings = this.manager.settings.REPO_MAP?.[pluginId];
		if (fromSettings) return fromSettings;
		if (this.cache[pluginId]) return this.cache[pluginId];

		const remote = await this.fetchCommunityList();
		const found = remote[pluginId];
		if (found) {
			this.manager.settings.REPO_MAP[pluginId] = found;
			// 仅保存设置，避免导出时递归触发
			await this.manager.saveSettings();
			return found;
		}
		return null;
	}

	public async setRepo(pluginId: string, repo: string) {
		await this.ensureCacheLoaded();
		this.cache[pluginId] = repo;
		this.manager.settings.REPO_MAP[pluginId] = repo;
		// 仅保存设置，避免与导出互相递归
		await this.manager.saveSettings();
		await this.writeCache();
	}
}

export const ensureBpmTagExists = (manager: Manager) => {
	if (!manager.settings.TAGS.find((t) => t.id === BPM_TAG_ID)) {
		manager.settings.TAGS.push({
			id: BPM_TAG_ID,
			name: BPM_TAG_NAME,
			color: "#409EFF",
		});
	}
};
