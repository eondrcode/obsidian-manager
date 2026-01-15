import { ObsidianProtocolData, Plugin, PluginManifest, Workspace } from 'obsidian';
import { DEFAULT_SETTINGS, ManagerSettings } from './settings/data';
import { ManagerSettingTab } from './settings';
import { Translator } from './lang/inxdex';
import { ManagerModal } from './modal/manager-modal';
import Commands from './command';
import Agreement from 'src/agreement';
import { RepoResolver, ensureBpmTagExists, BPM_TAG_ID } from './repo-resolver';
import { normalizePath, TFile, stringifyYaml, parseYaml, EventRef, Notice, Platform, requestUrl } from 'obsidian';
import { ManagerPlugin, BPM_IGNORE_TAG } from './data/types';
import { runMigrations } from './migrations';
import { fetchReleaseVersions, installPluginFromGithub, ReleaseVersion, sanitizeRepo } from './github-install';
import { performSelfCheck } from './self-check';

type UpdateSource = 'official' | 'github' | 'unknown';
interface UpdateStatus {
    source: UpdateSource;
    localVersion?: string;
    remoteVersion?: string | null;
    hasUpdate?: boolean;
    message?: string;
    error?: string;
    checkedAt?: number;
    repo?: string | null;
    versions?: ReleaseVersion[];
}

export default class Manager extends Plugin {
    public settings: ManagerSettings;
    public managerModal: ManagerModal;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public appPlugins: any;
    public appWorkspace: Workspace;
    public translator: Translator;

    public agreement: Agreement;
    public repoResolver: RepoResolver;
    private exportWatcher: EventRef | null = null;
    private exportWatcherPaused = false;
    private exportWriting = false;
    private toggleNotice: Notice | null = null;
    public updateStatus: Record<string, UpdateStatus> = {};
    private updateProgressNotice: Notice | null = null;

    public async onload() {
        // @ts-ignore
        this.appPlugins = this.app.plugins;
        this.appWorkspace = this.app.workspace;

        console.log(`%c ${this.manifest.name} %c v${this.manifest.version} `, `padding: 2px; border-radius: 2px 0 0 2px; color: #fff; background: #5B5B5B;`, `padding: 2px; border-radius: 0 2px 2px 0; color: #fff; background: #409EFF;`);
        await this.loadSettings();
        await runMigrations(this);
        // 首次安装或未设置语言时，自动跟随 Obsidian 语言
        if (!this.settings.LANGUAGE_INITIALIZED || !this.settings.LANGUAGE) {
            this.settings.LANGUAGE = this.getAppLanguage();
            this.settings.LANGUAGE_INITIALIZED = true;
            await this.saveSettings();
        }
        // 初始化语言系统
        this.translator = new Translator(this);
        ensureBpmTagExists(this);
        this.ensureBpmTagAndRecords();
        this.ensureSelfPluginRecord();

        // 确保 BPM Ignore 标签存在
        if (!this.settings.TAGS.some(t => t.id === BPM_IGNORE_TAG)) {
            this.settings.TAGS.push({
                id: BPM_IGNORE_TAG,
                name: this.translator.t("标签_BPM忽略_名称") || "BPM Ignored",
                color: "#6c757d" // 灰色
            });
            await this.saveSettings();
        }

        this.repoResolver = new RepoResolver(this);
        // 初始化侧边栏图标
        this.addRibbonIcon('folder-cog', this.translator.t('通用_管理器_文本'), () => { this.managerModal = new ManagerModal(this.app, this); this.managerModal.open(); });
        // 初始化设置界面
        this.addSettingTab(new ManagerSettingTab(this.app, this));
        this.settings.DELAY ? this.enableDelay() : this.disableDelay();
        Commands(this.app, this);

        this.agreement = new Agreement(this);
        this.setupExportWatcher();
        if (this.settings.EXPORT_DIR) this.exportAllPluginNotes();
        this.startupCheckForUpdates();

        this.registerObsidianProtocolHandler("BPM-plugin-install", async (params: ObsidianProtocolData) => {
            await this.agreement.parsePluginInstall(params);
        });
        this.registerObsidianProtocolHandler("BPM-plugin-github", async (params: ObsidianProtocolData) => {
            await this.agreement.parsePluginGithub(params);
        });

        this.app.workspace.onLayoutReady(() => {
            this.updateRibbonStyles();
            if (Platform.isMobile) {
                this.setupMenuObserver();
            }
            // 延迟启动自检，确保 Obsidian 初始化完成，避免自动接管被覆盖
            setTimeout(() => {
                performSelfCheck(this);
            }, 2000);
        });
    }

    public async onunload() {
        if (this.settings.DELAY) this.disableDelaysForAllPlugins();
        if (this.exportWatcher) this.app.vault.offref(this.exportWatcher);
        if (this.menuObserver) {
            this.menuObserver.disconnect();
        }
    }

    public async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    public async saveSettings() { await this.saveData(this.settings); }

    // 保存并同步单个插件到导出笔记
    public async savePluginAndExport(pluginId: string) {
        await this.saveSettings();
        await this.exportPluginNote(pluginId);
    }

    public showUpdateProgress(total: number): { dispose: () => void; update: (processed: number, currentId?: string) => void; cancel: () => void; isCancelled: () => boolean } {
        if (this.updateProgressNotice) this.updateProgressNotice.hide();
        const notice = new Notice("", 0);
        notice.noticeEl.empty();
        const wrap = document.createElement("div");
        wrap.addClass("bpm-update-progress");
        const text = document.createElement("div");
        text.setText(this.translator.t("通知_检测更新中文案"));
        const sub = document.createElement("div");
        sub.addClass("bpm-update-progress__sub");
        const bar = document.createElement("div");
        bar.addClass("bpm-progress");
        const fill = document.createElement("div");
        fill.addClass("bpm-progress__bar");
        bar.appendChild(fill);
        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = this.translator.t("通用_取消_文本") || "Cancel";
        cancelBtn.addClass("bpm-progress__cancel");
        let processed = 0;
        let cancelled = false;
        cancelBtn.onclick = () => { cancelled = true; };
        const update = (p: number, currentId?: string) => {
            processed = p;
            const ratio = total > 0 ? Math.min(1, processed / total) : 0;
            fill.style.width = `${ratio * 100}%`;
            sub.setText(`${processed}/${total}${currentId ? ` · ${currentId}` : ""}`);
        };
        wrap.appendChild(text);
        wrap.appendChild(sub);
        wrap.appendChild(bar);
        wrap.appendChild(cancelBtn);
        notice.noticeEl.appendChild(wrap);
        this.updateProgressNotice = notice;
        return {
            dispose: () => {
                notice.hide();
                if (this.updateProgressNotice === notice) this.updateProgressNotice = null;
            },
            update,
            cancel: () => { cancelled = true; },
            isCancelled: () => cancelled
        };
    }

    public async checkUpdatesWithNotice(): Promise<Record<string, UpdateStatus>> {
        const manifests = Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manifest.id) as PluginManifest[];
        const progress = this.showUpdateProgress(manifests.length);
        let processed = 0;
        try {
            const res = await this.checkUpdates({
                onProgress: (id?: string) => {
                    processed++;
                    progress.update(processed, id);
                },
                isCancelled: () => progress.isCancelled()
            });
            return res;
        } finally {
            progress.dispose();
        }
    }

    private async startupCheckForUpdates() {
        if (!this.settings.STARTUP_CHECK_UPDATES) return;
        try {
            const manifests = Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manifest.id) as PluginManifest[];
            const progress = this.showUpdateProgress(manifests.length);
            let processed = 0;
            const status = await this.checkUpdates({
                onProgress: () => { processed++; progress.update(processed); },
                isCancelled: () => progress.isCancelled()
            });
            const count = Object.values(status || {}).filter(s => s.hasUpdate).length;
            if (count > 0) {
                const msg = this.translator.t("通知_可更新数量").replace("{count}", `${count}`);
                new Notice(msg, 5000);
            }
            progress.dispose();
        } catch (e) {
            if (this.settings.DEBUG) console.error("[BPM] startup check updates failed", e);
            if (!this.settings.GITHUB_TOKEN) {
                new Notice(this.translator.t("通知_检查更新失败_建议Token"));
            }
        }
    }

    public ensureBpmTagAndRecords() {
        ensureBpmTagExists(this);
        // 确保 BPM 安装的插件拥有标签
        this.settings.BPM_INSTALLED.forEach((id) => {
            const mp = this.settings.Plugins.find(p => p.id === id);
            if (mp && !mp.tags.includes(BPM_TAG_ID)) mp.tags.push(BPM_TAG_ID);
        });
    }

    public getExportDir(): string | null {
        if (!this.settings.EXPORT_DIR) return null;
        return normalizePath(this.settings.EXPORT_DIR);
    }

    public pauseExportWatcher() {
        if (this.exportWatcher) {
            this.app.vault.offref(this.exportWatcher);
            this.exportWatcher = null;
        }
        this.exportWatcherPaused = true;
    }

    public resumeExportWatcher() {
        if (!this.settings.EXPORT_DIR) {
            this.exportWatcherPaused = false;
            return;
        }
        // 仅在曾暂停时重新挂载，避免重复注册
        if (this.exportWatcherPaused) {
            this.setupExportWatcher();
        }
        this.exportWatcherPaused = false;
    }

    public setupExportWatcher() {
        if (this.exportWatcher) this.app.vault.offref(this.exportWatcher);
        const dir = this.settings.EXPORT_DIR;
        if (!dir) return;
        this.exportWatcher = this.app.vault.on("modify", async (file) => { await this.handleExportedFileChange(file as TFile); });
        this.registerEvent(this.exportWatcher);
    }

    private async handleExportedFileChange(file: TFile) {
        if (this.exportWriting) return;
        const exportDir = this.settings.EXPORT_DIR;
        if (!exportDir) return;
        if (!file.path.endsWith(".md")) return;
        const normalized = normalizePath(file.path);
        if (!normalized.startsWith(normalizePath(exportDir) + "/") && normalizePath(exportDir) !== normalized) return;
        try {
            const content = await this.app.vault.read(file);
            const { frontmatter } = this.parseFrontmatter(content);
            if (!frontmatter || !frontmatter["bpm_ro_id"]) return;
            const id = String(frontmatter["bpm_ro_id"]);
            const mp = this.settings.Plugins.find(p => p.id === id);
            if (!mp) return;
            const safe = (key: string) => frontmatter[key];
            mp.desc = safe("bpm_rw_desc") ?? mp.desc;
            mp.note = safe("bpm_rw_note") ?? mp.note;
            if (typeof safe("bpm_rw_enabled") === "boolean") {
                const targetEnabled = safe("bpm_rw_enabled") as boolean;
                mp.enabled = targetEnabled;
                if (id !== this.manifest.id) {
                    const isEnabled = this.appPlugins.enabledPlugins.has(id);
                    if (targetEnabled !== isEnabled) {
                        this.showToggleNotice();
                        try {
                            if (targetEnabled) {
                                await this.appPlugins.enablePluginAndSave(id);
                            } else {
                                await this.appPlugins.disablePluginAndSave(id);
                            }
                        } catch (e) {
                            console.error("同步启用/禁用插件失败", e);
                        } finally {
                            this.hideToggleNotice();
                        }
                    }
                }
            }
            // 条件可写 repo：仅非 BPM 安装且当前无官方映射
            const repo = safe("bpm_rwc_repo");
            const allowRepo = !this.settings.BPM_INSTALLED.includes(id) && !this.settings.REPO_MAP[id];
            if (repo && allowRepo) {
                this.settings.REPO_MAP[id] = repo;
            }
            await this.saveSettings();
            this.reloadIfCurrentModal();
        } catch (e) {
            console.error("同步导入 BPM 笔记失败", e);
        }
    }

    private parseFrontmatter(content: string): { frontmatter: any, body: string } {
        if (!content.startsWith("---")) return { frontmatter: null, body: content };
        const end = content.indexOf("\n---", 3);
        if (end === -1) return { frontmatter: null, body: content };
        const raw = content.slice(3, end).trim();
        let fm: any = null;
        try { fm = parseYaml(raw); } catch { fm = null; }
        const body = content.slice(end + 4);
        return { frontmatter: fm, body };
    }

    public async exportAllPluginNotes() {
        if (!this.settings.EXPORT_DIR) return;
        for (const plugin of this.settings.Plugins) {
            await this.exportPluginNote(plugin.id);
        }
    }

    public async exportPluginNote(pluginId: string) {
        if (!this.settings.EXPORT_DIR) return;
        const mp = this.settings.Plugins.find(p => p.id === pluginId);
        if (!mp) return;
        const dir = this.getExportDir();
        if (!dir) return;
        try {
            const adapter = this.app.vault.adapter;
            const vaultRelativeDir = normalizePath(this.settings.EXPORT_DIR);
            if (!(await adapter.exists(vaultRelativeDir))) {
                await adapter.mkdir(vaultRelativeDir);
            }
            const targetPath = await this.resolveExportPath(mp, vaultRelativeDir);
            let body = `\n\n${this.translator.t('导出_正文提示')}`;
            let existingFrontmatter: Record<string, any> | null = null;
            let existingContent: string | null = null;
            if (await adapter.exists(targetPath)) {
                const old = await adapter.read(targetPath);
                existingContent = old;
                const parsed = this.parseFrontmatter(old);
                existingFrontmatter = parsed.frontmatter ?? null;
                body = parsed.body || body;
            }
            // 解析 repo 映射（官方清单 / BPM 安装 / 手动设置）
            let repo = this.settings.REPO_MAP[mp.id] || "";
            try {
                const resolved = await this.repoResolver.resolveRepo(mp.id);
                if (resolved) repo = resolved;
            } catch (e) {
                console.error("解析仓库映射失败", e);
            }
            const bpmFrontmatter: Record<string, any> = {
                "bpm_ro_id": mp.id,
                "bpm_ro_name": mp.name,
                "bpm_rw_desc": mp.desc,
                "bpm_rw_note": mp.note,
                "bpm_rw_enabled": mp.enabled,
                "bpm_rwc_repo": repo,
                "bpm_ro_group": mp.group,
                "bpm_ro_tags": mp.tags,
                "bpm_ro_delay": mp.delay,
                "bpm_ro_installed_via_bpm": this.settings.BPM_INSTALLED.includes(mp.id),
            };
            // 保留用户自定义 frontmatter（非 bpm_*），仅更新 bpm_* 字段
            const kept = Object.fromEntries(Object.entries(existingFrontmatter ?? {}).filter(([k]) => !k.startsWith("bpm_")));
            const frontmatter: Record<string, any> = { ...bpmFrontmatter, ...kept };

            const yaml = stringifyYaml(frontmatter).trimEnd();
            const content = `---\n${yaml}\n---${body.startsWith("\n") ? "" : "\n"}${body}`;

            // 只有当内容确实发生变化时才写入，避免频繁触发文件更新/同步
            if (existingContent !== null && existingContent === content) return;
            this.exportWriting = true;
            await adapter.write(targetPath, content);
        } catch (e) {
            console.error("导出 BPM 笔记失败", e);
        } finally {
            this.exportWriting = false;
        }
    }

    // 确保 BPM 自身也存在于插件记录中（用于面板显示与导出）
    public ensureSelfPluginRecord() {
        const id = this.manifest.id;
        const existing = this.settings.Plugins.find(p => p.id === id);
        if (this.settings.HIDES?.includes(id)) {
            this.settings.HIDES = this.settings.HIDES.filter(x => x !== id);
        }
        if (!existing) {
            this.settings.Plugins.push({
                id,
                name: this.manifest.name,
                desc: this.manifest.description,
                group: "",
                tags: [],
                enabled: true,
                delay: "",
                note: "",
            });
            this.saveSettings();
            this.exportAllPluginNotes();
            return;
        }
        existing.name = existing.name || this.manifest.name;
        existing.desc = existing.desc || this.manifest.description;
        existing.enabled = true;
        existing.delay = "";
    }

    private reloadIfCurrentModal() {
        try { this.managerModal?.reloadShowData(); } catch { /* ignore */ }
    }

    private showToggleNotice() {
        if (this.toggleNotice) return;
        this.toggleNotice = new Notice("正在应用更改，请勿频繁操作。", 3000);
    }

    private hideToggleNotice() {
        if (this.toggleNotice) {
            this.toggleNotice.hide();
            this.toggleNotice = null;
        }
    }

    private exportFileName(mp: ManagerPlugin): string {
        const base = (mp.name || mp.id || "plugin").trim();
        const safe = base.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ");
        return safe || "plugin";
    }

    // 查找/重命名导出文件：优先按 frontmatter 中的 bpm_ro_id 匹配，必要时将旧文件名重命名为当前 name
    private async resolveExportPath(mp: ManagerPlugin, vaultRelativeDir: string): Promise<string> {
        const adapter = this.app.vault.adapter;
        const normalizedDir = normalizePath(vaultRelativeDir);
        const desired = normalizePath(`${normalizedDir}/${this.exportFileName(mp)}.md`);

        // 1) 在导出目录内按 frontmatter 查找
        const files = this.app.vault.getMarkdownFiles().filter(f => {
            const p = normalizePath(f.path);
            return p === normalizedDir || p.startsWith(normalizedDir + "/");
        });
        for (const f of files) {
            try {
                const content = await this.app.vault.read(f);
                const { frontmatter } = this.parseFrontmatter(content);
                if (frontmatter?.["bpm_ro_id"] === mp.id) {
                    const currentPath = normalizePath(f.path);
                    if (currentPath !== desired) {
                        // 如果目标不存在，则重命名以保持文件名与 name 一致
                        if (!(await adapter.exists(desired))) {
                            await adapter.rename(currentPath, desired);
                            return desired;
                        }
                        return currentPath;
                    }
                    return currentPath;
                }
            } catch {
                // ignore parse errors
            }
        }

        // 2) 如果目标路径已存在，直接使用
        if (await adapter.exists(desired)) return desired;

        // 3) 回退：如果存在基于 id 的旧文件名，复用它并重命名到当前 desired
        const legacyById = normalizePath(`${normalizedDir}/${(mp.id || "plugin").replace(/[/\\?%*:|"<>]/g, "-") || "plugin"}.md`);
        if (await adapter.exists(legacyById)) {
            if (!(await adapter.exists(desired))) {
                await adapter.rename(legacyById, desired);
                return desired;
            }
            return legacyById;
        }

        // 4) 默认使用当前 name 生成的路径
        return desired;
    }

    // 关闭延时 调用
    public disableDelay() {
        const plugins = Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manifest.id) as PluginManifest[];
        this.synchronizePlugins(plugins);
    }

    // 开启延时 调用
    public enableDelay() {
        const plugins = Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manifest.id) as PluginManifest[];
        // 同步插件
        this.synchronizePlugins(plugins);
        // 开始延时启动插件
        plugins.forEach((plugin: PluginManifest) => this.startPluginWithDelay(plugin.id));
    }

    // 为所有插件启动延迟
    public enableDelaysForAllPlugins() {
        // 获取所有插件
        const plugins = Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manifest.id) as PluginManifest[];
        // 同步插件
        this.synchronizePlugins(plugins);

        plugins.forEach(async (plugin: PluginManifest) => {
            // 插件状态
            const isEnabled = this.appPlugins.enabledPlugins.has(plugin.id);
            if (isEnabled) {
                // 1. 关闭插件
                await this.appPlugins.disablePluginAndSave(plugin.id);
                // 2. 开启插件
                await this.appPlugins.enablePlugin(plugin.id);
                // 3. 切换配置状态
                const mp = this.settings.Plugins.find(p => p.id === plugin.id);
                if (mp) mp.enabled = true;
                // 4. 保存状态
                this.saveSettings();
            } else {
                // 1. 切换配置文件
                const mp = this.settings.Plugins.find(p => p.id === plugin.id);
                if (mp) mp.enabled = false;
                // 2. 保存状态
                this.saveSettings();
            }
        });
    }

    // 为所有插件关闭延迟
    public disableDelaysForAllPlugins() {
        const plugins = Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manifest.id);
        plugins.forEach(async (pm: PluginManifest) => {
            const plugin = this.settings.Plugins.find(p => p.id === pm.id)
            if (plugin) {
                if (plugin.enabled) {
                    await this.appPlugins.disablePlugin(pm.id);
                    await this.appPlugins.enablePluginAndSave(pm.id);
                }
            }
        });
    }

    // 延时启动指定插件
    private startPluginWithDelay(id: string) {
        if (id === this.manifest.id) return;
        const plugin = this.settings.Plugins.find(p => p.id === id);
        if (plugin && plugin.enabled) {
            const delay = this.settings.DELAYS.find(item => item.id === plugin.delay);
            const time = delay ? delay.time : 0;
            setTimeout(() => { this.appPlugins.enablePlugin(id); }, time * 1000);
        }
    }

    // 同步插件到配置文件
    public synchronizePlugins(p1: PluginManifest[]) {
        const p2 = this.settings.Plugins;
        p2.forEach(p2Item => {
            if (p2Item.id === this.manifest.id) return;
            if (!p1.some(p1Item => p1Item.id === p2Item.id)) {
                this.settings.Plugins = this.settings.Plugins.filter(pm => pm.id !== p2Item.id);
            }
        });
        p1.forEach(p1Item => {
            if (!p2.some(p2Item => p2Item.id === p1Item.id)) {
                const isEnabled = this.appPlugins.enabledPlugins.has(p1Item.id);
                this.settings.Plugins.push({
                    'id': p1Item.id,
                    'name': p1Item.name,
                    'desc': p1Item.description,
                    'group': '',
                    'tags': [],
                    'enabled': isEnabled,
                    'delay': '',
                    'note': ''
                });
            }
            const mp = this.settings.Plugins.find(pm => pm.id === p1Item.id);
            if (mp && this.settings.BPM_INSTALLED.includes(p1Item.id) && !mp.tags.includes(BPM_TAG_ID)) {
                mp.tags.push(BPM_TAG_ID);
            }
        });
        // BPM 自身保持启用且不允许延迟
        this.ensureSelfPluginRecord();
        // 保存设置
        this.saveSettings();
        this.exportAllPluginNotes();
    }

    // 工具函数
    public createTag(text: string, color: string, type: string) {
        const style = this.generateTagStyle(color, type);
        const tag = createEl('span', {
            text: text,
            cls: 'manager-tag',
            attr: { 'style': style }
        })
        return tag;
    }
    public generateTagStyle(color: string, type: string) {
        let style;
        const [r, g, b] = this.hexToRgbArray(color);
        switch (type) {
            case 'a':
                style = `color: #fff; background-color: ${color}; border-color: ${color};`;
                break;
            case 'b':
                style = `color: ${color}; background-color: transparent; border-color: ${color};`;
                break;
            case 'c':
                style = `color: ${color}; background-color: rgba(${r}, ${g}, ${b}, 0.3); border-color: ${color};`;
                break;
            case 'd':
                style = `color: ${color}; background-color: ${this.adjustColorBrightness(color, 50)}; border-color: ${this.adjustColorBrightness(color, 50)};`;
                break;
            default:
                style = `background-color: transparent;border-style: dashed;`;
        }
        return style;
    }
    public hexToRgbArray(hex: string) {
        const rgb = parseInt(hex.slice(1), 16);
        const r = (rgb >> 16);
        const g = ((rgb >> 8) & 0x00FF);
        const b = (rgb & 0x0000FF);
        return [r, g, b];
    }
    public adjustColorBrightness(hex: string, amount: number) {
        const rgb = parseInt(hex.slice(1), 16);
        const r = Math.min(255, Math.max(0, ((rgb >> 16) & 0xFF) + amount));
        const g = Math.min(255, Math.max(0, ((rgb >> 8) & 0xFF) + amount));
        const b = Math.min(255, Math.max(0, (rgb & 0xFF) + amount));
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
    }

    // 获取 Obsidian 当前语言（兼容旧版类型定义）
    public getAppLanguage(): string {
        // 优先使用 app.i18n.locale / language
        // @ts-ignore
        const anyApp = this.app as any;
        const langCandidates: (string | undefined)[] = [
            anyApp?.i18n?.locale,
            anyApp?.i18n?.lang,
            anyApp?.i18n?.language,
            (window as any)?.moment?.locale?.(),
            (navigator as any)?.language,
        ];
        const picked = langCandidates.find((l) => typeof l === "string" && l.length > 0) || "en";
        const lower = picked.toLowerCase().replace('_', '-');
        const map: Record<string, string> = {
            'en': 'en',
            'en-gb': 'en',
            'zh': 'zh-cn',
            'zh-cn': 'zh-cn',
            'zh-tw': 'zh-cn',
            'ru': 'ru',
            'ja': 'ja',
            'ko': 'ko',
            'fr': 'fr',
            'es': 'es',
        };
        return map[lower] || map[lower.split('-')[0]] || 'en';
    }

    // 版本比较：>0 表示 a>b
    private compareVersions(a: string = "0.0.0", b: string = "0.0.0"): number {
        const pa = a.split(".").map(Number);
        const pb = b.split(".").map(Number);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
            const ai = pa[i] || 0;
            const bi = pb[i] || 0;
            if (ai > bi) return 1;
            if (ai < bi) return -1;
        }
        return 0;
    }

    // 检测插件更新：官方 + GitHub（BPM 或用户指定仓库）
    public async checkUpdates(opts?: { onProgress?: (id?: string) => void; isCancelled?: () => boolean }): Promise<Record<string, UpdateStatus>> {
        const manifests = Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manifest.id) as PluginManifest[];
        const officialMap = await this.fetchOfficialStats();
        const statusMap: Record<string, UpdateStatus> = {};

        if (this.settings.DEBUG) console.log("[BPM] checkUpdates start, total manifests:", manifests.length);
        for (const pm of manifests) {
            if (opts?.isCancelled?.()) break;
            const localVersion = pm.version || "0.0.0";
            const st: UpdateStatus = { source: 'unknown', localVersion, checkedAt: Date.now() };
            try {
                // 1) 官方来源
                const official = officialMap[pm.id];
                if (official) {
                    st.source = 'official';
                    st.remoteVersion = official;
                    st.repo = await this.repoResolver.resolveRepo(pm.id);
                    if (st.repo) {
                        st.versions = await this.fetchGithubVersions(st.repo);
                    }
                    st.hasUpdate = this.compareVersions(official, localVersion) > 0;
                    statusMap[pm.id] = st;
                    if (this.settings.DEBUG) console.log("[BPM] update official match", pm.id, localVersion, "->", st.remoteVersion);
                    continue;
                }
                // 2) GitHub：BPM 安装或有仓库映射 / 用户填写
                let repo: string | null = this.settings.REPO_MAP[pm.id] || null;
                if (!repo) {
                    try {
                        repo = await this.repoResolver.resolveRepo(pm.id);
                    } catch {
                        // ignore
                    }
                }
                if (repo) {
                    st.source = 'github';
                    st.repo = repo;
                    st.versions = await this.fetchGithubVersions(repo);
                    // 选择一个默认的远端版本：优先最新稳定，否则第一个
                    const pick = st.versions?.find(v => !v.prerelease) ?? st.versions?.[0] ?? null;
                    st.remoteVersion = pick?.version ?? await this.fetchGithubManifestVersion(repo);
                    st.hasUpdate = st.remoteVersion ? this.compareVersions(st.remoteVersion, localVersion) > 0 : false;
                    if (!st.remoteVersion) st.message = '未获取到远端版本';
                    if (this.settings.DEBUG) console.log("[BPM] update github match", pm.id, repo, localVersion, "->", st.remoteVersion);
                } else {
                    st.source = 'unknown';
                    st.message = '无来源，无法检测';
                    if (this.settings.DEBUG) console.log("[BPM] update unknown source", pm.id);
                }
            } catch (e) {
                st.error = (e as Error)?.message || String(e);
                console.error("[BPM] checkUpdates error", pm.id, e);
            }
            statusMap[pm.id] = st;
            opts?.onProgress?.(pm.id);
        }
        this.updateStatus = statusMap;
        return statusMap;
    }

    public async checkUpdateForPlugin(pluginId: string): Promise<UpdateStatus | null> {
        const pm = this.appPlugins.manifests[pluginId] as PluginManifest | undefined;
        if (!pm) return null;
        const localVersion = pm.version || "0.0.0";
        const st: UpdateStatus = { source: "unknown", localVersion, checkedAt: Date.now() };
        try {
            const officialMap = await this.fetchOfficialStats();
            const official = officialMap[pm.id];
            if (official) {
                st.source = "official";
                st.remoteVersion = official;
                try {
                    st.repo = await this.repoResolver.resolveRepo(pm.id);
                    if (st.repo) st.versions = await this.fetchGithubVersions(st.repo);
                } catch {
                    // ignore
                }
                st.hasUpdate = this.compareVersions(official, localVersion) > 0;
                this.updateStatus[pm.id] = st;
                if (this.settings.DEBUG) console.log("[BPM] single update official", pm.id, localVersion, "->", st.remoteVersion);
                return st;
            }

            let repo: string | null = this.settings.REPO_MAP[pm.id] || null;
            if (!repo) {
                try { repo = await this.repoResolver.resolveRepo(pm.id); } catch { repo = null; }
            }
            if (repo) {
                st.source = "github";
                st.repo = repo;
                st.versions = await this.fetchGithubVersions(repo);
                const pick = st.versions?.find(v => !v.prerelease) ?? st.versions?.[0] ?? null;
                st.remoteVersion = pick?.version ?? await this.fetchGithubManifestVersion(repo);
                st.hasUpdate = st.remoteVersion ? this.compareVersions(st.remoteVersion, localVersion) > 0 : false;
                if (!st.remoteVersion) st.message = "未获取到远端版本";
                if (this.settings.DEBUG) console.log("[BPM] single update github", pm.id, repo, localVersion, "->", st.remoteVersion);
            } else {
                st.source = "unknown";
                st.message = "无来源，无法检测";
                if (this.settings.DEBUG) console.log("[BPM] single update unknown source", pm.id);
            }
        } catch (e) {
            st.error = (e as Error)?.message || String(e);
            console.error("[BPM] checkUpdateForPlugin error", pm.id, e);
        }
        this.updateStatus[pm.id] = st;
        return st;
    }

    private async fetchOfficialStats(): Promise<Record<string, string>> {
        const url = "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json";
        try {
            const res = await requestUrl({ url });
            const json = res.json as Record<string, any>;
            const map: Record<string, string> = {};
            Object.entries(json || {}).forEach(([id, entry]) => {
                if (entry && typeof entry === "object") {
                    const latest = this.getLatestVersionFromStats(entry as Record<string, any>);
                    if (latest) map[id] = latest;
                }
            });
            return map;
        } catch (e) {
            console.error("获取官方插件 stats 失败", e);
            return {};
        }
    }

    private getLatestVersionFromStats(entry: Record<string, any>): string | null {
        const versions = Object.keys(entry || {}).filter(k => k !== "downloads" && k !== "updated");
        if (versions.length === 0) return null;
        let latest = versions[0];
        for (const v of versions) {
            if (this.compareVersions(v, latest) > 0) latest = v;
        }
        return latest;
    }

    private async fetchGithubManifestVersion(repo: string): Promise<string | null> {
        const headers: Record<string, string> = {
            "User-Agent": "better-plugins-manager"
        };
        if (this.settings.GITHUB_TOKEN) headers["Authorization"] = `Bearer ${this.settings.GITHUB_TOKEN}`;

        // 1) 尝试最新 release 的 manifest.json
        try {
            const release = await requestUrl({ url: `https://api.github.com/repos/${repo}/releases/latest`, headers });
            const assets = (release.json?.assets || []) as { name: string; browser_download_url: string }[];
            const manifestAsset = assets.find(a => a.name === "manifest.json");
            if (manifestAsset?.browser_download_url) {
                const manifestRes = await requestUrl({ url: manifestAsset.browser_download_url, headers });
                const manifest = manifestRes.json as { version?: string };
                if (manifest?.version) return manifest.version;
            }
        } catch {
            // ignore and fallback
        }

        // 2) 尝试默认分支 (HEAD) raw manifest
        const candidates = [
            `https://raw.githubusercontent.com/${repo}/HEAD/manifest.json`,
            `https://raw.githubusercontent.com/${repo}/main/manifest.json`,
            `https://raw.githubusercontent.com/${repo}/master/manifest.json`,
        ];
        for (const url of candidates) {
            try {
                const res = await requestUrl({ url, headers });
                const manifest = res.json as { version?: string };
                if (manifest?.version) return manifest.version;
            } catch {
                // try next
            }
        }
        return null;
    }

    private async fetchGithubVersions(repoInput: string): Promise<ReleaseVersion[]> {
        try {
            return await fetchReleaseVersions(this, repoInput);
        } catch (e) {
            console.error("[BPM] fetchGithubVersions error", repoInput, e);
            return [];
        }
    }

    public async downloadUpdate(pluginId: string, version?: string): Promise<boolean> {
        const st = this.updateStatus[pluginId];
        let repo = st?.repo || this.settings.REPO_MAP[pluginId] || null;
        if (!repo) {
            try {
                repo = await this.repoResolver.resolveRepo(pluginId);
            } catch { repo = null; }
        }
        if (!repo) {
            new Notice(this.translator.t("下载更新_缺少仓库提示"));
            return false;
        }
        const ok = await installPluginFromGithub(this, repo, version, false);
        if (ok) {
            await this.checkUpdates();
            this.reloadIfCurrentModal();
        }
        return ok;
    }

    /**
     * 生成自动配色，使用“黄金角”分布避免颜色过于接近。
     * existingColors: 已存在的颜色列表，用于避免重复/过近。
     */
    public generateAutoColor(existingColors: string[] = []): string {
        const baseHue = (existingColors.length * 137.508) % 360;
        let hue = baseHue;
        const saturation = 68;
        const lightness = 60;

        const isClose = (hex: string) => {
            const [r, g, b] = this.hexToRgbArray(hex);
            for (const c of existingColors) {
                const [cr, cg, cb] = this.hexToRgbArray(c);
                const dist = Math.sqrt(
                    Math.pow(r - cr, 2) + Math.pow(g - cg, 2) + Math.pow(b - cb, 2)
                );
                if (dist < 60) return true; // 阈值越小，颜色越分散
            }
            return false;
        };

        for (let i = 0; i < Math.max(existingColors.length + 6, 12); i++) {
            const hex = this.hslToHex(hue, saturation, lightness);
            if (!isClose(hex)) return hex;
            hue = (hue + 27) % 360; // 继续偏移尝试
        }
        // 兜底
        return '#A079FF';
    }

    private hslToHex(h: number, s: number, l: number): string {
        s /= 100;
        l /= 100;
        const k = (n: number) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        const r = Math.round(255 * f(0));
        const g = Math.round(255 * f(8));
        const b = Math.round(255 * f(4));
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
    }

    public updateRibbonStyles() {
        if (!this.settings) return;

        let styleEl = document.getElementById("bpm-ribbon-manager-style");
        if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = "bpm-ribbon-manager-style";
            document.head.appendChild(styleEl);
        }

        const items = this.settings.RIBBON_SETTINGS || [];
        if (items.length === 0) {
            styleEl.innerHTML = "";
            return;
        }

        // Determine platform
        let baseSelector = "";
        let isMobile = Platform.isMobile;

        if (isMobile) {
            baseSelector = `.menu-scroll .menu-item`; // Mobile logic
        } else {
            baseSelector = `.side-dock-actions div.clickable-icon.side-dock-ribbon-action`;
        }

        const cssRules = items.map(item => {
            if (!item.name) return "";
            const selector = this.generateMultiLineAriaLabelSelector(baseSelector, item.name);
            if (item.visible) {
                // 移动端使用 DOM 排序，不需要 CSS order
                // 桌面端继续使用 CSS order
                return isMobile ? "" : `${selector} { order: ${item.order} !important; }`;
            } else {
                return `${selector} { display: none !important; }`;
            }
        }).join("\n");

        const defaultOrderRule = isMobile ? "" : `${baseSelector} { order: 9999 !important; }`;
        const containerRule = ""; // No more flex hack for mobile

        styleEl.innerHTML = `${containerRule}\n${defaultOrderRule}\n${cssRules}`;
    }

    private generateMultiLineAriaLabelSelector(baseSelector: string, ariaLabelText: string): string {
        const lines = ariaLabelText.split("\n").filter(line => line.trim() !== "");
        if (lines.length <= 1) {
            const escapedName = ariaLabelText.replace(/"/g, '\\"');
            return `${baseSelector}[aria-label="${escapedName}"]`;
        } else {
            const selectors = lines.map(line => {
                const trimmedLine = line.trim();
                const escapedLine = trimmedLine.replace(/"/g, '\\"');
                return `[aria-label*="${escapedLine}"]`;
            }).join("");
            return `${baseSelector}${selectors}`;
        }
    }

    private menuObserver: MutationObserver | null = null;

    setupMenuObserver() {
        this.menuObserver = new MutationObserver((mutations) => {
            let shouldProcess = false;
            let targetNode: HTMLElement | null = null;

            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    for (const node of Array.from(mutation.addedNodes)) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node as HTMLElement;
                            if (element.classList?.contains("menu-scroll")) {
                                targetNode = element;
                                shouldProcess = true;
                                break;
                            } else {
                                const menuScroll = element.querySelector(".menu-scroll");
                                if (menuScroll) {
                                    targetNode = menuScroll as HTMLElement;
                                    shouldProcess = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            if (shouldProcess && targetNode) {
                this.processMenuItems(targetNode);
            }
        });
        this.menuObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    processMenuItems(menuScrollElement: HTMLElement) {
        // [修复] 移动端 Obsidian 菜单项包裹在 .menu-group 中
        // 必须在 .menu-group 内排序，否则会破坏样式布局
        let containerElement: HTMLElement = menuScrollElement;
        const menuGroup = menuScrollElement.querySelector(".menu-group");
        if (menuGroup) {
            containerElement = menuGroup as HTMLElement;
        }

        const menuItems = Array.from(containerElement.querySelectorAll(".menu-item")) as HTMLElement[];
        if (menuItems.length === 0) return;

        const ribbonSettings = this.settings.RIBBON_SETTINGS || [];
        const itemMap = new Map<HTMLElement, string>();

        // 1. 预处理：设置 aria-label 并收集信息
        menuItems.forEach((item) => {
            // 已处理过的标记，防止重复处理相同逻辑（虽然 DOM 排序需要反复检查）
            // 这里我们主要为了加 label
            if (item.getAttribute("data-bpm-processed") !== "true") {
                const titleEl = item.querySelector(".menu-item-title");
                if (titleEl && titleEl.textContent) {
                    const name = titleEl.textContent;
                    if (!item.hasAttribute("aria-label")) item.setAttribute("aria-label", name);
                    item.setAttribute("data-bpm-processed", "true");
                }
            }

            // 无论是否处理过，都要获取名字用于排序
            const name = item.getAttribute("aria-label");
            if (name) itemMap.set(item, name);
        });

        // 2. 准备排序数据
        const itemsWithOrder = menuItems.map(item => {
            const name = itemMap.get(item);
            let order = 9999;
            let visible = true;

            if (name) {
                const setting = ribbonSettings.find(s => s.name === name);
                if (setting) {
                    order = setting.order;
                    visible = setting.visible;
                }
            }
            return { item, order, visible };
        });

        // 3. 应用显隐 (直接操作 DOM 样式以确保移动端生效)
        let visualChange = false;
        itemsWithOrder.forEach(({ item, visible }) => {
            const currentDisplay = item.style.display;
            const targetDisplay = visible ? "" : "none";
            if (currentDisplay !== targetDisplay) {
                item.style.display = targetDisplay;
                visualChange = true;
            }
        });

        // 4. 检查是否需要排序
        // 先按 order 排序生成目标列表
        itemsWithOrder.sort((a, b) => a.order - b.order);

        // 检查当前 DOM 顺序是否与目标一致
        let needSort = false;
        for (let i = 0; i < itemsWithOrder.length; i++) {
            if (menuScrollElement.children[i] !== itemsWithOrder[i].item) {
                needSort = true;
                break;
            }
        }

        // 5. 如果需要，执行重排
        if (needSort) {
            const fragment = document.createDocumentFragment();
            itemsWithOrder.forEach(({ item }) => fragment.appendChild(item));
            containerElement.appendChild(fragment);
        }
    }
}
