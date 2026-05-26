import {
    App,
    ButtonComponent,
    DropdownComponent,
    ExtraButtonComponent,
    Menu,
    Modal,
    Notice,
    PluginManifest,
    requestUrl,
    SearchComponent,
    setIcon,
    Setting,
    TextComponent,
    ToggleComponent,
    Platform,
} from "obsidian";

import { BetaSource, BPM_IGNORE_TAG, InstallHistoryItem, ManagerPlugin, PluginLayoutItem } from "../data/types";
import { DEFAULT_MAIN_PAGE_ACTION_PLACEMENT, MainPageActionId, ManagerSettings } from "../settings/data";
import { managerOpen } from "../utils";

import Manager from "main";
import { GroupModal } from "./group-modal";
import { TagsModal } from "./tags-modal";
import { DeleteModal } from "./delete-modal";
import Commands from "src/command";
import { DisableModal } from "./disable-modal";
import { NoteModal } from "./note-modal";
import { HideModal } from "./hide-modal";
import { TroubleshootPanel } from "../troubleshoot/troubleshoot-panel";
import { installPluginFromGithub, installThemeFromGithub, fetchReleaseVersions, ReleaseVersion, sanitizeRepo } from "../github-install";
import { BPM_TAG_ID } from "src/repo-resolver";
import { normalizePath } from "obsidian";
import { UpdateModal } from "./update-modal";
import { RibbonModal } from "./ribbon-modal";
import {
    applyManagerTransferPackage,
    buildManagerTransferPackage,
    collectInstalledThemes,
    createManagerTransferPreview,
    DEFAULT_TRANSFER_BUILD_OPTIONS,
    DEFAULT_TRANSFER_IMPORT_OPTIONS,
    ManagerTransferBuildOptions,
    ManagerTransferImportOptions,
    ManagerTransferImportResult,
    ManagerTransferPackage,
    ManagerTransferPreview,
    ManagerTransferTheme,
    parseManagerTransferPackage,
} from "../import-export";
import {
    createSharedVaultLinks,
    forgetSharedVault,
    getSharedVaultSnapshot,
    isSharedVaultFsAvailable,
    normalizeSharedVaultInputPath,
    readSharedPluginCatalog,
    readSharedThemeCatalog,
    setCurrentVaultAsSharedMain,
    setSharedVaultPluginEnabled,
    setSharedVaultTheme,
    SharedFolderKind,
    SharedPluginCatalogItem,
    SharedThemeCatalogItem,
    SharedVaultFolderStatus,
    SharedVaultRole,
    SharedVaultStatus,
    unlinkSharedVaultFolder,
} from "../vault-share";

type ManagerPage = "plugins" | "install" | "sources" | "transfer" | "vaults" | "ribbon" | "hidden" | "troubleshoot";
const SUPPORT_QQ_GROUP_URL = "https://qm.qq.com/cgi-bin/qm/qr?k=kHTS0iC1FC5igTXbdbKzff6_tc54mOF5&jump_from=webapi&authKey=AoSkriW+nDeDzBPqBl9jcpbAYkPXN2QRbrMh0hFbvMrGbqZyRAbJwaD6JKbOy4Nx";
const SUPPORT_QQ_GROUP_LABEL = "\u52a0\u5165 QQ \u7fa4";
const SUPPORT_QQ_GROUP_TOOLTIP = "\u52a0\u5165 QQ \u7fa4\u54a8\u8be2\u95ee\u9898";
type PluginUpdateViewStatus = {
    hasUpdate?: boolean;
    remoteVersion?: string | null;
    repo?: string | null;
    versions?: ReleaseVersion[];
    error?: string;
};

type PluginRepoActionState = {
    repo: string | null;
    tooltip: string;
    disabled: boolean;
};



// ==============================
//          侧边栏 对话框 翻译
// ==============================
export class ManagerModal extends Modal {
    manager: Manager;
    settings: ManagerSettings;
    // this.app.plugins
    appPlugins;
    // this.app.settings
    appSetting;
    // [本地][变量] 插件路径
    basePath: string;
    // [本地][变量] 展示插件列表
    displayPlugins: PluginManifest[] = [];

    allPlugins: PluginManifest[] = [];

    // 过滤器
    filter = "";
    // 分组内容
    group = "";
    // 标签内容
    tag = "";
    // 标签内容
    delay = "";
    // 搜索内容
    searchText = "";

    // 安装模式
    installMode = false;
    private activePage: ManagerPage = "plugins";
    installType: "plugin" | "theme" = "plugin";
    installRepo = "";
    installVersion = "";
    installVersions: ReleaseVersion[] = [];
    installTrackSource = true;
    searchBarEl?: HTMLElement;
    groupDropdown?: DropdownComponent;
    tagDropdown?: DropdownComponent;
    delayDropdown?: DropdownComponent;
    actionCollapsed = false;
    filterCollapsed = false;
    private reloadingManifests = false;
    private mobileFiltersCollapsed = true;
    private isCheckingPluginUpdates = false;
    private renderGeneration = 0;

    private nextRenderGeneration(): number {
        return ++this.renderGeneration;
    }

    private isRenderCurrent(renderGeneration: number, page: ManagerPage): boolean {
        return renderGeneration === this.renderGeneration && this.activePage === page;
    }

    private getPluginUpdateCount(statusMap?: Record<string, { hasUpdate?: boolean }>): number {
        return Object.values(statusMap || this.manager.updateStatus || {}).filter((status) => status?.hasUpdate).length;
    }

    private openSupportQQGroup() {
        window.open(SUPPORT_QQ_GROUP_URL);
    }

    private addSupportQQGroupMenuItem(menu: Menu) {
        menu.addItem((item) => item.setTitle(SUPPORT_QQ_GROUP_LABEL).setIcon("message-circle").onClick(() => {
            this.openSupportQQGroup();
        }));
    }
 
    private preparePluginUpdateButton(button: ButtonComponent) {
        const label = this.manager.translator.t("管理器_检查更新_描述");
        button.setIcon("rss");
        button.setTooltip(label);
        button.buttonEl.addClass("manager-update-trigger");
        button.buttonEl.setAttribute("aria-label", label);
        this.bindLongPressTooltip(button.buttonEl, label);
        button.onClick(() => {
            void this.runPluginUpdateCheck(button);
        });
    }

    private async runPluginUpdateCheck(trigger?: ButtonComponent | HTMLButtonElement) {
        if (this.isCheckingPluginUpdates) return;

        const label = this.manager.translator.t("管理器_检查更新_描述");
        const busyLabel = this.manager.translator.t("通知_检测更新中文案");
        const buttonEl = trigger instanceof ButtonComponent ? trigger.buttonEl : trigger;
        const wasDisabled = buttonEl instanceof HTMLButtonElement ? buttonEl.disabled : false;

        this.isCheckingPluginUpdates = true;
        buttonEl?.addClass("is-loading");
        buttonEl?.setAttribute("aria-busy", "true");

        if (trigger instanceof ButtonComponent) {
            trigger.setDisabled(true);
            trigger.setIcon("loader");
            trigger.setTooltip(busyLabel);
        } else if (buttonEl instanceof HTMLButtonElement) {
            buttonEl.disabled = true;
            buttonEl.setAttribute("title", busyLabel);
        }

        try {
            const status = await this.manager.checkUpdatesWithNotice();
            await this.reloadShowData();
            const count = this.getPluginUpdateCount(status);
            new Notice(this.manager.translator.t("通知_检查更新完成").replace("{count}", `${count}`));
        } catch (error) {
            console.error("检查更新时出错:", error);
            new Notice(this.manager.translator.t("通知_检查更新失败"));
        } finally {
            if (trigger instanceof ButtonComponent) {
                trigger.setIcon("rss");
                trigger.setTooltip(label);
                trigger.setDisabled(wasDisabled);
            } else if (buttonEl instanceof HTMLButtonElement) {
                buttonEl.disabled = wasDisabled;
                buttonEl.setAttribute("title", label);
            }
            buttonEl?.removeClass("is-loading");
            buttonEl?.removeAttribute("aria-busy");
            this.isCheckingPluginUpdates = false;
        }
    }

    private getExtraButtonEl(button: ExtraButtonComponent): HTMLElement | undefined {
        return ((button as any).extraSettingsEl || (button as any).buttonEl) as HTMLElement | undefined;
    }

    private openPluginUpdateModal(pluginId: string, updateInfo: PluginUpdateViewStatus) {
        if (!updateInfo.remoteVersion) return;
        const versions = updateInfo.versions && updateInfo.versions.length > 0
            ? updateInfo.versions
            : [{ version: updateInfo.remoteVersion, prerelease: false }];
        new UpdateModal(this.app, this.manager, pluginId, versions, updateInfo.remoteVersion, updateInfo.repo || undefined).open();
    }

    private addPluginDownloadButton(controlEl: HTMLElement, pluginId: string, updateInfo: PluginUpdateViewStatus, prepend = false) {
        if (!updateInfo.remoteVersion) return;
        if (!this.isMainPageActionOnItem("downloadUpdate")) return;
        const downloadBtn = new ExtraButtonComponent(controlEl);
        downloadBtn.setIcon("download");
        downloadBtn.setTooltip(this.manager.translator.t("管理器_下载更新_描述"));
        downloadBtn.onClick(() => this.openPluginUpdateModal(pluginId, updateInfo));
        const downloadEl = this.getExtraButtonEl(downloadBtn);
        downloadEl?.addClass("manager-plugin-card__download-update");
        downloadEl?.setAttribute("data-update-action", "download");
        if (prepend && downloadEl) controlEl.prepend(downloadEl);
    }

    private refreshSinglePluginUpdateUi(pluginId: string) {
        const card = Array.from(this.contentEl.querySelectorAll<HTMLElement>(".manager-plugin-card[data-plugin-id]"))
            .find((el) => el.getAttribute("data-plugin-id") === pluginId);
        if (!card) return;

        const updateInfo = this.manager.updateStatus?.[pluginId] as PluginUpdateViewStatus | undefined;
        const hasUpdate = Boolean(updateInfo?.hasUpdate);
        const hasRemoteVersion = Boolean(updateInfo?.hasUpdate && updateInfo.remoteVersion);

        card.toggleClass("has-update", hasUpdate);

        const versionWrap = card.querySelector<HTMLElement>(".manager-item__versions");
        versionWrap?.querySelectorAll(".manager-item__name-remote-arrow, .manager-item__name-remote")
            .forEach((el) => el.remove());
        if (versionWrap && hasRemoteVersion && updateInfo?.remoteVersion) {
            const arrow = createSpan({ text: "→", cls: ["manager-item__name-remote-arrow"] });
            const remote = createSpan({ text: updateInfo.remoteVersion, cls: ["manager-item__name-remote"] });
            versionWrap.appendChild(arrow);
            versionWrap.appendChild(remote);
        }

        const controlEl = card.querySelector<HTMLElement>(".manager-plugin-card__actions");
        controlEl?.querySelectorAll(".manager-plugin-card__download-update").forEach((el) => el.remove());
        if (controlEl && hasRemoteVersion && updateInfo && !this.editorMode && !Platform.isMobileApp) {
            this.addPluginDownloadButton(controlEl, pluginId, updateInfo, true);
        }

        if (this.filter === "has-update" && !hasUpdate) {
            card.remove();
            this.displayPlugins = this.displayPlugins.filter((plugin) => plugin.id !== pluginId);
        }
    }

    private getMainPageActionPlacement(actionId: MainPageActionId) {
        return this.settings.MAIN_PAGE_ACTION_PLACEMENT?.[actionId]
            ?? DEFAULT_MAIN_PAGE_ACTION_PLACEMENT[actionId];
    }

    private isMainPageActionOnItem(actionId: MainPageActionId): boolean {
        return this.getMainPageActionPlacement(actionId) === "item";
    }

    private isMainPageActionInMenu(actionId: MainPageActionId): boolean {
        return this.getMainPageActionPlacement(actionId) === "menu";
    }

    private createConfiguredItemAction(controlEl: HTMLElement, actionId: MainPageActionId): ExtraButtonComponent | null {
        if (!this.isMainPageActionOnItem(actionId)) return null;
        return new ExtraButtonComponent(controlEl);
    }

    private resolvePluginRepoAction(pluginId: string, repo: string | null): PluginRepoActionState {
        if (repo) {
            return {
                repo,
                tooltip: this.manager.translator.t("管理器_打开仓库_提示").replace("{repo}", repo),
                disabled: false,
            };
        }

        const isBpmInstall = this.manager.settings.BPM_INSTALLED.includes(pluginId);
        return {
            repo: null,
            tooltip: isBpmInstall
                ? this.manager.translator.t("管理器_仓库未记录_提示")
                : this.manager.translator.t("管理器_仓库需手动添加_提示"),
            disabled: true,
        };
    }

    private handleMissingRepo(pluginId: string) {
        const isBpmInstall = this.manager.settings.BPM_INSTALLED.includes(pluginId);
        new Notice(isBpmInstall
            ? this.manager.translator.t("管理器_仓库未记录_提示")
            : this.manager.translator.t("管理器_仓库需手动添加_提示"));
    }

    private async openPluginRepo(pluginId: string, repo?: string | null) {
        const resolvedRepo = repo ?? await this.manager.repoResolver.resolveRepo(pluginId);
        if (resolvedRepo) {
            window.open(`https://github.com/${resolvedRepo}`);
            return;
        }
        this.handleMissingRepo(pluginId);
    }

    private async uninstallPluginWithConfirm(plugin: PluginManifest, isSelf: boolean) {
        if (isSelf) return;
        new DeleteModal(this.app, this.manager, async () => {
            await this.appPlugins.uninstallPlugin(plugin.id);
            await this.appPlugins.loadManifests();
            this.reloadShowData();
            Commands(this.app, this.manager);
            this.manager.synchronizePlugins(Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manager.manifest.id) as PluginManifest[]);
            new Notice(this.manager.translator.t("卸载_通知_一"));
        }, { id: plugin.id, name: plugin.name }).open();
    }

    private async singleStartPlugin(plugin: PluginManifest) {
        new Notice(this.manager.translator.t("管理器_单次启动中_提示"));
        await this.appPlugins.enablePlugin(plugin.id);
        await this.reloadShowData();
    }

    private async restartPlugin(plugin: PluginManifest) {
        new Notice(this.manager.translator.t("管理器_重启中_提示"));
        await this.appPlugins.disablePluginAndSave(plugin.id);
        await this.appPlugins.enablePluginAndSave(plugin.id);
        await this.reloadShowData();
    }

    private togglePluginHidden(pluginId: string) {
        const isHidden = this.settings.HIDES.includes(pluginId);
        if (isHidden) {
            this.settings.HIDES = this.settings.HIDES.filter(id => id !== pluginId);
        } else {
            this.settings.HIDES.push(pluginId);
        }
        this.manager.saveSettings();
        this.reloadShowData();
    }

    private async openPluginHotkeys(pluginId: string) {
        await this.appSetting.open();
        await this.appSetting.openTabById("hotkeys");
        const tab = await this.appSetting.activeTab;
        tab.searchComponent.inputEl.value = pluginId;
        tab.updateHotkeyVisibility();
        tab.searchComponent.inputEl.blur();
    }

    private async openPluginMarket() {
        await this.appSetting.open();
        await this.appSetting.openTabById("community-plugins");
        window.setTimeout(() => {
            const tab = this.appSetting.activeTab;
            const marketButton = tab?.containerEl?.querySelector("button.mod-cta") as HTMLButtonElement | null | undefined;
            marketButton?.click();
        }, 50);
    }

    private async runSinglePluginUpdateCheck(pluginId: string) {
        const progress = this.showInlineProgress(this.manager.translator.t("通知_检测更新中文案"), pluginId);
        progress.update(0, 1, pluginId);
        try {
            const status = await this.manager.checkUpdateForPlugin(pluginId);
            progress.update(1, 1, pluginId);
            this.refreshSinglePluginUpdateUi(pluginId);
            this.updateStats();
            if (status?.error) {
                new Notice(this.manager.translator.t("通知_检查更新失败"));
            }
        } catch (error) {
            console.error("检查单个插件更新时出错:", error);
            new Notice(this.manager.translator.t("通知_检查更新失败"));
        } finally {
            progress.hide();
        }
    }

    private isManagedPluginEnabled(pluginId: string): boolean {
        if (this.settings.DELAY) {
            return Boolean(this.settings.Plugins.find((plugin) => plugin.id === pluginId)?.enabled);
        }
        return this.appPlugins.enabledPlugins.has(pluginId);
    }

    private getBulkToggleTarget(): boolean {
        const targets = this.displayPlugins.filter((plugin) => plugin.id !== this.manager.manifest.id);
        if (targets.length === 0) return true;
        return !targets.every((plugin) => this.isManagedPluginEnabled(plugin.id));
    }

    private async setDisplayedPluginsEnabled(targetEnabled: boolean) {
        for (const plugin of this.displayPlugins) {
            if (plugin.id === this.manager.manifest.id) continue;
            const managerPlugin = this.settings.Plugins.find((item) => item.id === plugin.id);
            if (!managerPlugin) continue;
            const isEnabled = this.isManagedPluginEnabled(plugin.id);
            if (isEnabled === targetEnabled) continue;

            if (this.settings.DELAY) {
                managerPlugin.enabled = targetEnabled;
                if (targetEnabled) {
                    await this.appPlugins.enablePlugin(plugin.id);
                } else {
                    await this.appPlugins.disablePlugin(plugin.id);
                }
            } else if (targetEnabled) {
                managerPlugin.enabled = true;
                await this.appPlugins.enablePluginAndSave(plugin.id);
            } else {
                managerPlugin.enabled = false;
                await this.appPlugins.disablePluginAndSave(plugin.id);
            }
            await this.manager.savePluginAndExport(plugin.id);
        }
        Commands(this.app, this.manager);
        await this.reloadShowData();
    }

    private runDisplayedPluginsToggle() {
        const targetEnabled = this.getBulkToggleTarget();
        new DisableModal(this.app, this.manager, async () => {
            await this.setDisplayedPluginsEnabled(targetEnabled);
        }).open();
    }

    private showInlineProgress(text: string, subText?: string) {
        const baseText = subText ? `${text} ${subText}` : text;
        const notice = new Notice(baseText, 0);
        return {
            update: (processed: number, total = 1, current?: string) => {
                notice.setMessage(`${text} ${Math.min(processed, total)}/${total}${current ? ` · ${current}` : ""}`);
            },
            hide: () => notice.hide()
        };
    }


    // 编辑模式
    editorMode = false;
    // 测试模式
    developerMode = false;

    searchEl: SearchComponent;
    footEl: HTMLDivElement;
    modalContainer?: HTMLElement;
    private desktopActionWrapper?: HTMLElement;
    private desktopFilterWrapper?: HTMLElement;
    private pluginTabEl?: HTMLButtonElement;
    private installTabEl?: HTMLButtonElement;
    private sourcesTabEl?: HTMLButtonElement;
    private transferTabEl?: HTMLButtonElement;
    private vaultsTabEl?: HTMLButtonElement;
    private ribbonTabEl?: HTMLButtonElement;
    private hiddenTabEl?: HTMLButtonElement;
    private troubleshootTabEl?: HTMLButtonElement;
    private ribbonPage?: RibbonModal;
    private troubleshootPanel?: TroubleshootPanel;
    private transferBuildOptions: ManagerTransferBuildOptions = { ...DEFAULT_TRANSFER_BUILD_OPTIONS };
    private transferImportOptions: ManagerTransferImportOptions = { ...DEFAULT_TRANSFER_IMPORT_OPTIONS };
    private transferPackage?: ManagerTransferPackage;
    private transferPreview?: ManagerTransferPreview;
    private transferImportResult?: ManagerTransferImportResult;
    private transferFileName = "";
    private transferBusy = false;
    private transferSelectionInitialized = false;
    private transferSelectedPluginIds = new Set<string>();
    private transferSelectedThemeNames = new Set<string>();
    private transferSelectedPluginConfigIds = new Set<string>();
    private hiddenDraggedItemEl: HTMLElement | null = null;
    private hiddenGhostEl: HTMLElement | null = null;
    private hiddenPlaceholderEl: HTMLElement | null = null;
    private hiddenDragStartIndex = -1;
    private hiddenDragOffsetX = 0;
    private hiddenDragOffsetY = 0;
    private hiddenActivePointerId: number | null = null;
    private vaultTargetPath = "";
    private vaultLinkPlugins = true;
    private vaultLinkThemes = true;
    private vaultBackupExisting = false;
    private vaultExpandedId = "";

    constructor(app: App, manager: Manager) {
        super(app);
        // @ts-ignore 
        this.appSetting = this.app.setting;
        // @ts-ignore
        this.appPlugins = this.app.plugins;
        this.manager = manager;
        this.settings = manager.settings;
        this.basePath = normalizePath(`${this.app.vault.configDir}`);
        this.handleHiddenLayoutDragMove = this.handleHiddenLayoutDragMove.bind(this);
        this.handleHiddenLayoutDragEnd = this.handleHiddenLayoutDragEnd.bind(this);
        // 首次启动运行下 避免有新加入的插件
        manager.synchronizePlugins(
            Object.values(this.appPlugins.manifests).filter(
                (pm: PluginManifest) => pm.id !== manager.manifest.id
            ) as PluginManifest[]
        );

        // this.manager.registerEvent(
        // 	this.app.workspace.on("file-menu", (menu, file) => {
        // 		const addIconMenuItem = (item: MenuItem) => {
        // 			item.setTitle("增");
        // 			item.setIcon("hashtag");
        // 			item.onClick(async () => {
        // 				console.log(file);
        // 			});
        // 		};
        // 		menu.addItem(addIconMenuItem);
        // 		const addIconMenuItem1 = (item: MenuItem) => {
        // 			item.setTitle("删");
        // 			item.setIcon("hashtag");
        // 		};
        // 		menu.addItem(addIconMenuItem1);
        // 		const addIconMenuItem2 = (item: MenuItem) => {
        // 			item.setTitle("改");
        // 			item.setIcon("hashtag");
        // 		};
        // 		menu.addItem(addIconMenuItem2);
        // 	})
        // );
    }

    async getActivePlugins() {
        // @ts-ignore
        const originPlugins = this.app.plugins.plugins;
        console.log(await this.processPlugins(originPlugins));
        return await this.processPlugins(originPlugins);
    }

    async processPlugins(originPlugins: any) {
        let plugins: any = {};
        for (let name in originPlugins) {
            try {
                let plugin = { ...originPlugins[name] }; // new an object and make it extensible
                plugin.manifest = { ...originPlugins[name].manifest }
                plugin.manifest["pluginUrl"] = `https://obsidian.md/plugins?id=${plugin.manifest.id}`;
                plugin.manifest["author2"] = plugin.manifest.author?.replace(/<.*?@.*?\..*?>/g, "").trim(); // remove email address
                plugin.manifest["installLink"] = `obsidian://BPM-install?id=${plugin.manifest.id}&enable=true`;
                plugins[name] = plugin;
            } catch (e) {
                console.error(name, e);
                console.log(originPlugins[name]);
                console.log(originPlugins[name].manifest);
                console.log(typeof originPlugins[name].manifest);
            }
        }
        return plugins;
    }

    public async showHead() {
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        //@ts-ignore
        const modalEl: HTMLElement = this.contentEl.parentElement;
        this.modalContainer = modalEl;
        modalEl.addClass("manager-container");
        if (Platform.isMobileApp) modalEl.addClass("manager-container--mobile");
        // 靠上
        if (!this.settings.CENTER && !Platform.isMobileApp) modalEl.addClass("manager-container__top");
        if (this.editorMode) modalEl.addClass("manager-container--editing");

        modalEl.removeChild(modalEl.getElementsByClassName("modal-close-button")[0]);
        this.titleEl.empty();
        this.titleEl.parentElement?.addClass("manager-container__header");
        this.contentEl.addClass("manager-item-container");

        if (Platform.isMobileApp) {
            this.showHeadMobile();
            return;
        }

        const titleBar = this.titleEl.createDiv("manager-header");
        const identity = titleBar.createDiv("manager-header__identity");
        const mark = identity.createDiv("manager-header__mark");
        mark.setAttribute("aria-hidden", "true");
        setIcon(mark, "blocks");
        const titleGroup = identity.createDiv("manager-header__title-group");
        titleGroup.createDiv({ cls: "manager-header__eyebrow", text: "BPM" });
        titleGroup.createEl("h2", {
            cls: "manager-header__title",
            text: this.manager.translator.t("通用_管理器_文本"),
        });
        this.footEl = titleBar.createDiv("manager-food manager-header__stats");
        this.updateStats();

        // [操作行]
        const actionWrapper = this.titleEl.createDiv("manager-section manager-section--actions");
        this.desktopActionWrapper = actionWrapper;
        const actionContent = actionWrapper.createDiv("manager-section__content");
        actionContent.addClass("manager-section__content--actions");
        const bindLongPressTooltip = (btn: ButtonComponent, text: string) => {
            let timer: number | undefined;
            const show = () => { new Notice(text, 1500); };
            btn.buttonEl.addEventListener("touchstart", () => {
                timer = window.setTimeout(show, 500);
            });
            const clear = () => { if (timer) window.clearTimeout(timer); timer = undefined; };
            btn.buttonEl.addEventListener("touchend", clear);
            btn.buttonEl.addEventListener("touchcancel", clear);
        };
        const toolbar = actionContent.createDiv("manager-toolbar");
        const tabs = toolbar.createDiv("manager-toolbar__tabs");
        tabs.setAttribute("role", "tablist");
        const createTab = (page: ManagerPage, label: string, icon: string, tooltip?: string) => {
            const tab = tabs.createEl("button", { cls: "manager-toolbar__tab" });
            tab.type = "button";
            tab.setAttribute("role", "tab");
            tab.setAttribute("aria-label", label);
            if (tooltip) {
                tab.setAttribute("title", tooltip);
                this.bindLongPressTooltip(tab, tooltip);
            }
            tab.dataset.page = page;
            const iconEl = tab.createSpan({ cls: "manager-toolbar__tab-icon" });
            iconEl.setAttribute("aria-hidden", "true");
            setIcon(iconEl, icon);
            tab.createSpan({ cls: "manager-toolbar__tab-label", text: label });
            tab.addEventListener("click", () => this.setDesktopPage(page));
            return tab;
        };
        this.pluginTabEl = createTab("plugins", t("管理器_Tab_插件管理"), "blocks");
        this.installTabEl = createTab("install", t("管理器_Tab_安装来源"), "download");
        this.sourcesTabEl = undefined;
        this.transferTabEl = createTab("transfer", t("导入导出_Tab_标题"), "archive-restore", t("导入导出_Tab_说明"));
        this.vaultsTabEl = createTab("vaults", t("共享库_Tab_标题"), "folder-sync", t("共享库_Tab_说明"));
        this.ribbonTabEl = createTab("ribbon", t("管理器_Tab_功能编排"), "grip-vertical", t("Ribbon_功能编排_说明"));
        this.hiddenTabEl = createTab("hidden", t("管理器_Tab_隐藏管理"), "layout-list", t("管理器_布局_描述"));
        this.troubleshootTabEl = createTab("troubleshoot", t("排查_Tab_短标题"), "search-check");

        const tools = toolbar.createDiv("manager-toolbar__tools");
        const actionBar = new Setting(tools).setClass("manager-bar__action").setName("");
        const markTool = (btn: ButtonComponent, scope: "plugin" | "install" | "global" | "ribbon" | "hidden" | "transfer" | "resource") => {
            btn.buttonEl.addClass("manager-tool");
            btn.buttonEl.addClass(`manager-tool--${scope}`);
        };

        // [操作行] 检查更新
        const updateButton = new ButtonComponent(actionBar.controlEl);
        markTool(updateButton, "plugin");
        this.preparePluginUpdateButton(updateButton);

        // [操作行] 全选/全部取消当前列表
        const toggleAllButton = new ButtonComponent(actionBar.controlEl);
        markTool(toggleAllButton, "plugin");
        toggleAllButton.setIcon("list-checks");
        toggleAllButton.setTooltip(this.manager.translator.t("管理器_全选取消_描述"));
        this.bindLongPressTooltip(toggleAllButton.buttonEl, this.manager.translator.t("管理器_全选取消_描述"));
        toggleAllButton.onClick(() => {
            this.runDisplayedPluginsToggle();
        });

        // [操作行] 重载插件
        const reloadButton = new ButtonComponent(actionBar.controlEl);
        markTool(reloadButton, "plugin");
        reloadButton.setIcon("refresh-ccw");
        reloadButton.setTooltip(this.manager.translator.t("管理器_重载插件_描述"));
        this.bindLongPressTooltip(reloadButton.buttonEl, this.manager.translator.t("管理器_重载插件_描述"));
        reloadButton.onClick(async () => {
            if (this.reloadingManifests) return;
            this.reloadingManifests = true;
            reloadButton.setDisabled(true);
            const notice = new Notice(this.manager.translator.t("管理器_重载插件_开始提示"), 0);
            // 让 UI 先渲染提示再进行重操作
            await new Promise((r) => window.setTimeout(r, 50));
            try {
                await this.appPlugins.loadManifests();
                // 同步新发现的插件到 BPM 管理列表
                this.manager.synchronizePlugins(
                    Object.values(this.appPlugins.manifests).filter(
                        (pm: PluginManifest) => pm.id !== this.manager.manifest.id
                    ) as PluginManifest[]
                );
                await this.reloadShowData();
            } catch (e) {
                console.error("[BPM] reload manifests failed", e);
                new Notice(this.manager.translator.t("管理器_重载插件_失败提示"), 4000);
            } finally {
                notice.hide();
                reloadButton.setDisabled(false);
                this.reloadingManifests = false;
            }
        });

        // [操作行] 编辑模式
        const editorButton = new ButtonComponent(actionBar.controlEl);
        markTool(editorButton, "plugin");
        this.editorMode ? editorButton.setIcon("pen-off") : editorButton.setIcon("pen");
        editorButton.setTooltip(this.manager.translator.t("管理器_编辑模式_描述"));
        this.bindLongPressTooltip(editorButton.buttonEl, this.manager.translator.t("管理器_编辑模式_描述"));
        editorButton.onClick(async () => {
            this.editorMode = !this.editorMode;
            this.editorMode ? editorButton.setIcon("pen-off") : editorButton.setIcon("pen");
            this.applyEditingStyle();
            if (!this.editorMode) {
                await this.refreshFilterOptions(true);
            } else {
                this.renderContent();
            }
        });

        const ribbonResetButton = new ButtonComponent(actionBar.controlEl);
        markTool(ribbonResetButton, "ribbon");
        ribbonResetButton.setIcon("rotate-ccw");
        ribbonResetButton.setTooltip(t("Ribbon_重置_提示"));
        ribbonResetButton.buttonEl.setAttribute("aria-label", t("Ribbon_重置_提示"));
        this.bindLongPressTooltip(ribbonResetButton.buttonEl, t("Ribbon_重置_提示"));
        ribbonResetButton.onClick(async () => {
            if (!window.confirm(t("Ribbon_重置_确认"))) return;
            if (!this.ribbonPage) this.ribbonPage = new RibbonModal(this.app, this.manager);
            this.manager.ribbonModal = this.ribbonPage;
            await this.ribbonPage.syncRibbonItems();
            await this.ribbonPage.resetRibbonLayout();
        });

        const addSeparatorButton = new ButtonComponent(actionBar.controlEl);
        markTool(addSeparatorButton, "hidden");
        addSeparatorButton.setIcon("separator-horizontal");
        addSeparatorButton.setTooltip(t("管理器_布局_添加分割线"));
        addSeparatorButton.buttonEl.setAttribute("aria-label", t("管理器_布局_添加分割线"));
        this.bindLongPressTooltip(addSeparatorButton.buttonEl, t("管理器_布局_添加分割线"));
        addSeparatorButton.onClick(async () => {
            await this.addPluginLayoutSeparator();
        });

        const hiddenResetButton = new ButtonComponent(actionBar.controlEl);
        markTool(hiddenResetButton, "hidden");
        hiddenResetButton.setIcon("rotate-ccw");
        hiddenResetButton.setTooltip(t("管理器_布局_按名称重置"));
        hiddenResetButton.buttonEl.setAttribute("aria-label", t("管理器_布局_按名称重置"));
        this.bindLongPressTooltip(hiddenResetButton.buttonEl, t("管理器_布局_按名称重置"));
        hiddenResetButton.onClick(async () => {
            if (!window.confirm(t("管理器_布局_重置确认"))) return;
            await this.resetPluginLayout();
        });

        const githubButton = new ButtonComponent(actionBar.controlEl);
        markTool(githubButton, "resource");
        githubButton.setIcon("github");
        githubButton.setTooltip(this.manager.translator.t("管理器_GITHUB_描述"));
        this.bindLongPressTooltip(githubButton.buttonEl, this.manager.translator.t("管理器_GITHUB_描述"));
        githubButton.onClick(() => { window.open("https://github.com/zenozero-dev/obsidian-manager"); });

        const tutorialButton = new ButtonComponent(actionBar.controlEl);
        markTool(tutorialButton, "resource");
        tutorialButton.setIcon("book-open");
        tutorialButton.setTooltip(this.manager.translator.t("管理器_视频教程_描述"));
        this.bindLongPressTooltip(tutorialButton.buttonEl, this.manager.translator.t("管理器_视频教程_描述"));
        tutorialButton.onClick(() => { window.open("https://www.bilibili.com/video/BV1WyrkYMEce/"); });

        const supportGroupButton = new ButtonComponent(actionBar.controlEl);
        markTool(supportGroupButton, "resource");
        supportGroupButton.setIcon("message-circle");
        supportGroupButton.setTooltip(SUPPORT_QQ_GROUP_TOOLTIP);
        this.bindLongPressTooltip(supportGroupButton.buttonEl, SUPPORT_QQ_GROUP_TOOLTIP);
        supportGroupButton.onClick(() => this.openSupportQQGroup());

        // [操作行] 插件市场
        const marketButton = new ButtonComponent(actionBar.controlEl);
        markTool(marketButton, "global");
        marketButton.setIcon("store");
        marketButton.setTooltip(this.manager.translator.t("管理器_插件市场_描述"));
        this.bindLongPressTooltip(marketButton.buttonEl, this.manager.translator.t("管理器_插件市场_描述"));
        marketButton.onClick(() => {
            void this.openPluginMarket();
        });

        // [操作行] 插件设置
        const settingsButton = new ButtonComponent(actionBar.controlEl);
        markTool(settingsButton, "global");
        settingsButton.setIcon("settings");
        settingsButton.setTooltip(this.manager.translator.t("管理器_插件设置_描述"));
        this.bindLongPressTooltip(settingsButton.buttonEl, this.manager.translator.t("管理器_插件设置_描述"));
        settingsButton.onClick(() => {
            this.appSetting.open();
            this.appSetting.openTabById(this.manager.manifest.id);
            // this.close();
        });


        // [测试行] 刷新插件
        if (this.developerMode) {
            const testButton = new ButtonComponent(actionBar.controlEl);
            markTool(testButton, "plugin");
            testButton.setIcon("refresh-ccw");
            testButton.setTooltip(t("开发_刷新插件_提示"));
            testButton.onClick(async () => {
                this.close();
                await this.appPlugins.disablePlugin(this.manager.manifest.id);
                await this.appPlugins.enablePlugin(this.manager.manifest.id);
            });
        }

        // [测试行] 测试插件
        if (this.developerMode) {
            const testButton = new ButtonComponent(actionBar.controlEl);
            markTool(testButton, "plugin");
            testButton.setIcon("test-tube");
            testButton.setTooltip(t("开发_测试插件_提示"));
            testButton.onClick(async () => {
                // 获取当前页面所有的插件ID 然后将其转换为列表
            });
        }

        // [过滤行]
        const filterWrapper = this.titleEl.createDiv("manager-section manager-section--filters");
        this.desktopFilterWrapper = filterWrapper;
        const filterContent = filterWrapper.createDiv("manager-section__content");
        filterContent.addClass("manager-section__content--filters");

        const searchBar = new Setting(filterContent).setClass("manager-bar__search").setName("");
        this.searchBarEl = searchBar.settingEl;
        this.syncPageChrome();
        const createFilterField = (label: string, icon: string, variant: "select" | "search" = "select") => {
            const field = searchBar.controlEl.createDiv("manager-filter-field");
            field.addClass(`manager-filter-field--${variant}`);
            const labelEl = field.createDiv("manager-filter-field__label");
            const iconEl = labelEl.createSpan({ cls: "manager-filter-field__icon" });
            setIcon(iconEl, icon);
            labelEl.createSpan({ cls: "manager-filter-field__text", text: label });
            const controlEl = field.createDiv("manager-filter-field__control");
            return controlEl;
        };

        const filterOptions = {
            "all": this.manager.translator.t("筛选_全部_描述"),
            "enabled": this.manager.translator.t("筛选_仅启用_描述"),
            "disabled": this.manager.translator.t("筛选_仅禁用_描述"),
            "grouped": this.manager.translator.t("筛选_已分组_描述"),
            "ungrouped": this.manager.translator.t("筛选_未分组_描述"),
            "tagged": this.manager.translator.t("筛选_有标签_描述"),
            "untagged": this.manager.translator.t("筛选_无标签_描述"),
            "noted": this.manager.translator.t("筛选_有笔记_描述"),
            "has-update": this.manager.translator.t("筛选_可更新_描述"),
        };
        // 过滤器
        const filterDropdown = new DropdownComponent(createFilterField(t("通用_状态_文本"), "list-filter"));
        filterDropdown.addOptions(filterOptions);
        filterDropdown.setValue(this.filter || "all");
        filterDropdown.selectEl.setAttribute("aria-label", t("筛选_状态_标签"));
        filterDropdown.onChange((value) => {
            this.filter = value;
            this.reloadShowData();
        });


        // [过滤行] 分组选择列表
        const groupCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const groupId = plugin.group || ""; acc[groupId] = (acc[groupId] || 0) + 1; return acc; }, { "": 0 });
        const groups = this.settings.GROUPS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${groupCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("筛选_全部_描述") });
        this.groupDropdown = new DropdownComponent(createFilterField(t("通用_分组_文本"), "folder-tree"));
        this.groupDropdown.addOptions(groups);
        this.groupDropdown.setValue(this.settings.PERSISTENCE ? this.settings.FILTER_GROUP : this.group);
        this.groupDropdown.selectEl.setAttribute("aria-label", t("筛选_分组_标签"));
        this.groupDropdown.onChange((value) => {
            if (this.settings.PERSISTENCE) {
                this.settings.FILTER_GROUP = value;
                this.manager.saveSettings();
            } else {
                this.group = value;
            }
            this.reloadShowData();
        });

        // [过滤行] 标签选择列表
        const tagCounts: { [key: string]: number } = this.settings.Plugins.reduce((acc, plugin) => { plugin.tags.forEach((tag) => { acc[tag] = (acc[tag] || 0) + 1; }); return acc; }, {} as { [key: string]: number });
        const tags = this.settings.TAGS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${tagCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("筛选_全部_描述") });
        this.tagDropdown = new DropdownComponent(createFilterField(t("通用_标签_文本"), "tags"));
        this.tagDropdown.addOptions(tags);
        this.tagDropdown.setValue(this.settings.PERSISTENCE ? this.settings.FILTER_TAG : this.tag);
        this.tagDropdown.selectEl.setAttribute("aria-label", t("筛选_标签_标签"));
        this.tagDropdown.onChange((value) => {
            if (this.settings.PERSISTENCE) {
                this.settings.FILTER_TAG = value;
                this.manager.saveSettings();
            } else {
                this.tag = value;
            }
            this.reloadShowData();
        });

        // [过滤行] 延迟选择列表
        if (this.settings.DELAY) {
            const delayCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const delay = plugin.delay || ""; acc[delay] = (acc[delay] || 0) + 1; return acc; }, { "": 0 });
            const delays = this.settings.DELAYS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} (${item.time}s) [${delayCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("筛选_全部_描述") });
            this.delayDropdown = new DropdownComponent(createFilterField(t("通用_延迟_文本"), "timer"));
            this.delayDropdown.addOptions(delays);
            this.delayDropdown.setValue(this.settings.PERSISTENCE ? this.settings.FILTER_DELAY : this.delay);
            this.delayDropdown.selectEl.setAttribute("aria-label", t("筛选_延迟_标签"));
            this.delayDropdown.onChange((value) => {
                if (this.settings.PERSISTENCE) {
                    this.settings.FILTER_DELAY = value;
                    this.manager.saveSettings();
                } else {
                    this.delay = value;
                }
                this.reloadShowData();
            });
        }

        // [搜索行] 搜索框
        const searchField = createFilterField(t("通用_搜索_文本"), "search", "search");
        this.searchEl = new SearchComponent(searchField);
        this.searchEl.inputEl.setAttribute("aria-label", t("筛选_搜索插件_标签"));
        if (this.settings.PERSISTENCE && typeof this.settings.FILTER_SEARCH === "string") {
            this.searchText = this.settings.FILTER_SEARCH;
            // 避免 setValue 触发额外渲染：先设置 input 值，再在 onChange 里统一处理
            this.searchEl.inputEl.value = this.searchText;
        }
        this.searchEl.onChange((value: string) => {
            this.searchText = value;
            if (this.settings.PERSISTENCE) {
                this.settings.FILTER_SEARCH = value;
                this.manager.saveSettings();
            }
            this.reloadShowData();
        });
    }

    private showHeadMobile() {
        const t = (k: any) => this.manager.translator.t(k);
        this.titleEl.empty();

        const header = this.titleEl.createDiv("bpm-mobile-header");
        const topRow = header.createDiv("bpm-mobile-header__top");

        const titleGroup = topRow.createDiv("bpm-mobile-header__identity");
        const titleMain = titleGroup.createDiv("bpm-mobile-header__main");
        const mark = titleMain.createDiv("manager-header__mark");
        mark.setAttribute("aria-hidden", "true");
        setIcon(mark, "blocks");
        const titleText = titleMain.createDiv("manager-header__title-group");
        titleText.createDiv({ cls: "manager-header__eyebrow", text: "BPM" });
        titleText.createEl("h2", {
            cls: "bpm-mobile-header__title",
            text: this.manager.translator.t("通用_管理器_文本"),
        });
        this.footEl = titleGroup.createDiv("manager-food bpm-mobile-header__stats");
        this.updateStats();

        const topActions = topRow.createDiv("bpm-mobile-header__actions");

        // 编辑模式
        const editorBtn = new ButtonComponent(topActions);
        editorBtn.setIcon(this.editorMode ? "pen-off" : "pen");
        editorBtn.setTooltip(t("管理器_编辑模式_描述"));
        this.bindLongPressTooltip(editorBtn.buttonEl, t("管理器_编辑模式_描述"));
        editorBtn.onClick(async () => {
            this.editorMode = !this.editorMode;
            this.applyEditingStyle();
            if (!this.editorMode) {
                await this.refreshFilterOptions(true);
            } else {
                this.renderContent();
            }
            this.showHeadMobile();
        });

        // 安装/返回
        const installBtn = new ButtonComponent(topActions);
        installBtn.setIcon(this.installMode ? "arrow-left" : "download");
        installBtn.setTooltip(this.installMode ? t("通用_返回_文本") : t("管理器_安装_GITHUB_描述"));
        this.bindLongPressTooltip(installBtn.buttonEl, this.installMode ? t("通用_返回_文本") : t("管理器_安装_GITHUB_描述"));
        installBtn.onClick(() => {
            this.installMode = !this.installMode;
            this.activePage = this.installMode ? "install" : "plugins";
            this.syncPageChrome();
            this.renderContent();
            this.showHeadMobile();
        });

        // 检查更新按钮
        const updateBtn = new ButtonComponent(topActions);
        this.preparePluginUpdateButton(updateBtn);

        // 更多操作菜单
        const moreBtn = new ButtonComponent(topActions);
        moreBtn.setIcon("more-vertical");
        moreBtn.setTooltip(t("管理器_更多操作_描述"));
        this.bindLongPressTooltip(moreBtn.buttonEl, t("管理器_更多操作_描述"));
        moreBtn.buttonEl.addEventListener("click", (ev) => {
            const menu = new Menu();
            menu.addItem((item) => item.setTitle(t("管理器_全选取消_描述")).setIcon("list-checks").onClick(() => {
                this.runDisplayedPluginsToggle();
            }));
            menu.addItem((item) => item.setTitle(t("排查_按钮_描述")).setIcon("search-check").onClick(() => {
                this.activePage = "troubleshoot";
                this.installMode = false;
                this.syncPageChrome();
                this.renderContent();
                this.showHeadMobile();
            }));
            menu.addItem((item) => item.setTitle(t("导入导出_Tab_标题")).setIcon("archive-restore").onClick(() => {
                this.activePage = "transfer";
                this.installMode = false;
                this.syncPageChrome();
                this.renderContent();
                this.showHeadMobile();
            }));
            menu.addItem((item) => item.setTitle(t("共享库_Tab_标题")).setIcon("folder-sync").onClick(() => {
                this.activePage = "vaults";
                this.installMode = false;
                this.syncPageChrome();
                this.renderContent();
                this.showHeadMobile();
            }));
            menu.addSeparator();
            // 重载插件
            menu.addItem((item) => item.setTitle(t("管理器_重载插件_描述")).setIcon("refresh-ccw").onClick(async () => {
                await this.appPlugins.loadManifests();
                // 同步新发现的插件到 BPM 管理列表
                this.manager.synchronizePlugins(
                    Object.values(this.appPlugins.manifests).filter(
                        (pm: PluginManifest) => pm.id !== this.manager.manifest.id
                    ) as PluginManifest[]
                );
                await this.reloadShowData();
            }));
            // 隐藏插件
            menu.addItem((item) => item.setTitle(t("菜单_隐藏插件_标题")).setIcon("eye-off").onClick(async () => {
                const all = Object.values(this.appPlugins.manifests) as PluginManifest[];
                const plugins: PluginManifest[] = all.filter((pm) => pm.id !== this.manager.manifest.id);
                plugins.sort((item1, item2) => item1.name.localeCompare(item2.name));
                new HideModal(this.app, this.manager, this, plugins).open();
            }));
            menu.addSeparator();
            // Ribbon 管理
            menu.addItem((item) => item.setTitle(t("管理器_Ribbon管理_描述")).setIcon("grip-vertical").onClick(() => {
                new RibbonModal(this.app, this.manager).open();
            }));
            // 插件市场
            menu.addItem((item) => item.setTitle(t("管理器_插件市场_描述")).setIcon("store").onClick(() => {
                void this.openPluginMarket();
            }));
            // 插件设置
            menu.addItem((item) => item.setTitle(t("管理器_插件设置_描述")).setIcon("settings").onClick(() => {
                this.appSetting.open();
                this.appSetting.openTabById(this.manager.manifest.id);
            }));
            menu.addItem((item) => item.setTitle(t("管理器_GITHUB_描述")).setIcon("github").onClick(() => {
                window.open("https://github.com/zenozero-dev/obsidian-manager");
            }));
            menu.addItem((item) => item.setTitle(t("管理器_视频教程_描述")).setIcon("book-open").onClick(() => {
                window.open("https://www.bilibili.com/video/BV1WyrkYMEce/");
            }));
            this.addSupportQQGroupMenuItem(menu);
            menu.showAtMouseEvent(ev as MouseEvent);
        });

        if (this.activePage !== "plugins") return;

        const searchWrap = header.createDiv("bpm-mobile-header__search");
        this.searchEl = new SearchComponent(searchWrap);
        if (this.settings.PERSISTENCE && typeof this.settings.FILTER_SEARCH === "string") {
            this.searchText = this.settings.FILTER_SEARCH;
            this.searchEl.inputEl.value = this.searchText;
        }
        this.searchEl.onChange((value: string) => {
            this.searchText = value;
            if (this.settings.PERSISTENCE) {
                this.settings.FILTER_SEARCH = value;
                this.manager.saveSettings();
            }
            this.reloadShowData();
        });

        const filterHeader = header.createDiv("bpm-mobile-header__filters-toggle");
        const arrow = filterHeader.createSpan({ cls: "bpm-mobile-header__filters-arrow" });
        arrow.setText(this.mobileFiltersCollapsed ? "▼" : "▲");
        filterHeader.createSpan({ text: t("通用_过滤_文本") });
        filterHeader.toggleClass("is-open", !this.mobileFiltersCollapsed);
        filterHeader.addEventListener("click", () => {
            this.mobileFiltersCollapsed = !this.mobileFiltersCollapsed;
            filterPanel.toggleClass("is-collapsed", this.mobileFiltersCollapsed);
            filterHeader.toggleClass("is-open", !this.mobileFiltersCollapsed);
            arrow.setText(this.mobileFiltersCollapsed ? "▼" : "▲");
        });

        // 激活筛选标签区域
        const activeFiltersContainer = header.createDiv("bpm-active-filters");
        const updateActiveFilters = () => {
            activeFiltersContainer.empty();
            const currentGroup = this.settings.PERSISTENCE ? this.settings.FILTER_GROUP : this.group;
            const currentTag = this.settings.PERSISTENCE ? this.settings.FILTER_TAG : this.tag;

            // 状态筛选标签
            if (this.filter && this.filter !== "all") {
                const filterLabels: Record<string, string> = {
                    "enabled": t("筛选_仅启用_描述"),
                    "disabled": t("筛选_仅禁用_描述"),
                    "grouped": t("筛选_已分组_描述"),
                    "ungrouped": t("筛选_未分组_描述"),
                    "tagged": t("筛选_有标签_描述"),
                    "untagged": t("筛选_无标签_描述"),
                    "noted": t("筛选_有笔记_描述"),
                };
                const chip = activeFiltersContainer.createDiv("bpm-active-filter-chip");
                chip.setText(filterLabels[this.filter] || this.filter);
                const closeIcon = chip.createSpan("bpm-active-filter-chip__close");
                setIcon(closeIcon, "x");
                chip.addEventListener("click", () => {
                    this.filter = "all";
                    this.showHeadMobile();
                    this.reloadShowData();
                });
            }

            // 分组筛选标签
            if (currentGroup) {
                const groupItem = this.settings.GROUPS.find(g => g.id === currentGroup);
                if (groupItem) {
                    const chip = activeFiltersContainer.createDiv("bpm-active-filter-chip");
                    chip.setText(groupItem.name);
                    const closeIcon = chip.createSpan("bpm-active-filter-chip__close");
                    setIcon(closeIcon, "x");
                    chip.addEventListener("click", () => {
                        if (this.settings.PERSISTENCE) {
                            this.settings.FILTER_GROUP = "";
                            this.manager.saveSettings();
                        } else {
                            this.group = "";
                        }
                        this.showHeadMobile();
                        this.reloadShowData();
                    });
                }
            }

            // 标签筛选标签
            if (currentTag) {
                const tagItem = this.settings.TAGS.find(t => t.id === currentTag);
                if (tagItem) {
                    const chip = activeFiltersContainer.createDiv("bpm-active-filter-chip");
                    chip.setText(tagItem.name);
                    const closeIcon = chip.createSpan("bpm-active-filter-chip__close");
                    setIcon(closeIcon, "x");
                    chip.addEventListener("click", () => {
                        if (this.settings.PERSISTENCE) {
                            this.settings.FILTER_TAG = "";
                            this.manager.saveSettings();
                        } else {
                            this.tag = "";
                        }
                        this.showHeadMobile();
                        this.reloadShowData();
                    });
                }
            }

            // 如果没有激活的筛选，隐藏容器
            if (activeFiltersContainer.childElementCount === 0) {
                activeFiltersContainer.style.display = "none";
            } else {
                activeFiltersContainer.style.display = "flex";
            }
        };
        updateActiveFilters();

        const filterPanel = header.createDiv(`bpm-mobile-header__filters${this.mobileFiltersCollapsed ? " is-collapsed" : ""}`);

        // 状态
        const statusSetting = new Setting(filterPanel).setName(t("通用_状态_文本"));
        statusSetting.addDropdown((dd) => {
            dd.addOptions({
                "all": t("筛选_全部_描述"),
                "enabled": t("筛选_仅启用_描述"),
                "disabled": t("筛选_仅禁用_描述"),
                "grouped": t("筛选_已分组_描述"),
                "ungrouped": t("筛选_未分组_描述"),
                "tagged": t("筛选_有标签_描述"),
                "untagged": t("筛选_无标签_描述"),
                "noted": t("筛选_有笔记_描述"),
            });
            dd.setValue(this.filter || "all");
            dd.onChange((v) => { this.filter = v; this.reloadShowData(); });
        });

        // 分组
        const groupCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const groupId = plugin.group || ""; acc[groupId] = (acc[groupId] || 0) + 1; return acc; }, { "": 0 });
        const groups = this.settings.GROUPS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${groupCounts[item.id] || 0}]`; return acc; }, { "": t("筛选_全部_描述") });
        const groupSetting = new Setting(filterPanel).setName(t("通用_分组_文本"));
        groupSetting.addDropdown((dd) => {
            dd.addOptions(groups);
            dd.setValue(this.settings.PERSISTENCE ? this.settings.FILTER_GROUP : this.group);
            dd.onChange((value) => {
                if (this.settings.PERSISTENCE) {
                    this.settings.FILTER_GROUP = value;
                    this.manager.saveSettings();
                } else {
                    this.group = value;
                }
                this.reloadShowData();
            });
        });

        // 标签
        const tagCounts: { [key: string]: number } = this.settings.Plugins.reduce((acc, plugin) => { plugin.tags.forEach((tag) => { acc[tag] = (acc[tag] || 0) + 1; }); return acc; }, {} as { [key: string]: number });
        const tags = this.settings.TAGS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${tagCounts[item.id] || 0}]`; return acc; }, { "": t("筛选_全部_描述") });
        const tagSetting = new Setting(filterPanel).setName(t("通用_标签_文本"));
        tagSetting.addDropdown((dd) => {
            dd.addOptions(tags);
            dd.setValue(this.settings.PERSISTENCE ? this.settings.FILTER_TAG : this.tag);
            dd.onChange((value) => {
                if (this.settings.PERSISTENCE) {
                    this.settings.FILTER_TAG = value;
                    this.manager.saveSettings();
                } else {
                    this.tag = value;
                }
                this.reloadShowData();
            });
        });

        // 延迟
        if (this.settings.DELAY) {
            const delayCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const delay = plugin.delay || ""; acc[delay] = (acc[delay] || 0) + 1; return acc; }, { "": 0 });
            const delays = this.settings.DELAYS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} (${delayCounts[item.id] || 0})`; return acc; }, { "": t("筛选_全部_描述") });
            const delaySetting = new Setting(filterPanel).setName(t("通用_延迟_文本"));
            delaySetting.addDropdown((dd) => {
                dd.addOptions(delays);
                dd.setValue(this.settings.PERSISTENCE ? this.settings.FILTER_DELAY : this.delay);
                dd.onChange((value) => {
                    if (this.settings.PERSISTENCE) {
                        this.settings.FILTER_DELAY = value;
                        this.manager.saveSettings();
                    } else {
                        this.delay = value;
                    }
                    this.reloadShowData();
                });
            });
        }
    }

    /** 移动端底部操作栏 */
    private showMobileFooter() {
        const t = (k: any) => this.manager.translator.t(k);

        // 移除已存在的底部栏
        const existingFooter = this.modalEl.querySelector(".bpm-mobile-footer");
        if (existingFooter) existingFooter.remove();

        const footer = document.createElement("div");
        footer.addClass("bpm-mobile-footer");

        // 创建底部按钮的辅助函数
        const createFooterBtn = (icon: string, label: string, onClick: () => void) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.addClass("bpm-mobile-footer__btn");
            btn.setAttribute("aria-label", label);
            setIcon(btn, icon);
            const labelEl = document.createElement("span");
            labelEl.addClass("bpm-mobile-footer__btn-label");
            labelEl.setText(label);
            btn.appendChild(labelEl);
            btn.addEventListener("click", onClick);
            this.bindLongPressTooltip(btn, label);
            return btn;
        };

        // 全选/全部取消按钮
        const toggleAllBtn = createFooterBtn("list-checks", t("管理器_全选取消_描述"), () => {
            this.runDisplayedPluginsToggle();
        });
        footer.appendChild(toggleAllBtn);

        // 检查更新按钮
        const updateBtn = createFooterBtn("rss", t("管理器_检查更新_描述"), () => {
            void this.runPluginUpdateCheck(updateBtn);
        });
        updateBtn.addClass("manager-update-trigger");
        footer.appendChild(updateBtn);

        // 设置按钮
        const settingsBtn = createFooterBtn("settings", t("管理器_插件设置_描述"), () => {
            this.appSetting.open();
            this.appSetting.openTabById(this.manager.manifest.id);
        });
        footer.appendChild(settingsBtn);

        // 更多按钮
        const moreBtn = createFooterBtn("more-horizontal", t("管理器_更多操作_描述"), () => { });
        moreBtn.addEventListener("click", (ev) => {
            const menu = new Menu();
            menu.addItem((item) => item.setTitle(t("管理器_重载插件_描述")).setIcon("refresh-ccw").onClick(async () => {
                await this.appPlugins.loadManifests();
                await this.reloadShowData();
            }));
            menu.addItem((item) => item.setTitle(t("菜单_隐藏插件_标题")).setIcon("eye-off").onClick(async () => {
                const all = Object.values(this.appPlugins.manifests) as PluginManifest[];
                const plugins: PluginManifest[] = all.filter((pm) => pm.id !== this.manager.manifest.id);
                plugins.sort((item1, item2) => item1.name.localeCompare(item2.name));
                new HideModal(this.app, this.manager, this, plugins).open();
            }));
            menu.addSeparator();
            menu.addItem((item) => item.setTitle(t("管理器_GITHUB_描述")).setIcon("github").onClick(() => {
                window.open("https://github.com/zenozero-dev/obsidian-manager");
            }));
            menu.addItem((item) => item.setTitle(t("管理器_视频教程_描述")).setIcon("book-open").onClick(() => {
                window.open("https://www.bilibili.com/video/BV1WyrkYMEce/");
            }));
            this.addSupportQQGroupMenuItem(menu);
            menu.showAtMouseEvent(ev as MouseEvent);
        });
        footer.appendChild(moreBtn);

        this.modalEl.appendChild(footer);
    }

    public async showData(renderGeneration = this.renderGeneration) {
        // 使用 manifests 按 id 去重，防止重复渲染
        const page: ManagerPage = "plugins";
        if (!this.isRenderCurrent(renderGeneration, page)) return;
        const manifestMap = this.appPlugins.manifests;
        if (this.settings.DEBUG) console.log("[BPM] render showData manifests size:", Object.keys(manifestMap).length);
        const uniqMap = new Map<string, PluginManifest>();
        Object.values(manifestMap).forEach((mf: PluginManifest) => {
            uniqMap.set(mf.id, mf);
        });
        const uniquePlugins = Array.from(uniqMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        const manifestById = new Map(uniquePlugins.map((plugin) => [plugin.id, plugin]));
        const layoutItems = this.getPluginLayout(uniquePlugins);
        const showSeparators = this.shouldRenderPluginLayoutSeparators();
        let pendingSeparator: string | null = null;
        if (this.settings.DEBUG) console.log("[BPM] render showData uniquePlugins:", uniquePlugins.map(p => p.id).join(","));

        if (this.settings.DEBUG) console.log("[BPM] render showData before loop, children:", this.contentEl.children.length);
        this.displayPlugins = [];
        const renderedIds = new Set<string>();
        for (const layoutItem of layoutItems) {
            if (!this.isRenderCurrent(renderGeneration, page)) return;
            if (layoutItem.type === "separator") {
                if (showSeparators) pendingSeparator = layoutItem.title || this.manager.translator.t("管理器_布局_分割线");
                continue;
            }
            const plugin = manifestById.get(layoutItem.id);
            if (!plugin) continue;
            if (renderedIds.has(plugin.id)) continue;
            renderedIds.add(plugin.id);
            const ManagerPlugin = this.manager.settings.Plugins.find((mp) => mp.id === plugin.id);
            // 计算插件目录的绝对路径：基于 vault 根路径 + configDir + plugin.dir
            const getBasePath = (this.app.vault.adapter as any)?.getBasePath?.() as string | undefined;
            const basePath = getBasePath ? normalizePath(getBasePath) : "";
            const cfgDir = this.app.vault.configDir; // 默认 .obsidian
            const rawDir = plugin.dir || `plugins/${plugin.id}`;
            const isAbsolute = new RegExp("^(?:[a-zA-Z]:[\\\\/]|[\\\\/])").test(rawDir);
            let pluginDir: string;
            if (isAbsolute) {
                pluginDir = normalizePath(rawDir);
            } else if (rawDir.startsWith(cfgDir) || rawDir.startsWith(".") || rawDir.startsWith("/")) {
                // 已包含 .obsidian 或以相对根路径开头，直接拼 vault 根路径
                pluginDir = normalizePath(`${basePath}/${rawDir}`);
            } else {
                // 仅给出 plugins/<id> 相对路径，补上 configDir
                pluginDir = normalizePath(`${basePath}/${cfgDir}/${rawDir}`);
            }
            if (this.settings.DEBUG) console.log("[BPM] render item", plugin.id, "children before add:", this.contentEl.children.length);
            if (!ManagerPlugin) continue;
            const isSelf = plugin.id === this.manager.manifest.id;
            // 插件是否开启
            const isEnabled = this.settings.DELAY ? ManagerPlugin.enabled : this.appPlugins.enabledPlugins.has(plugin.id);
            // [过滤] 条件
            switch (this.filter) {
                case "enabled":
                    if (!isEnabled) continue; // 仅显示启用插件
                    break;
                case "disabled":
                    if (isEnabled) continue; // 仅显示禁用插件
                    break;
                case "grouped":
                    if (ManagerPlugin.group === "") continue; // 仅显示有分组的插件
                    break;
                case "ungrouped":
                    if (ManagerPlugin.group !== "") continue; // 仅显示未分组插件
                    break;
                case "tagged":
                    if (ManagerPlugin.tags.length === 0) continue; // 修正为标签数组长度判断
                    break;
                case "untagged":
                    if (ManagerPlugin.tags.length > 0) continue;  // 修正为标签数组长度判断
                    break;
                case "noted":
                    if (!ManagerPlugin.note || ManagerPlugin.note === "") continue; // 新增笔记判断
                    break;
                case "has-update":
                    if (!this.manager.updateStatus[plugin.id]?.hasUpdate) continue; // 仅显示有更新插件
                    break;
                default:
                    break; // 其他情况显示所有插件
            }
            // [过滤] 筛选
            if (this.settings.PERSISTENCE) {
                // [搜索] 分组
                if (this.settings.FILTER_GROUP !== "" && ManagerPlugin.group !== this.settings.FILTER_GROUP) continue;
                // [搜索] 标签
                if (this.settings.FILTER_TAG !== "" && !ManagerPlugin.tags.includes(this.settings.FILTER_TAG)) continue;
                // [搜索] 标签
                if (this.settings.FILTER_DELAY !== "" && ManagerPlugin.delay !== this.settings.FILTER_DELAY) continue;
            } else {
                // [搜索] 分组
                if (this.group !== "" && ManagerPlugin.group !== this.group) continue;
                // [搜索] 标签
                if (this.tag !== "" && !ManagerPlugin.tags.includes(this.tag)) continue;
                // [搜索] 标签
                if (this.delay !== "" && ManagerPlugin.delay !== this.delay) continue;
            }
            // [过滤] 搜索
            if (this.searchText !== "" && ManagerPlugin.name.toLowerCase().indexOf(this.searchText.toLowerCase()) == -1 && ManagerPlugin.desc.toLowerCase().indexOf(this.searchText.toLowerCase()) == -1 && plugin.author.toLowerCase().indexOf(this.searchText.toLowerCase()) == -1) continue;
            // [过滤] 隐藏
            if (!isSelf && this.settings.HIDES.includes(plugin.id)) continue;

            if (pendingSeparator && this.displayPlugins.length > 0) {
                this.renderPluginLayoutSeparator(pendingSeparator);
            }
            pendingSeparator = null;

            const itemEl = new Setting(this.contentEl);
            itemEl.settingEl.setAttr("data-plugin-id", plugin.id);
            itemEl.setClass("manager-item");
            itemEl.settingEl.addClass("manager-plugin-card");
            itemEl.settingEl.toggleClass("is-enabled", isEnabled);
            itemEl.settingEl.toggleClass("is-disabled", !isEnabled);
            itemEl.settingEl.toggleClass("is-self", isSelf);
            itemEl.settingEl.toggleClass("has-update", Boolean(this.manager.updateStatus?.[plugin.id]?.hasUpdate));
            itemEl.settingEl.toggleClass("is-bpm-ignored", ManagerPlugin.tags.includes(BPM_IGNORE_TAG));
            itemEl.nameEl.addClass("manager-item__name-container");
            itemEl.nameEl.addClass("manager-plugin-card__header");
            itemEl.descEl.addClass("manager-item__description-container");
            itemEl.descEl.addClass("manager-plugin-card__body");
            itemEl.controlEl.addClass("manager-item__controls");
            itemEl.controlEl.addClass("manager-plugin-card__actions");
            itemEl.controlEl.setAttribute("aria-label", this.manager.translator.t("管理器_插件操作_标签", { name: ManagerPlugin.name }));

            // [右键操作]
            itemEl.settingEl.addEventListener("contextmenu", (event) => {
                event.preventDefault(); // 阻止默认的右键菜单
                const menu = new Menu();
                let hasContextMenuItems = false;
                const addContextSeparator = () => {
                    if (hasContextMenuItems) menu.addSeparator();
                };
                // 第一组：插件信息类
                if (this.isMainPageActionInMenu("checkUpdate")) {
                    menu.addItem((item) =>
                        item.setTitle(this.manager.translator.t("菜单_检查更新_标题"))
                            .setIcon("rss")
                            .onClick(async () => {
                                await this.runSinglePluginUpdateCheck(plugin.id);
                            })
                    );
                    hasContextMenuItems = true;
                }
                const currentUpdateInfo = this.manager.updateStatus?.[plugin.id] as PluginUpdateViewStatus | undefined;
                if (this.isMainPageActionInMenu("downloadUpdate") && currentUpdateInfo?.hasUpdate && currentUpdateInfo.remoteVersion) {
                    menu.addItem((item) =>
                        item.setTitle(this.manager.translator.t("管理器_下载更新_描述"))
                            .setIcon("download")
                            .onClick(() => {
                                this.openPluginUpdateModal(plugin.id, currentUpdateInfo);
                            })
                    );
                    hasContextMenuItems = true;
                }
                // 第二组：插件管理类
                const hasManageMenuItems = (!this.settings.DELAY && (this.isMainPageActionInMenu("singleStart") || this.isMainPageActionInMenu("restart"))) || this.isMainPageActionInMenu("hide");
                if (hasManageMenuItems) addContextSeparator();
                // [菜单] 单次启动
                if (!this.settings.DELAY && this.isMainPageActionInMenu("singleStart")) menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_单次启动_描述"))
                        .setIcon("repeat-1")
                        .setDisabled(isSelf || isEnabled)
                        .onClick(async () => {
                            await this.singleStartPlugin(plugin);
                        })
                );
                // [菜单] 重启插件
                if (!this.settings.DELAY && this.isMainPageActionInMenu("restart")) menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_重启插件_描述"))
                        .setIcon("refresh-ccw")
                        .setDisabled(isSelf || !isEnabled)
                        .onClick(async () => {
                            await this.restartPlugin(plugin);
                        })
                );
                // [菜单] 隐藏插件
                if (this.isMainPageActionInMenu("hide")) menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_隐藏插件_标题"))
                        .setIcon("eye-off")
                        .setDisabled(isSelf)
                        .onClick(() => {
                            if (isSelf) return;
                            this.togglePluginHidden(plugin.id);
                        })
                );
                if (hasManageMenuItems) hasContextMenuItems = true;
                // [菜单] 分享插件
                // menu.addItem((item) =>
                //     item.setTitle("分享插件_标题")
                //         .setIcon("share-2")
                //         .onClick(() => {
                //             const plugins: PluginManifest[] = Object.values(this.appPlugins.manifests);
                //             plugins.sort((item1, item2) => { return item1.name.localeCompare(item2.name); });
                //         })
                // );

                const hasOpenMenuItems = this.isMainPageActionInMenu("openSettings") || this.isMainPageActionInMenu("openDir") || this.isMainPageActionInMenu("openRepo") || this.isMainPageActionInMenu("delete");
                if (hasOpenMenuItems) addContextSeparator();
                if (this.isMainPageActionInMenu("openSettings")) {
                    menu.addItem((item) =>
                        item.setTitle(this.manager.translator.t("管理器_打开设置_描述"))
                            .setIcon("settings")
                            .setDisabled(!isEnabled)
                            .onClick(() => {
                                this.appSetting.open();
                                this.appSetting.openTabById(plugin.id);
                            })
                    );
                }
                if (this.isMainPageActionInMenu("openDir")) {
                    menu.addItem((item) =>
                        item.setTitle(this.manager.translator.t("管理器_打开目录_描述"))
                            .setIcon("folder-open")
                            .onClick(() => {
                                managerOpen(pluginDir, this.manager);
                            })
                    );
                }
                if (this.isMainPageActionInMenu("openRepo")) {
                    menu.addItem((item) =>
                        item.setTitle(this.manager.translator.t("管理器_打开仓库_标题"))
                            .setIcon("github")
                            .onClick(async () => {
                                await this.openPluginRepo(plugin.id);
                            })
                    );
                }
                if (this.isMainPageActionInMenu("delete")) {
                    menu.addItem((item) =>
                        item.setTitle(this.manager.translator.t("管理器_删除插件_描述"))
                            .setIcon("trash")
                            .setDisabled(isSelf)
                            .onClick(async () => {
                                await this.uninstallPluginWithConfirm(plugin, isSelf);
                            })
                    );
                }
                if (hasOpenMenuItems) hasContextMenuItems = true;

                // 第三组：插件设置类
                const hasConfigMenuItems = this.isMainPageActionInMenu("note") || this.isMainPageActionInMenu("hotkeys") || this.isMainPageActionInMenu("copyId");
                if (hasConfigMenuItems) addContextSeparator();
                // [菜单] 插件笔记
                if (this.isMainPageActionInMenu("note")) menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_笔记_标题")).setIcon("notebook-pen").onClick(() => { new NoteModal(this.app, this.manager, ManagerPlugin, this).open(); })
                );
                // [菜单] 快捷键
                if (this.isMainPageActionInMenu("hotkeys")) menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_快捷键_标题")).setIcon("circle-plus").onClick(async () => {
                        await this.openPluginHotkeys(plugin.id);
                    })
                );
                // [菜单] 复制ID
                if (this.isMainPageActionInMenu("copyId")) menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_复制ID_标题"))
                        .setIcon("copy")
                        .onClick(() => {
                            navigator.clipboard.writeText(plugin.id);
                            new Notice(this.manager.translator.t("通知_ID已复制"));
                        })
                );
                if (hasConfigMenuItems) hasContextMenuItems = true;
                // 第三组：测试类
                // menu.addSeparator(); // 分隔符

                // menu.addItem((item) =>
                //     item.setTitle("打开市场")
                //         .setIcon("store")
                //         .onClick(async () => {
                //             // await this.app.setting.open();
                //             // await this.app.setting.openTabById("community-plugins");
                //             // // 可选：自动聚焦搜索框
                //             // const tab = await this.app.setting.activeTab;
                //             // tab.searchComponent.inputEl.focus();

                //             await this.appSetting.open();
                //             await this.appSetting.openTabById("community-plugins");
                //             console.log(this.appSetting);
                //             setTimeout(async () => {
                //                 const tab = await this.appSetting.activeTab;
                //                 const button = tab.containerEl.querySelector('button.mod-cta');
                //                 if (button) (button as HTMLElement).click();

                //             });
                //         })
                // );


                // menu.addSeparator();
                // menu.addItem((item) =>
                //     item.setTitle("分组")
                //         .setIcon("group")
                //         .onClick(async () => {
                //         })
                // );
                // menu.addItem((item) =>
                //     item.setTitle("标签")
                //         .setIcon("tags")
                //         .setDisabled(isEnabled)
                //         .onClick(async () => {
                //         })
                // );
                menu.showAtPosition({ x: event.clientX, y: event.clientY });
            });

            // [淡化插件]
            if (this.settings.FADE_OUT_DISABLED_PLUGINS && !isEnabled) itemEl.settingEl.addClass("inactive");

            // [批量操作]
            this.displayPlugins.push(plugin);

            // [目录样式]
            if (!this.editorMode) {
                switch (this.settings.ITEM_STYLE) {
                    case "alwaysExpand": itemEl.descEl.addClass("manager-display-block"); break;
                    case "neverExpand": itemEl.descEl.addClass("manager-display-none"); break;
                    case "hoverExpand":
                        itemEl.descEl.addClass("manager-display-none");
                        itemEl.settingEl.addEventListener(
                            "mouseenter",
                            () => {
                                itemEl.descEl.removeClass("manager-display-none");
                                itemEl.descEl.addClass("manager-display-block");
                            }
                        );
                        itemEl.settingEl.addEventListener(
                            "mouseleave",
                            () => {
                                itemEl.descEl.removeClass("manager-display-block");
                                itemEl.descEl.addClass("manager-display-none");
                            }
                        );
                        break;
                    case "clickExpand":
                        itemEl.descEl.addClass("manager-display-none");
                        itemEl.settingEl.addEventListener(
                            "click",
                            function (event) {
                                const excludedButtons = Array.from(
                                    itemEl.controlEl.querySelectorAll("div")
                                );
                                if (
                                    // @ts-ignore
                                    excludedButtons.includes(event.target)
                                ) {
                                    event.stopPropagation();
                                    return;
                                }
                                if (
                                    itemEl.descEl.hasClass("manager-display-none")
                                ) {
                                    itemEl.descEl.removeClass("manager-display-none");
                                    itemEl.descEl.addClass("manager-display-block");
                                } else {
                                    itemEl.descEl.removeClass("manager-display-block");
                                    itemEl.descEl.addClass("manager-display-none");
                                }
                            }
                        );
                        break;
                }
            }

            const cardIcon = createSpan({ cls: "manager-plugin-card__icon" });
            cardIcon.setAttribute("aria-hidden", "true");
            setIcon(cardIcon, isEnabled ? "plug-zap" : "plug");
            itemEl.nameEl.appendChild(cardIcon);

            // [默认] 分组
            if (ManagerPlugin.group !== "") {
                const group = createSpan({ cls: "manager-item__name-group", });
                itemEl.nameEl.appendChild(group);
                const item = this.settings.GROUPS.find((t) => t.id === ManagerPlugin.group);
                if (item) {
                    const tag = this.manager.createTag(item.name, item.color, this.settings.GROUP_STYLE);
                    if (this.editorMode) tag.onclick = () => { new GroupModal(this.app, this.manager, this, ManagerPlugin).open(); };
                    group.appendChild(tag);
                }
            }
            // [编辑] 分组
            if (ManagerPlugin.group === "" && this.editorMode) {
                const group = createSpan({ cls: "manager-item__name-group", });
                if (this.editorMode) itemEl.nameEl.appendChild(group);
                const tag = this.manager.createTag("+", "", "");
                if (this.editorMode) tag.onclick = () => { new GroupModal(this.app, this.manager, this, ManagerPlugin).open(); };
                if (this.editorMode) group.appendChild(tag);
            }

            // [默认] 名称
            const title = createSpan({ text: ManagerPlugin.name, title: plugin.name, cls: "manager-item__name-title", });
            // [编辑] 名称
            if (this.editorMode) {
                title.setAttribute("style", "border-width: 1px;border-style: dashed;");
                title.setAttribute("contenteditable", "true");
                title.addEventListener("input", async () => {
                    if (title.textContent) {
                        ManagerPlugin.name = title.textContent;
                        await this.manager.savePluginAndExport(plugin.id);
                        Commands(this.app, this.manager);
                    }
                });
            }
            itemEl.nameEl.appendChild(title);

            const statusChip = createSpan({
                text: isSelf
                    ? this.manager.translator.t("管理器_状态_管理器")
                    : (isEnabled ? this.manager.translator.t("管理器_状态_启用中") : this.manager.translator.t("管理器_状态_已禁用")),
                cls: `manager-plugin-card__state ${isSelf ? "is-self" : (isEnabled ? "is-enabled" : "is-disabled")}`,
            });
            itemEl.nameEl.appendChild(statusChip);

            // [默认] 版本
            const versionWrap = createDiv({ cls: "manager-item__versions" });
            const version = createSpan({ text: `[${plugin.version}]`, cls: ["manager-item__name-version"], });
            versionWrap.appendChild(version);
            if (!this.editorMode) {
                versionWrap.addClass("manager-item__versions--clickable");
                versionWrap.addEventListener("click", async () => {
                    const progress = this.showInlineProgress(this.manager.translator.t("通知_获取版本中文案"), plugin.id);
                    progress.update(0, 1, plugin.id);
                    try {
                        const st = await this.manager.checkUpdateForPlugin(plugin.id);
                        progress.update(1, 1, plugin.id);
                        this.refreshSinglePluginUpdateUi(plugin.id);
                        this.updateStats();
                        const versions = st?.versions && st.versions.length > 0
                            ? st.versions
                            : st?.remoteVersion
                                ? [{ version: st.remoteVersion, prerelease: /-/.test(st.remoteVersion) }]
                                : [];
                        new UpdateModal(this.app, this.manager, plugin.id, versions, st?.remoteVersion ?? null, st?.repo || undefined).open();
                    } catch (e) {
                        console.error("[BPM] fetch remote versions failed", e);
                        new Notice(this.manager.translator.t("管理器_选择版本_获取失败提示"), 4000);
                    } finally {
                        progress.hide();
                    }
                });
            }
            const updateInfo = this.manager.updateStatus?.[plugin.id];
            if (updateInfo?.hasUpdate && updateInfo.remoteVersion) {
                const arrow = createSpan({ text: "→", cls: ["manager-item__name-remote-arrow"] });
                versionWrap.appendChild(arrow);
                const remote = createSpan({ text: `${updateInfo.remoteVersion}`, cls: ["manager-item__name-remote"] });
                versionWrap.appendChild(remote);
                if (!this.editorMode) {
                    this.addPluginDownloadButton(itemEl.controlEl, plugin.id, updateInfo);
                }
            }
            itemEl.nameEl.appendChild(versionWrap);

            // [默认] 笔记图标
            if (ManagerPlugin.note?.length > 0) {
                const note = createSpan();
                note.addClass("manager-plugin-card__note");
                note.style.cssText = "width:16px; height:16px; display:inline-flex; color: var(--text-accent);";
                note.addEventListener("click", () => { new NoteModal(this.app, this.manager, ManagerPlugin, this).open(); });
                itemEl.nameEl.appendChild(note);
                setIcon(note, "notebook-pen");
            }

            // [默认] 延迟
            if (this.settings.DELAY && !this.editorMode && !isSelf && ManagerPlugin.delay !== "") {
                const d = this.settings.DELAYS.find((item) => item.id === ManagerPlugin.delay);
                if (d) {
                    const delay = createSpan({ text: `${d.time}s`, cls: ["manager-item__name-delay"], });
                    itemEl.nameEl.appendChild(delay);
                }
            }
            // [默认] 描述
            const hasDescription = ManagerPlugin.desc.trim().length > 0;
            const desc = createDiv({ text: ManagerPlugin.desc, title: plugin.description, cls: ["manager-item__name-desc"], });
            desc.addClass("manager-plugin-card__desc");

            // [编辑] 描述
            if (this.editorMode) {
                desc.setAttribute("style", "border-width: 1px;border-style: dashed");
                desc.setAttribute("contenteditable", "true");
                desc.addEventListener("input", async () => {
                    if (desc.textContent) {
                        ManagerPlugin.desc = desc.textContent;
                        await this.manager.savePluginAndExport(plugin.id);
                    }
                });
            }
            itemEl.descEl.appendChild(desc);

            // [默认] 标签组
            const tags = createDiv();
            tags.addClass("manager-plugin-card__tags");
            itemEl.descEl.appendChild(tags);
            let visibleTagCount = 0;
            ManagerPlugin.tags.map((id: string) => {
                const item = this.settings.TAGS.find((item) => item.id === id);
                if (item) {
                    if ((item.id === BPM_TAG_ID || item.id === BPM_IGNORE_TAG) && this.settings.HIDE_BPM_TAG) {
                        // skip render
                    } else {
                        const tag = this.manager.createTag(item.name, item.color, this.settings.TAG_STYLE);
                        if (this.editorMode && item.id !== BPM_TAG_ID) tag.onclick = () => { new TagsModal(this.app, this.manager, this, ManagerPlugin).open(); };
                        tags.appendChild(tag);
                        visibleTagCount++;
                    }
                }
            });

            // [编辑] 标签组
            if (this.editorMode) {
                const tag = this.manager.createTag("+", "", "");
                tag.onclick = () => { new TagsModal(this.app, this.manager, this, ManagerPlugin).open(); };
                tags.appendChild(tag);
            }

            const hasVisibleTags = this.editorMode || visibleTagCount > 0;
            const hasExpandedDetails = this.editorMode || hasDescription || hasVisibleTags;
            itemEl.settingEl.toggleClass("has-description", hasDescription);
            itemEl.settingEl.toggleClass("has-visible-tags", hasVisibleTags);
            itemEl.descEl.toggleClass("manager-plugin-card__body--empty", !hasExpandedDetails);

            if (!this.editorMode) {
                const isMobile = Platform.isMobileApp;

                let openPluginSetting: ExtraButtonComponent | null = null;
                let openPluginSettingEl: HTMLElement | undefined;

                if (isMobile && [
                    "checkUpdate",
                    "downloadUpdate",
                    "singleStart",
                    "restart",
                    "hide",
                    "note",
                    "hotkeys",
                    "copyId",
                    "openRepo",
                    "openSettings",
                    "openDir",
                    "delete",
                ].some((id) => this.isMainPageActionInMenu(id as MainPageActionId))) {
                    const moreButton = new ExtraButtonComponent(itemEl.controlEl);
                    moreButton.setIcon("more-vertical");
                    moreButton.setTooltip(this.manager.translator.t("管理器_更多操作_描述"));
                    const moreEl = ((moreButton as any).extraSettingsEl || (moreButton as any).buttonEl) as HTMLElement | undefined;
                    this.bindLongPressTooltip(moreEl, this.manager.translator.t("管理器_更多操作_描述"));
                    moreEl?.addEventListener("click", (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const menu = new Menu();
                        let hasPreviousGroup = false;
                        let hasCurrentGroup = false;
                        if (this.isMainPageActionInMenu("checkUpdate")) {
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("菜单_检查更新_标题"))
                                .setIcon("rss")
                                .onClick(async () => {
                                    await this.runSinglePluginUpdateCheck(plugin.id);
                                }));
                            hasCurrentGroup = true;
                        }
                        const currentUpdateInfo = this.manager.updateStatus?.[plugin.id] as PluginUpdateViewStatus | undefined;
                        if (this.isMainPageActionInMenu("downloadUpdate") && currentUpdateInfo?.hasUpdate && currentUpdateInfo.remoteVersion) {
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("管理器_下载更新_描述"))
                                .setIcon("download")
                                .onClick(() => {
                                    this.openPluginUpdateModal(plugin.id, currentUpdateInfo);
                                }));
                            hasCurrentGroup = true;
                        }
                        hasPreviousGroup = hasCurrentGroup;
                        hasCurrentGroup = false;

                        if (!this.settings.DELAY && this.isMainPageActionInMenu("singleStart")) {
                            if (hasPreviousGroup && !hasCurrentGroup) menu.addSeparator();
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("菜单_单次启动_描述"))
                                .setIcon("repeat-1")
                                .setDisabled(isSelf || isEnabled)
                                .onClick(async () => {
                                    await this.singleStartPlugin(plugin);
                                }));
                            hasCurrentGroup = true;
                        }
                        if (!this.settings.DELAY && this.isMainPageActionInMenu("restart")) {
                            if (hasPreviousGroup && !hasCurrentGroup) menu.addSeparator();
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("菜单_重启插件_描述"))
                                .setIcon("refresh-ccw")
                                .setDisabled(isSelf || !isEnabled)
                                .onClick(async () => {
                                    await this.restartPlugin(plugin);
                                }));
                            hasCurrentGroup = true;
                        }
                        if (this.isMainPageActionInMenu("hide")) {
                            if (hasPreviousGroup && !hasCurrentGroup) menu.addSeparator();
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("菜单_隐藏插件_标题"))
                                .setIcon("eye-off")
                                .setDisabled(isSelf)
                                .onClick(() => {
                                    if (isSelf) return;
                                    this.togglePluginHidden(plugin.id);
                                }));
                            hasCurrentGroup = true;
                        }
                        hasPreviousGroup = hasPreviousGroup || hasCurrentGroup;
                        hasCurrentGroup = false;

                        if (this.isMainPageActionInMenu("openSettings")) {
                            if (hasPreviousGroup && !hasCurrentGroup) menu.addSeparator();
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("管理器_打开设置_描述"))
                                .setIcon("settings")
                                .setDisabled(!isEnabled)
                                .onClick(() => {
                                    this.appSetting.open();
                                    this.appSetting.openTabById(plugin.id);
                                }));
                            hasCurrentGroup = true;
                        }
                        if (this.isMainPageActionInMenu("openDir")) {
                            if (hasPreviousGroup && !hasCurrentGroup) menu.addSeparator();
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("管理器_打开目录_描述"))
                                .setIcon("folder-open")
                                .onClick(() => {
                                    managerOpen(pluginDir, this.manager);
                                }));
                            hasCurrentGroup = true;
                        }
                        if (this.isMainPageActionInMenu("openRepo")) {
                            if (hasPreviousGroup && !hasCurrentGroup) menu.addSeparator();
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("管理器_打开仓库_标题"))
                                .setIcon("github")
                                .onClick(async () => {
                                    await this.openPluginRepo(plugin.id);
                                }));
                            hasCurrentGroup = true;
                        }
                        if (this.isMainPageActionInMenu("delete")) {
                            if (hasPreviousGroup && !hasCurrentGroup) menu.addSeparator();
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("管理器_删除插件_描述"))
                                .setIcon("trash")
                                .setDisabled(isSelf)
                                .onClick(async () => {
                                    await this.uninstallPluginWithConfirm(plugin, isSelf);
                                }));
                            hasCurrentGroup = true;
                        }
                        hasPreviousGroup = hasPreviousGroup || hasCurrentGroup;
                        hasCurrentGroup = false;

                        if (this.isMainPageActionInMenu("note")) {
                            if (hasPreviousGroup && !hasCurrentGroup) menu.addSeparator();
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("菜单_笔记_标题"))
                                .setIcon("notebook-pen")
                                .onClick(() => { new NoteModal(this.app, this.manager, ManagerPlugin, this).open(); }));
                            hasCurrentGroup = true;
                        }
                        if (this.isMainPageActionInMenu("hotkeys")) {
                            if (hasPreviousGroup && !hasCurrentGroup) menu.addSeparator();
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("菜单_快捷键_标题"))
                                .setIcon("circle-plus")
                                .onClick(async () => {
                                    await this.openPluginHotkeys(plugin.id);
                                }));
                            hasCurrentGroup = true;
                        }
                        if (this.isMainPageActionInMenu("copyId")) {
                            if (hasPreviousGroup && !hasCurrentGroup) menu.addSeparator();
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("菜单_复制ID_标题"))
                                .setIcon("copy")
                                .onClick(() => {
                                    navigator.clipboard.writeText(plugin.id);
                                    new Notice(this.manager.translator.t("通知_ID已复制"));
                                }));
                        }
                        menu.showAtMouseEvent(event as MouseEvent);
                    });
                }

                const checkUpdateButton = this.createConfiguredItemAction(itemEl.controlEl, "checkUpdate");
                if (checkUpdateButton) {
                    checkUpdateButton.setIcon("rss");
                    checkUpdateButton.setTooltip(this.manager.translator.t("菜单_检查更新_标题"));
                    checkUpdateButton.onClick(async () => {
                        await this.runSinglePluginUpdateCheck(plugin.id);
                    });
                }

                if (!this.settings.DELAY) {
                    const singleStartButton = this.createConfiguredItemAction(itemEl.controlEl, "singleStart");
                    if (singleStartButton) {
                        singleStartButton.setIcon("repeat-1");
                        singleStartButton.setTooltip(this.manager.translator.t("菜单_单次启动_描述"));
                        singleStartButton.setDisabled(isSelf || isEnabled);
                        singleStartButton.onClick(async () => {
                            await this.singleStartPlugin(plugin);
                        });
                    }

                    const restartButton = this.createConfiguredItemAction(itemEl.controlEl, "restart");
                    if (restartButton) {
                        restartButton.setIcon("refresh-ccw");
                        restartButton.setTooltip(this.manager.translator.t("菜单_重启插件_描述"));
                        restartButton.setDisabled(isSelf || !isEnabled);
                        restartButton.onClick(async () => {
                            await this.restartPlugin(plugin);
                        });
                    }
                }

                const hideButton = this.createConfiguredItemAction(itemEl.controlEl, "hide");
                if (hideButton) {
                    hideButton.setIcon("eye-off");
                    hideButton.setTooltip(this.manager.translator.t("菜单_隐藏插件_标题"));
                    hideButton.setDisabled(isSelf);
                    hideButton.onClick(() => {
                        if (isSelf) return;
                        this.togglePluginHidden(plugin.id);
                    });
                }

                const noteButton = this.createConfiguredItemAction(itemEl.controlEl, "note");
                if (noteButton) {
                    noteButton.setIcon("notebook-pen");
                    noteButton.setTooltip(this.manager.translator.t("菜单_笔记_标题"));
                    noteButton.onClick(() => { new NoteModal(this.app, this.manager, ManagerPlugin, this).open(); });
                }

                const hotkeysButton = this.createConfiguredItemAction(itemEl.controlEl, "hotkeys");
                if (hotkeysButton) {
                    hotkeysButton.setIcon("circle-plus");
                    hotkeysButton.setTooltip(this.manager.translator.t("菜单_快捷键_标题"));
                    hotkeysButton.onClick(async () => {
                        await this.openPluginHotkeys(plugin.id);
                    });
                }

                const copyIdButton = this.createConfiguredItemAction(itemEl.controlEl, "copyId");
                if (copyIdButton) {
                    copyIdButton.setIcon("copy");
                    copyIdButton.setTooltip(this.manager.translator.t("菜单_复制ID_标题"));
                    copyIdButton.onClick(() => {
                        navigator.clipboard.writeText(plugin.id);
                        new Notice(this.manager.translator.t("通知_ID已复制"));
                    });
                }

                const openRepoButton = this.createConfiguredItemAction(itemEl.controlEl, "openRepo");
                if (openRepoButton) {
                    openRepoButton.setIcon("github");
                    openRepoButton.setTooltip(this.manager.translator.t("管理器_仓库检测中_提示"));
                    openRepoButton.setDisabled(true);
                    const repo = await this.manager.repoResolver.resolveRepo(plugin.id);
                    if (!this.isRenderCurrent(renderGeneration, page)) return;
                    const repoState = this.resolvePluginRepoAction(plugin.id, repo);
                    openRepoButton.setTooltip(repoState.tooltip);
                    openRepoButton.setDisabled(repoState.disabled);
                    openRepoButton.onClick(async () => {
                        await this.openPluginRepo(plugin.id, repoState.repo);
                    });
                }

                // [按钮] 打开设置
                openPluginSetting = this.createConfiguredItemAction(itemEl.controlEl, "openSettings");
                if (openPluginSetting) {
                    openPluginSetting.setIcon("settings");
                    openPluginSetting.setTooltip(this.manager.translator.t("管理器_打开设置_描述"));
                    openPluginSetting.onClick(() => {
                        openPluginSetting?.setDisabled(true);
                        this.appSetting.open();
                        this.appSetting.openTabById(plugin.id);
                        openPluginSetting?.setDisabled(false);
                    });
                    openPluginSettingEl = ((openPluginSetting as any).extraSettingsEl || (openPluginSetting as any).buttonEl) as HTMLElement | undefined;
                    if (!isEnabled) {
                        openPluginSetting.setDisabled(true);
                        if (openPluginSettingEl) openPluginSettingEl.style.display = "none";
                    }
                }

                // [按钮] 打开目录
                const openPluginDirButton = this.createConfiguredItemAction(itemEl.controlEl, "openDir");
                if (openPluginDirButton) {
                    openPluginDirButton.setIcon("folder-open");
                    openPluginDirButton.setTooltip(this.manager.translator.t("管理器_打开目录_描述"));
                    openPluginDirButton.onClick(() => {
                        openPluginDirButton.setDisabled(true);
                        managerOpen(pluginDir, this.manager);
                        openPluginDirButton.setDisabled(false);
                    });
                }

                // [按钮] 删除插件
                const deletePluginButton = this.createConfiguredItemAction(itemEl.controlEl, "delete");
                if (deletePluginButton) {
                    deletePluginButton.setIcon("trash");
                    deletePluginButton.setTooltip(this.manager.translator.t("管理器_删除插件_描述"));
                    if (isSelf) deletePluginButton.setDisabled(true);
                    deletePluginButton.onClick(async () => {
                        await this.uninstallPluginWithConfirm(plugin, isSelf);
                    });
                }

                // [按钮] 切换状态
                const toggleSwitch = new ToggleComponent(itemEl.controlEl);
                toggleSwitch.setTooltip(this.manager.translator.t("管理器_切换状态_描述"));
                toggleSwitch.setValue(isEnabled);

                // 检查 BPM 忽略标签
                const managerPluginForToggle = ManagerPlugin;
                const isBpmIgnored = managerPluginForToggle.tags?.includes(BPM_IGNORE_TAG);

                if (isSelf) {
                    toggleSwitch.setValue(true);
                    toggleSwitch.setDisabled(true);
                    toggleSwitch.setTooltip(this.manager.translator.t("管理器_自身不可禁用_提示"));
                } else {
                    let isRestoring = false;
                    if (isBpmIgnored) toggleSwitch.setTooltip(this.manager.translator.t("提示_BPM忽略_描述"));
                    toggleSwitch.onChange(async () => {
                        if (isRestoring) return;
                        const targetEnabled = toggleSwitch.getValue();
                        if (isBpmIgnored) {
                            new Notice(this.manager.translator.t("提示_BPM忽略_操作拦截"));
                            isRestoring = true;
                            toggleSwitch.setValue(!targetEnabled);
                            isRestoring = false;
                            return;
                        }
                        const removeByFilter = (this.filter === "enabled" && !targetEnabled) || (this.filter === "disabled" && targetEnabled);
                        const updateCardUI = () => {
                            itemEl.settingEl.toggleClass("is-enabled", targetEnabled);
                            itemEl.settingEl.toggleClass("is-disabled", !targetEnabled);
                            statusChip.setText(targetEnabled ? this.manager.translator.t("管理器_状态_启用中") : this.manager.translator.t("管理器_状态_已禁用"));
                            statusChip.removeClass(targetEnabled ? "is-disabled" : "is-enabled");
                            statusChip.addClass(targetEnabled ? "is-enabled" : "is-disabled");
                            cardIcon.empty();
                            setIcon(cardIcon, targetEnabled ? "plug-zap" : "plug");
                            if (this.settings.FADE_OUT_DISABLED_PLUGINS) {
                                itemEl.settingEl.toggleClass("inactive", !targetEnabled);
                            }
                            // 同步“打开设置”按钮（启用后出现，禁用后隐藏）
                            if (openPluginSetting) {
                                openPluginSetting.setDisabled(!targetEnabled);
                                if (openPluginSettingEl) openPluginSettingEl.style.display = targetEnabled ? "" : "none";
                            }
                            // 按需从当前视图移除，避免全量重绘
                            if (removeByFilter) {
                                itemEl.settingEl.detach();
                            }
                            // 更新底部统计
                            this.updateStats();
                        };
                        if (this.settings.DELAY) {
                            if (targetEnabled) {
                                managerPluginForToggle.enabled = true;
                                await this.manager.savePluginAndExport(plugin.id);
                                await this.appPlugins.enablePlugin(plugin.id);
                            } else {
                                managerPluginForToggle.enabled = false;
                                await this.manager.savePluginAndExport(plugin.id);
                                await this.appPlugins.disablePlugin(plugin.id);
                            }
                        } else {
                            if (targetEnabled) {
                                managerPluginForToggle.enabled = true;
                                await this.appPlugins.enablePluginAndSave(plugin.id);
                            } else {
                                managerPluginForToggle.enabled = false;
                                await this.appPlugins.disablePluginAndSave(plugin.id);
                            }
                            await this.manager.savePluginAndExport(plugin.id);
                        }
                        Commands(this.app, this.manager);
                        updateCardUI();
                    });
                }
            }
            // 编辑模式下的操作按钮和延迟下拉选单 - 移到 if (!this.editorMode) 块外面
            if (this.editorMode) {
                // [按钮] 还原内容
                const reloadButton = new ExtraButtonComponent(itemEl.controlEl);
                reloadButton.setIcon("refresh-ccw");
                reloadButton.setTooltip(this.manager.translator.t("管理器_还原内容_描述"));
                reloadButton.onClick(async () => {
                    if (!ManagerPlugin) return; // Fix TS2532
                    ManagerPlugin.name = plugin.name;
                    ManagerPlugin.desc = plugin.description;
                    ManagerPlugin.group = "";
                    ManagerPlugin.delay = "";
                    ManagerPlugin.tags = [];
                    await this.manager.savePluginAndExport(plugin.id);
                    this.reloadShowData();
                });
                // [编辑] 延迟
                if (this.settings.DELAY) {
                    const delays = this.settings.DELAYS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = item.name; return acc; }, { "": this.manager.translator.t("通用_无延迟_文本"), });
                    const delaysEl = new DropdownComponent(itemEl.controlEl);
                    delaysEl.addOptions(delays);
                    delaysEl.setValue(ManagerPlugin?.delay || "");

                    const pSettings = this.settings.Plugins.find(p => p.id === plugin.id);
                    const isIgnored = pSettings?.tags?.includes(BPM_IGNORE_TAG);

                    let isRestoring = false;
                    delaysEl.onChange(async (val) => {
                        if (!ManagerPlugin) return; // Fix lint
                        if (isRestoring) return;

                        if (isIgnored) {
                            new Notice(this.manager.translator.t("提示_BPM忽略_操作拦截"));
                            isRestoring = true;
                            delaysEl.setValue(ManagerPlugin.delay || "");
                            isRestoring = false;
                            return;
                        }
                        ManagerPlugin.delay = val;
                        await this.manager.savePluginAndExport(plugin.id);
                        this.reloadShowData();
                    });

                }
            }
            if (this.settings.DEBUG) {
                const cards = Array.from(this.contentEl.querySelectorAll(".manager-item"));
                console.log("[BPM] render showData after loop, cards:", cards.length, "ids:", cards.map(el => el.getAttribute("data-plugin-id")).filter(Boolean).join(","));
            }
            // 计算页尾
            this.updateStats();
        }
    }

    private getCounts() {
        let totalCount = 0;
        let enabledCount = 0;
        let disabledCount = 0;
        if (this.settings.DELAY) {
            const plugins = this.settings.Plugins;
            totalCount = plugins.length;
            plugins.forEach((plugin) => { plugin.enabled ? enabledCount++ : disabledCount++; });
        } else {
            totalCount = Object.keys(this.manager.appPlugins.manifests).length - 1;
            enabledCount = this.manager.appPlugins.enabledPlugins.size - 1;
            disabledCount = totalCount - enabledCount;
        }
        return { totalCount, enabledCount, disabledCount };
    }

    private getHiddenCount(): number {
        const hiddenIds = new Set(this.settings.HIDES || []);
        hiddenIds.delete(this.manager.manifest.id);
        if (hiddenIds.size === 0) return 0;
        return this.getUniquePluginManifests().reduce((count, plugin) => count + (hiddenIds.has(plugin.id) ? 1 : 0), 0);
    }

    private updateStats() {
        if (!this.footEl) return;
        const { totalCount, enabledCount, disabledCount } = this.getCounts();
        const totalLabel = this.manager.translator.t("通用_总计_文本");
        const enabledLabel = this.manager.translator.t("通用_启用_文本");
        const disabledLabel = this.manager.translator.t("通用_禁用_文本");
        const hiddenLabel = this.manager.translator.t("管理器_状态_已隐藏");
        const hiddenCount = this.getHiddenCount();
        const updateStatuses = this.manager.updateStatus || {};
        const checkedCount = Object.keys(updateStatuses).length;
        const updateCount = this.getPluginUpdateCount(updateStatuses);

        this.footEl.empty();
        const statItems = [
            { cls: "bpm-stat-chip--total", icon: "layout-grid", label: totalLabel, value: totalCount },
            { cls: "bpm-stat-chip--enabled", icon: "circle-check", label: enabledLabel, value: enabledCount },
            { cls: "bpm-stat-chip--disabled", icon: "circle-minus", label: disabledLabel, value: disabledCount },
            { cls: "bpm-stat-chip--hidden", icon: "eye-off", label: hiddenLabel, value: hiddenCount },
        ];
        if (checkedCount > 0) {
            statItems.push({
                cls: "bpm-stat-chip--updates",
                icon: updateCount > 0 ? "download" : "check-check",
                label: this.manager.translator.t("通用_可更新_文本"),
                value: updateCount,
            });
        }
        statItems.forEach((item) => {
            const chip = this.footEl.createSpan({ cls: `bpm-stat-chip ${item.cls}` });
            chip.setAttribute("aria-label", `${item.label} ${item.value}`);
            const icon = chip.createSpan({ cls: "bpm-stat-chip__icon" });
            setIcon(icon, item.icon);
            chip.createSpan({ cls: "bpm-stat-chip__label", text: item.label });
            chip.createSpan({ cls: "bpm-stat-chip__value", text: `${item.value}` });
        });
    }

    private syncPageChrome() {
        const isPlugins = this.activePage === "plugins";
        const isInstall = this.activePage === "install";
        const isSources = this.activePage === "sources";
        const isInstallWorkspace = isInstall || isSources;
        const isTransfer = this.activePage === "transfer";
        const isVaults = this.activePage === "vaults";
        const isRibbon = this.activePage === "ribbon";
        const isHidden = this.activePage === "hidden";
        const isTroubleshoot = this.activePage === "troubleshoot";
        this.installMode = isInstallWorkspace;
        this.pluginTabEl?.classList.toggle("is-active", isPlugins);
        this.installTabEl?.classList.toggle("is-active", isInstallWorkspace);
        this.sourcesTabEl?.classList.toggle("is-active", isSources);
        this.transferTabEl?.classList.toggle("is-active", isTransfer);
        this.vaultsTabEl?.classList.toggle("is-active", isVaults);
        this.ribbonTabEl?.classList.toggle("is-active", isRibbon);
        this.hiddenTabEl?.classList.toggle("is-active", isHidden);
        this.troubleshootTabEl?.classList.toggle("is-active", isTroubleshoot);
        this.pluginTabEl?.setAttribute("aria-selected", `${isPlugins}`);
        this.installTabEl?.setAttribute("aria-selected", `${isInstallWorkspace}`);
        this.sourcesTabEl?.setAttribute("aria-selected", `${isSources}`);
        this.transferTabEl?.setAttribute("aria-selected", `${isTransfer}`);
        this.vaultsTabEl?.setAttribute("aria-selected", `${isVaults}`);
        this.ribbonTabEl?.setAttribute("aria-selected", `${isRibbon}`);
        this.hiddenTabEl?.setAttribute("aria-selected", `${isHidden}`);
        this.troubleshootTabEl?.setAttribute("aria-selected", `${isTroubleshoot}`);
        this.desktopActionWrapper?.classList.toggle("is-plugin-page", isPlugins);
        this.desktopActionWrapper?.classList.toggle("is-install-page", isInstall);
        this.desktopActionWrapper?.classList.toggle("is-sources-page", isSources);
        this.desktopActionWrapper?.classList.toggle("is-transfer-page", isTransfer);
        this.desktopActionWrapper?.classList.toggle("is-vaults-page", isVaults);
        this.desktopActionWrapper?.classList.toggle("is-ribbon-page", isRibbon);
        this.desktopActionWrapper?.classList.toggle("is-hidden-page", isHidden);
        this.desktopActionWrapper?.classList.toggle("is-troubleshoot-page", isTroubleshoot);
        if (this.desktopFilterWrapper) {
            this.desktopFilterWrapper.classList.toggle("manager-display-none", !isPlugins);
            this.desktopFilterWrapper.style.display = isPlugins ? "" : "none";
        }
        if (this.searchBarEl) {
            isPlugins ? this.searchBarEl.removeClass("manager-display-none") : this.searchBarEl.addClass("manager-display-none");
        }
    }

    private setDesktopPage(page: ManagerPage) {
        if (this.activePage === page) {
            this.syncPageChrome();
            return;
        }
        this.activePage = page;
        this.syncPageChrome();
        this.renderContent();
    }

    public count(): string {
        const { totalCount, enabledCount, disabledCount } = this.getCounts();
        const totalLabel = this.manager.translator.t("通用_总计_文本");
        const enabledLabel = this.manager.translator.t("通用_启用_文本");
        const disabledLabel = this.manager.translator.t("通用_禁用_文本");
        const hiddenLabel = this.manager.translator.t("管理器_状态_已隐藏");
        const hiddenCount = this.getHiddenCount();

        return `${totalLabel}: ${totalCount} · ${enabledLabel}: ${enabledCount} · ${disabledLabel}: ${disabledCount} · ${hiddenLabel}: ${hiddenCount}`;
    }

    private getUniquePluginManifests(): PluginManifest[] {
        const uniqMap = new Map<string, PluginManifest>();
        Object.values(this.appPlugins.manifests).forEach((mf: PluginManifest) => {
            uniqMap.set(mf.id, mf);
        });
        return Array.from(uniqMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    private getPluginLayout(manifests: PluginManifest[] = this.getUniquePluginManifests()): PluginLayoutItem[] {
        if (!Array.isArray(this.manager.settings.PLUGIN_LAYOUT)) this.manager.settings.PLUGIN_LAYOUT = [];

        const manifestIds = new Set(manifests.map((plugin) => plugin.id));
        const seenPluginIds = new Set<string>();
        const normalized: PluginLayoutItem[] = [];

        for (const item of this.manager.settings.PLUGIN_LAYOUT) {
            if (!item || !item.id) continue;
            if (item.type === "separator") {
                normalized.push({
                    id: item.id,
                    type: "separator",
                    title: item.title || this.manager.translator.t("管理器_布局_分割线"),
                });
                continue;
            }
            if (item.type === "plugin" && manifestIds.has(item.id) && !seenPluginIds.has(item.id)) {
                normalized.push({ id: item.id, type: "plugin" });
                seenPluginIds.add(item.id);
            }
        }

        for (const plugin of manifests) {
            if (seenPluginIds.has(plugin.id)) continue;
            normalized.push({ id: plugin.id, type: "plugin" });
            seenPluginIds.add(plugin.id);
        }

        const changed = JSON.stringify(this.manager.settings.PLUGIN_LAYOUT) !== JSON.stringify(normalized);
        this.manager.settings.PLUGIN_LAYOUT = normalized;
        if (changed) void this.manager.saveSettings();
        return this.manager.settings.PLUGIN_LAYOUT;
    }

    private getOrderedPluginManifests(manifests: PluginManifest[] = this.getUniquePluginManifests()): PluginManifest[] {
        const manifestById = new Map(manifests.map((plugin) => [plugin.id, plugin]));
        return this.getPluginLayout(manifests)
            .filter((item) => item.type === "plugin")
            .map((item) => manifestById.get(item.id))
            .filter((plugin): plugin is PluginManifest => Boolean(plugin));
    }

    private shouldRenderPluginLayoutSeparators(): boolean {
        const filter = this.filter || "all";
        const groupFilter = this.settings.PERSISTENCE ? this.settings.FILTER_GROUP : this.group;
        const tagFilter = this.settings.PERSISTENCE ? this.settings.FILTER_TAG : this.tag;
        const delayFilter = this.settings.PERSISTENCE ? this.settings.FILTER_DELAY : this.delay;
        return (filter === "all" || filter === "") && !groupFilter && !tagFilter && !delayFilter && !this.searchText;
    }

    private renderPluginLayoutSeparator(title: string) {
        const separator = this.contentEl.createDiv("manager-plugin-separator");
        const lineStart = separator.createSpan({ cls: "manager-plugin-separator__line" });
        lineStart.setAttribute("aria-hidden", "true");
        const label = separator.createSpan({ cls: "manager-plugin-separator__label", text: title || this.manager.translator.t("管理器_布局_分割线") });
        label.setAttribute("role", "separator");
        const lineEnd = separator.createSpan({ cls: "manager-plugin-separator__line" });
        lineEnd.setAttribute("aria-hidden", "true");
    }

    private async movePluginLayoutItem(index: number, delta: number) {
        const layout = this.getPluginLayout();
        const target = index + delta;
        if (target < 0 || target >= layout.length) return;
        const [item] = layout.splice(index, 1);
        layout.splice(target, 0, item);
        this.manager.settings.PLUGIN_LAYOUT = layout;
        await this.manager.saveSettings();
        this.showHiddenPanel();
    }

    private async movePluginLayoutItemTo(oldIndex: number, newIndex: number) {
        const layout = this.getPluginLayout();
        if (oldIndex < 0 || oldIndex >= layout.length) return;
        const target = Math.max(0, Math.min(newIndex, layout.length - 1));
        if (target === oldIndex) return;
        const [item] = layout.splice(oldIndex, 1);
        layout.splice(target, 0, item);
        this.manager.settings.PLUGIN_LAYOUT = layout;
        await this.manager.saveSettings();
        this.showHiddenPanel();
    }

    private startHiddenLayoutDrag(itemEl: HTMLElement, index: number, event: PointerEvent) {
        if (event.button !== 0 && event.pointerType === "mouse") return;
        const target = event.currentTarget as HTMLElement;
        target.setPointerCapture?.(event.pointerId);

        const rect = itemEl.getBoundingClientRect();
        this.hiddenDraggedItemEl = itemEl;
        this.hiddenDragStartIndex = index;
        this.hiddenDragOffsetX = event.clientX - rect.left;
        this.hiddenDragOffsetY = event.clientY - rect.top;
        this.hiddenActivePointerId = event.pointerId;

        this.hiddenGhostEl = itemEl.cloneNode(true) as HTMLElement;
        this.hiddenGhostEl.addClass("drag-ghost");
        this.hiddenGhostEl.addClass("manager-hidden-drag-ghost");
        document.body.appendChild(this.hiddenGhostEl);
        this.hiddenGhostEl.style.width = `${rect.width}px`;
        this.hiddenGhostEl.style.height = `${rect.height}px`;
        this.updateHiddenLayoutGhost(event);

        this.hiddenPlaceholderEl = document.createElement("div");
        this.hiddenPlaceholderEl.className = "drag-gap-placeholder manager-hidden-drag-placeholder";
        this.hiddenPlaceholderEl.style.height = `${rect.height}px`;
        itemEl.parentNode?.insertBefore(this.hiddenPlaceholderEl, itemEl);
        itemEl.addClass("dragging");

        document.addEventListener("pointermove", this.handleHiddenLayoutDragMove, { passive: false });
        document.addEventListener("pointerup", this.handleHiddenLayoutDragEnd);
        document.addEventListener("pointercancel", this.handleHiddenLayoutDragEnd);
    }

    private handleHiddenLayoutDragMove(event: PointerEvent) {
        if (!this.hiddenGhostEl || !this.hiddenPlaceholderEl || !this.hiddenDraggedItemEl) return;
        if (event.pointerId !== this.hiddenActivePointerId) return;
        event.preventDefault();
        this.updateHiddenLayoutGhost(event);

        const listContainer = this.hiddenPlaceholderEl.parentElement;
        if (!listContainer) return;
        const items = Array.from(listContainer.querySelectorAll<HTMLElement>(".manager-hidden-card[data-layout-index]"))
            .filter((item) => item !== this.hiddenDraggedItemEl && !item.classList.contains("dragging"));

        let dropTarget: HTMLElement | null = null;
        for (const item of items) {
            const rect = item.getBoundingClientRect();
            if (event.clientY < rect.top + rect.height / 2) {
                dropTarget = item;
                break;
            }
        }

        if (dropTarget) {
            listContainer.insertBefore(this.hiddenPlaceholderEl, dropTarget);
        } else {
            listContainer.appendChild(this.hiddenPlaceholderEl);
        }
    }

    private updateHiddenLayoutGhost(event: PointerEvent) {
        if (!this.hiddenGhostEl) return;
        this.hiddenGhostEl.style.left = `${event.clientX - this.hiddenDragOffsetX}px`;
        this.hiddenGhostEl.style.top = `${event.clientY - this.hiddenDragOffsetY}px`;
    }

    private async handleHiddenLayoutDragEnd(event: PointerEvent) {
        if (event.pointerId !== this.hiddenActivePointerId) return;
        if (!this.hiddenDraggedItemEl || !this.hiddenPlaceholderEl) return;

        const listContainer = this.hiddenPlaceholderEl.parentElement;
        let newIndex = 0;
        if (listContainer) {
            for (const child of Array.from(listContainer.children)) {
                if (child === this.hiddenPlaceholderEl) break;
                if (child.matches(".manager-hidden-card[data-layout-index]:not(.dragging)")) newIndex++;
            }
        }

        this.hiddenPlaceholderEl.remove();
        this.hiddenPlaceholderEl = null;
        this.hiddenGhostEl?.remove();
        this.hiddenGhostEl = null;
        this.hiddenDraggedItemEl.removeClass("dragging");

        const oldIndex = this.hiddenDragStartIndex;
        this.hiddenDraggedItemEl = null;
        this.hiddenDragStartIndex = -1;
        this.hiddenActivePointerId = null;
        document.removeEventListener("pointermove", this.handleHiddenLayoutDragMove);
        document.removeEventListener("pointerup", this.handleHiddenLayoutDragEnd);
        document.removeEventListener("pointercancel", this.handleHiddenLayoutDragEnd);

        await this.movePluginLayoutItemTo(oldIndex, newIndex);
    }

    private async addPluginLayoutSeparator() {
        const layout = this.getPluginLayout();
        layout.push({
            id: `separator-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: "separator",
            title: this.manager.translator.t("管理器_布局_分割线"),
        });
        this.manager.settings.PLUGIN_LAYOUT = layout;
        await this.manager.saveSettings();
        this.showHiddenPanel();
    }

    private async resetPluginLayout() {
        this.manager.settings.PLUGIN_LAYOUT = this.getUniquePluginManifests().map((plugin) => ({
            id: plugin.id,
            type: "plugin",
        }));
        await this.manager.saveSettings();
        this.showHiddenPanel();
    }

    private async updatePluginLayoutSeparator(itemId: string, title: string) {
        const item = this.getPluginLayout().find((layoutItem) => layoutItem.id === itemId && layoutItem.type === "separator");
        if (!item) return;
        item.title = title.trim() || this.manager.translator.t("管理器_布局_分割线");
        await this.manager.saveSettings();
    }

    private async removePluginLayoutSeparator(itemId: string) {
        this.manager.settings.PLUGIN_LAYOUT = this.getPluginLayout().filter((item) => item.id !== itemId);
        await this.manager.saveSettings();
        this.showHiddenPanel();
    }

    private getBetaSources(): BetaSource[] {
        if (!Array.isArray(this.manager.settings.BETA_SOURCES)) this.manager.settings.BETA_SOURCES = [];
        return this.manager.settings.BETA_SOURCES;
    }

    private compareVersions(a: string = "0.0.0", b: string = "0.0.0"): number {
        const pa = a.replace(/^v/i, "").split(".").map(Number);
        const pb = b.replace(/^v/i, "").split(".").map(Number);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
            const ai = Number.isFinite(pa[i]) ? pa[i] : 0;
            const bi = Number.isFinite(pb[i]) ? pb[i] : 0;
            if (ai > bi) return 1;
            if (ai < bi) return -1;
        }
        return 0;
    }

    private getPluginIdByRepo(repo: string): string | null {
        const normalized = sanitizeRepo(repo);
        const entry = Object.entries(this.manager.settings.REPO_MAP || {})
            .find(([, value]) => sanitizeRepo(value) === normalized);
        return entry?.[0] ?? null;
    }

    private getSourceLocalVersion(source: BetaSource): string {
        if (source.type === "plugin") {
            return (this.appPlugins.manifests[source.id] as PluginManifest | undefined)?.version || source.localVersion || "";
        }
        return source.localVersion || "";
    }

    private sourceHasUpdate(source: BetaSource): boolean {
        const localVersion = this.getSourceLocalVersion(source);
        if (!source.latestVersion || !localVersion) return false;
        return this.compareVersions(source.latestVersion, localVersion) > 0;
    }

    private getSourceStats(sources = this.getBetaSources()) {
        return {
            total: sources.length,
            plugins: sources.filter((source) => source.type === "plugin").length,
            themes: sources.filter((source) => source.type === "theme").length,
            auto: sources.filter((source) => source.autoUpdate).length,
            updates: sources.filter((source) => this.sourceHasUpdate(source)).length,
        };
    }

    private getInstallHistory(): InstallHistoryItem[] {
        if (!Array.isArray(this.manager.settings.INSTALL_HISTORY)) this.manager.settings.INSTALL_HISTORY = [];
        return this.manager.settings.INSTALL_HISTORY;
    }

    private getInstallHistoryOptions(limit = 24): InstallHistoryItem[] {
        const options: InstallHistoryItem[] = [];
        const seen = new Set<string>();
        const add = (item: InstallHistoryItem) => {
            const repo = sanitizeRepo(item.repo || "");
            if (!repo || !this.isValidInstallRepo(repo)) return;
            const type = item.type === "theme" ? "theme" : "plugin";
            const key = `${type}:${repo.toLowerCase()}`;
            if (seen.has(key)) return;
            seen.add(key);
            options.push({
                ...item,
                repo,
                type,
                version: item.version?.trim() || undefined,
            });
        };

        [...this.getInstallHistory()]
            .sort((a, b) => (b.usedAt || 0) - (a.usedAt || 0))
            .forEach(add);

        [...this.getBetaSources()]
            .sort((a, b) => (b.lastChecked || 0) - (a.lastChecked || 0))
            .forEach((source) => add({
                repo: source.repo,
                type: source.type,
                version: source.mode === "frozen" ? source.frozenVersion : undefined,
                trackSource: true,
                usedAt: source.lastChecked,
            }));

        return options.slice(0, limit);
    }

    private rememberInstallHistory(repo: string, type: "plugin" | "theme", version?: string, trackSource?: boolean) {
        const normalizedRepo = sanitizeRepo(repo);
        if (!this.isValidInstallRepo(normalizedRepo)) return;
        const next: InstallHistoryItem = {
            repo: normalizedRepo,
            type,
            version: version?.trim() || undefined,
            trackSource,
            usedAt: Date.now(),
        };
        this.manager.settings.INSTALL_HISTORY = [
            next,
            ...this.getInstallHistory().filter((item) =>
                !(sanitizeRepo(item.repo || "").toLowerCase() === normalizedRepo.toLowerCase() && item.type === type)
            ),
        ].slice(0, 12);
    }

    private pickSourceVersion(source: BetaSource, versions: ReleaseVersion[]): string {
        if (source.mode === "frozen") return source.frozenVersion || source.latestVersion || versions[0]?.version || "";
        return versions.find((version) => !version.prerelease)?.version || versions[0]?.version || "";
    }

    private upsertBetaSource(source: BetaSource) {
        const sources = this.getBetaSources();
        const repo = sanitizeRepo(source.repo);
        const existing = sources.find((item) => item.type === source.type && sanitizeRepo(item.repo) === repo);
        const next: BetaSource = {
            ...existing,
            ...source,
            repo,
            enabled: source.enabled ?? true,
            autoUpdate: source.autoUpdate ?? false,
            mode: source.mode || "latest",
        };
        if (existing) {
            Object.assign(existing, next);
        } else {
            sources.push(next);
        }
    }

    private async checkBetaSource(source: BetaSource): Promise<BetaSource> {
        try {
            const versions = await fetchReleaseVersions(this.manager, source.repo);
            const latestVersion = this.pickSourceVersion(source, versions);
            source.latestVersion = latestVersion || "";
            source.localVersion = this.getSourceLocalVersion(source);
            source.lastChecked = Date.now();
            source.error = "";
            if (source.mode === "frozen" && !source.frozenVersion) source.frozenVersion = latestVersion;
        } catch (error) {
            source.error = (error as Error)?.message || String(error);
            source.lastChecked = Date.now();
        }
        await this.manager.saveSettings();
        return source;
    }

    private async updateBetaSource(source: BetaSource, reinstall = false): Promise<boolean> {
        await this.checkBetaSource(source);
        const targetVersion = source.mode === "frozen"
            ? source.frozenVersion || source.latestVersion || ""
            : source.latestVersion || "";
        if (!targetVersion && !reinstall) {
            new Notice(this.manager.translator.t("来源_未获取可安装版本_提示"));
            return false;
        }
        const ok = source.type === "plugin"
            ? await installPluginFromGithub(this.manager, source.repo, targetVersion, true)
            : await installThemeFromGithub(this.manager, source.repo, targetVersion);
        if (!ok) return false;

        if (source.type === "plugin") {
            const pluginId = this.getPluginIdByRepo(source.repo) || source.id;
            if (pluginId) source.id = pluginId;
            source.localVersion = pluginId
                ? ((this.appPlugins.manifests[pluginId] as PluginManifest | undefined)?.version || targetVersion)
                : targetVersion;
        } else {
            source.localVersion = targetVersion;
        }
        source.error = "";
        await this.manager.saveSettings();
        return true;
    }

    private showHiddenPanel() {
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        this.contentEl.empty();
        this.displayPlugins = [];
        let renderedCount = 0;
        const page = this.contentEl.createDiv("manager-hidden-page");
        const manifests = this.getUniquePluginManifests();
        const manifestById = new Map(manifests.map((plugin) => [plugin.id, plugin]));
        const layout = this.getPluginLayout(manifests);

        const createOrderButton = (
            container: HTMLElement,
            icon: string,
            label: string,
            disabled: boolean,
            onClick: () => Promise<void>
        ) => {
            const btn = new ButtonComponent(container);
            btn.setIcon(icon);
            btn.setTooltip(label);
            btn.setDisabled(disabled);
            btn.onClick(async () => {
                await onClick();
            });
            return btn;
        };
        const bindDragHandle = (card: HTMLElement, index: number, label: string) => {
            card.setAttr("data-layout-index", `${index}`);
            const handle = card.createDiv("manager-hidden-card__drag");
            handle.setAttr("role", "button");
            handle.setAttr("aria-label", t("管理器_布局_拖动排序_标签", { label }));
            handle.setAttr("tabindex", "0");
            setIcon(handle, "grip-vertical");
            handle.addEventListener("pointerdown", (event) => this.startHiddenLayoutDrag(card, index, event));
            handle.addEventListener("dragstart", (event) => event.preventDefault());
            return handle;
        };

        for (const [index, layoutItem] of layout.entries()) {
            if (layoutItem.type === "separator") {
                const card = page.createDiv("manager-hidden-card manager-hidden-separator-card");
                card.setAttr("data-layout-id", layoutItem.id);
                bindDragHandle(card, index, layoutItem.title || t("管理器_布局_分割线"));

                const main = card.createDiv("manager-hidden-card__main");
                const iconWrap = main.createDiv("manager-hidden-card__icon");
                setIcon(iconWrap, "separator-horizontal");

                const textWrap = main.createDiv("manager-hidden-card__text");
                const titleRow = textWrap.createDiv("manager-hidden-card__title-row");
                titleRow.createSpan({ cls: "manager-hidden-card__name", text: t("管理器_布局_分割线") });
                titleRow.createSpan({ text: t("管理器_布局_布局标记"), cls: "manager-hidden-item__state is-separator" });
                const titleInputWrap = textWrap.createDiv("manager-hidden-separator-card__input");
                const titleInput = new TextComponent(titleInputWrap);
                titleInput.setValue(layoutItem.title || t("管理器_布局_分割线"));
                titleInput.setPlaceholder(t("管理器_布局_分割线标题"));
                titleInput.inputEl.setAttribute("aria-label", t("管理器_布局_分割线标题"));
                titleInput.onChange(async (value) => {
                    await this.updatePluginLayoutSeparator(layoutItem.id, value);
                });

                const actions = card.createDiv("manager-hidden-card__actions");
                const order = actions.createDiv("manager-hidden-card__order");
                createOrderButton(order, "arrow-up", t("通用_上移_文本"), index === 0, async () => this.movePluginLayoutItem(index, -1));
                createOrderButton(order, "arrow-down", t("通用_下移_文本"), index === layout.length - 1, async () => this.movePluginLayoutItem(index, 1));
                createOrderButton(order, "trash-2", t("管理器_布局_删除分割线"), false, async () => this.removePluginLayoutSeparator(layoutItem.id));
                renderedCount++;
                continue;
            }

            const plugin = manifestById.get(layoutItem.id);
            if (!plugin) continue;
            const managerPlugin = this.manager.settings.Plugins.find((mp) => mp.id === plugin.id);
            if (!managerPlugin) continue;
            const isSelf = plugin.id === this.manager.manifest.id;
            const isEnabled = this.settings.DELAY ? managerPlugin.enabled : this.appPlugins.enabledPlugins.has(plugin.id);
            const isHidden = this.settings.HIDES.includes(plugin.id);

            const card = page.createDiv("manager-hidden-card");
            card.setAttr("data-plugin-id", plugin.id);
            bindDragHandle(card, index, managerPlugin.name);
            card.toggleClass("is-hidden", isHidden);
            if (this.settings.FADE_OUT_DISABLED_PLUGINS && !isEnabled) card.addClass("inactive");

            const main = card.createDiv("manager-hidden-card__main");
            const iconWrap = main.createDiv("manager-hidden-card__icon");
            setIcon(iconWrap, isHidden ? "eye-off" : "eye");

            const textWrap = main.createDiv("manager-hidden-card__text");
            const titleRow = textWrap.createDiv("manager-hidden-card__title-row");
            titleRow.createSpan({
                text: managerPlugin.name,
                title: plugin.name,
                cls: "manager-hidden-card__name",
            });
            titleRow.createSpan({
                text: isHidden ? t("管理器_状态_已隐藏") : t("管理器_状态_显示中"),
                cls: `manager-hidden-item__state ${isHidden ? "is-hidden" : "is-visible"}`,
            });
            textWrap.createDiv({
                text: plugin.id,
                cls: "manager-hidden-card__id",
            });

            const actions = card.createDiv("manager-hidden-card__actions");
            const order = actions.createDiv("manager-hidden-card__order");
            createOrderButton(order, "arrow-up", t("通用_上移_文本"), index === 0, async () => this.movePluginLayoutItem(index, -1));
            createOrderButton(order, "arrow-down", t("通用_下移_文本"), index === layout.length - 1, async () => this.movePluginLayoutItem(index, 1));

            const control = actions.createDiv("manager-hidden-card__control");
            control.createSpan({ cls: "manager-hidden-card__control-label", text: t("管理器_布局_隐藏于管理页") });
            const hiddenToggle = new ToggleComponent(control);
            hiddenToggle.setValue(isHidden);
            hiddenToggle.setDisabled(isSelf);
            hiddenToggle.toggleEl.setAttribute("aria-label", t("管理器_布局_隐藏于管理页_标签", { name: managerPlugin.name }));
            hiddenToggle.onChange((value) => {
                if (isSelf) return;
                if (value) {
                    if (!this.settings.HIDES.includes(plugin.id)) this.settings.HIDES.push(plugin.id);
                } else {
                    this.settings.HIDES = this.settings.HIDES.filter(id => id !== plugin.id);
                }
                this.manager.saveSettings();
                this.reloadShowData();
            });

            this.displayPlugins.push(plugin);
            renderedCount++;
        }

        if (renderedCount === 0) {
            const empty = page.createDiv("bpm-empty-state manager-hidden-page__empty");
            const icon = empty.createDiv();
            setIcon(icon, "eye-off");
            empty.createDiv({ cls: "bpm-empty-state__text", text: t("管理器_暂无匹配插件") });
        }
    }

    private showSourcesPanel(containerEl: HTMLElement = this.contentEl) {
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        if (containerEl === this.contentEl) containerEl.empty();

        const page = containerEl.createDiv("manager-source-page");
        const sources = this.getBetaSources();

        if (sources.length === 0) {
            const empty = page.createDiv("bpm-empty-state manager-source-page__empty");
            const icon = empty.createDiv();
            setIcon(icon, "radio-tower");
            empty.createDiv({ cls: "bpm-empty-state__text", text: t("来源_暂无订阅_提示") });
            const actionWrap = empty.createDiv("manager-source-page__empty-action");
            const addBtn = new ButtonComponent(actionWrap);
            addBtn.setIcon("download");
            addBtn.setButtonText(t("来源_安装仓库_按钮"));
            addBtn.onClick(() => {
                this.activePage = "install";
                this.syncPageChrome();
                this.renderContent();
            });
            return;
        }

        const toolbar = page.createDiv("manager-source-page__toolbar manager-source-page__toolbar--actions");
        const actions = toolbar.createDiv("manager-source-page__actions");
        const checkAllBtn = new ButtonComponent(actions);
        checkAllBtn.setIcon("refresh-cw");
        checkAllBtn.setButtonText(t("来源_全部检查_按钮"));
        checkAllBtn.onClick(async () => {
            checkAllBtn.setDisabled(true);
            checkAllBtn.setButtonText(t("来源_检查中_按钮"));
            for (const source of sources) {
                await this.checkBetaSource(source);
            }
            this.renderContent();
        });

        const updateTargets = sources.filter((source) => this.sourceHasUpdate(source));
        const updateAllBtn = new ButtonComponent(actions);
        updateAllBtn.setIcon("download");
        updateAllBtn.setButtonText(t("来源_更新可更新_按钮"));
        updateAllBtn.setDisabled(updateTargets.length === 0);
        updateAllBtn.onClick(async () => {
            updateAllBtn.setDisabled(true);
            updateAllBtn.setButtonText(t("来源_更新中_按钮"));
            for (const source of updateTargets) {
                await this.updateBetaSource(source);
            }
            this.renderContent();
        });

        const list = page.createDiv("manager-source-page__list");
        const sortedSources = [...sources].sort((a, b) => a.repo.localeCompare(b.repo));
        for (const source of sortedSources) {
            const notInstalledText = t("来源_未安装");
            const notCheckedText = t("来源_未检查");
            const localVersion = this.getSourceLocalVersion(source) || notInstalledText;
            const latestVersion = source.latestVersion || notCheckedText;
            const hasUpdate = this.sourceHasUpdate(source);

            const card = list.createDiv("manager-source-card");
            card.setAttribute("data-source-repo", source.repo);

            const cardMain = card.createDiv("manager-source-card__main");
            const cardHeader = cardMain.createDiv("manager-source-card__header");
            const titleBlock = cardHeader.createDiv("manager-source-card__title-block");
            const repoLine = titleBlock.createDiv("manager-source-card__repo-line");
            const repoIcon = repoLine.createSpan({ cls: "manager-source-card__repo-icon" });
            setIcon(repoIcon, "github");
            repoLine.createSpan({
                text: source.repo,
                cls: "manager-source-card__repo",
                title: `https://github.com/${source.repo}`,
            });

            const chips = cardHeader.createDiv("manager-source-card__chips");
            chips.appendChild(createSpan({
                text: source.type === "plugin" ? t("来源_类型_插件") : t("来源_类型_主题"),
                cls: "manager-source-item__chip",
            }));
            chips.appendChild(createSpan({
                text: source.mode === "frozen" ? t("来源_模式_固定版本") : t("来源_模式_跟随最新"),
                cls: `manager-source-item__chip ${source.mode === "frozen" ? "is-frozen" : "is-latest"}`,
            }));
            if (source.autoUpdate) {
                chips.appendChild(createSpan({ text: t("来源_自动更新"), cls: "manager-source-item__chip is-auto" }));
            }
            if (hasUpdate) {
                chips.appendChild(createSpan({ text: t("来源_有更新"), cls: "manager-source-item__chip is-update" }));
            }

            const checkedText = source.lastChecked ? new Date(source.lastChecked).toLocaleString() : notCheckedText;
            const metaGrid = cardMain.createDiv("manager-source-card__meta-grid");
            const createMeta = (label: string, value: string, iconName: string, extraCls?: string) => {
                const meta = metaGrid.createDiv(`manager-source-card__meta${extraCls ? ` ${extraCls}` : ""}`);
                const iconEl = meta.createSpan({ cls: "manager-source-card__meta-icon" });
                setIcon(iconEl, iconName);
                meta.createSpan({ cls: "manager-source-card__meta-label", text: label });
                meta.createSpan({ cls: "manager-source-card__meta-value", text: value, title: value });
            };
            createMeta(t("来源_当前"), localVersion, "hard-drive", localVersion === notInstalledText ? "is-muted" : undefined);
            createMeta(t("来源_最新"), latestVersion, "tag", hasUpdate ? "is-update" : undefined);
            createMeta(t("来源_检查"), checkedText, "clock");
            if (source.error) {
                const errorEl = cardMain.createDiv("manager-source-card__error");
                const errorIcon = errorEl.createSpan({ cls: "manager-source-card__error-icon" });
                setIcon(errorIcon, "triangle-alert");
                errorEl.createSpan({ text: source.error });
            }

            const controls = card.createDiv("manager-source-card__controls");
            const strategyGroup = controls.createDiv("manager-source-card__control-group manager-source-card__control-group--strategy");
            strategyGroup.createSpan({ cls: "manager-source-card__control-label", text: t("来源_版本策略") });
            const strategyWrap = strategyGroup.createDiv("manager-source-item__strategy");
            const modeDropdown = new DropdownComponent(strategyWrap);
            modeDropdown.addOptions({ latest: t("来源_模式_跟随最新"), frozen: t("来源_模式_固定版本") });
            modeDropdown.setValue(source.mode || "latest");
            modeDropdown.onChange(async (value: "latest" | "frozen") => {
                source.mode = value;
                if (value === "frozen" && !source.frozenVersion) source.frozenVersion = source.latestVersion || localVersion;
                await this.manager.saveSettings();
                this.renderContent();
            });
            modeDropdown.selectEl.addClass("manager-source-item__mode");
            modeDropdown.selectEl.setAttribute("aria-label", t("来源_版本策略"));

            if (source.mode === "frozen") {
                const frozenInput = new TextComponent(strategyWrap);
                frozenInput.setPlaceholder("tag");
                frozenInput.setValue(source.frozenVersion || "");
                frozenInput.inputEl.addClass("manager-source-item__version");
                frozenInput.inputEl.setAttribute("aria-label", t("来源_固定Tag_标签"));
                frozenInput.onChange(async (value) => {
                    source.frozenVersion = value.trim();
                    await this.manager.saveSettings();
                });
            }

            const autoGroup = controls.createDiv("manager-source-card__control-group manager-source-card__control-group--auto");
            autoGroup.createSpan({ cls: "manager-source-card__control-label", text: t("来源_更新") });
            const autoWrap = autoGroup.createDiv("manager-source-item__toggle");
            autoWrap.createSpan({ cls: "manager-source-item__toggle-label", text: t("来源_自动") });
            const autoToggle = new ToggleComponent(autoWrap);
            autoToggle.setValue(Boolean(source.autoUpdate));
            autoToggle.toggleEl.setAttribute("aria-label", t("来源_自动更新"));
            autoToggle.onChange(async (value) => {
                source.autoUpdate = value;
                await this.manager.saveSettings();
                this.renderContent();
            });

            const actionGroup = controls.createDiv("manager-source-card__actions");
            const prepareActionButton = (btn: ButtonComponent, label: string) => {
                btn.setTooltip(label);
                btn.buttonEl.setAttribute("aria-label", label);
            };

            const checkBtn = new ButtonComponent(actionGroup);
            checkBtn.setIcon("refresh-cw");
            prepareActionButton(checkBtn, t("来源_检查更新_按钮"));
            checkBtn.onClick(async () => {
                checkBtn.setDisabled(true);
                await this.checkBetaSource(source);
                checkBtn.setDisabled(false);
                this.renderContent();
            });

            const updateBtn = new ButtonComponent(actionGroup);
            updateBtn.setIcon("download");
            prepareActionButton(updateBtn, t("来源_更新_按钮"));
            updateBtn.setDisabled(!source.latestVersion && localVersion === notInstalledText);
            updateBtn.onClick(async () => {
                updateBtn.setDisabled(true);
                await this.updateBetaSource(source);
                updateBtn.setDisabled(false);
                this.renderContent();
            });

            const reinstallBtn = new ButtonComponent(actionGroup);
            reinstallBtn.setIcon("rotate-ccw");
            prepareActionButton(reinstallBtn, t("来源_重装_按钮"));
            reinstallBtn.onClick(async () => {
                reinstallBtn.setDisabled(true);
                await this.updateBetaSource(source, true);
                reinstallBtn.setDisabled(false);
                this.renderContent();
            });

            const githubBtn = new ButtonComponent(actionGroup);
            githubBtn.setIcon("github");
            prepareActionButton(githubBtn, t("来源_打开GitHub_按钮"));
            githubBtn.onClick(() => {
                window.open(`https://github.com/${source.repo}`);
            });

            const removeBtn = new ButtonComponent(actionGroup);
            removeBtn.setIcon("trash-2");
            prepareActionButton(removeBtn, t("来源_停止跟踪_按钮"));
            removeBtn.onClick(async () => {
                if (!window.confirm(t("来源_停止跟踪_确认"))) return;
                this.manager.settings.BETA_SOURCES = this.getBetaSources().filter((item) => item !== source);
                await this.manager.saveSettings();
                this.renderContent();
            });
        }
    }

    private getNormalizedInstallRepo(): string {
        return sanitizeRepo(this.installRepo);
    }

    private isValidInstallRepo(repo: string): boolean {
        return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
    }

    private requireInstallRepo(): string | null {
        const repo = this.getNormalizedInstallRepo();
        if (!this.isValidInstallRepo(repo)) return null;
        this.installRepo = repo;
        return repo;
    }

    // 安装面板
    private showInstallPanel() {
        this.contentEl.empty();
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        const repo = this.getNormalizedInstallRepo();
        const repoIsValid = this.isValidInstallRepo(repo);
        const typeLabel = this.installType === "plugin"
            ? t("管理器_安装_类型_插件")
            : t("管理器_安装_类型_主题");
        const versionLabel = this.installVersion || t("管理器_安装_版本_默认最新");
        const sources = this.getBetaSources();
        const stats = this.getSourceStats(sources);
        const workspace = this.contentEl.createDiv("manager-repo-page");
        const toolbar = workspace.createDiv("manager-repo-page__toolbar");
        const switcher = toolbar.createDiv("manager-repo-page__switcher");
        const createWorkspaceButton = (page: "install" | "sources", icon: string, label: string, count?: number) => {
            const button = switcher.createEl("button", { cls: "manager-repo-page__switch" });
            const selected = this.activePage === page;
            button.type = "button";
            button.toggleClass("is-active", selected);
            button.setAttribute("aria-pressed", `${selected}`);
            const iconEl = button.createSpan({ cls: "manager-repo-page__switch-icon" });
            setIcon(iconEl, icon);
            button.createSpan({ cls: "manager-repo-page__switch-label", text: label });
            if (typeof count === "number") button.createSpan({ cls: "manager-repo-page__switch-count", text: `${count}` });
            button.addEventListener("click", () => {
                if (this.activePage === page) return;
                this.activePage = page;
                this.syncPageChrome();
                this.renderContent();
            });
        };
        createWorkspaceButton("install", "download", t("来源_安装仓库_按钮"));
        createWorkspaceButton("sources", "radio-tower", t("来源_订阅_标题"), stats.total);

        const toolbarStats = toolbar.createDiv("manager-repo-page__stats");
        [
            { label: t("来源_统计_来源"), value: stats.total, icon: "radio-tower" },
            { label: t("来源_统计_插件"), value: stats.plugins, icon: "blocks" },
            { label: t("来源_统计_主题"), value: stats.themes, icon: "palette" },
            { label: t("来源_统计_自动"), value: stats.auto, icon: "refresh-cw" },
            { label: t("来源_统计_可更新"), value: stats.updates, icon: "download" },
        ].forEach((item) => {
            const chip = toolbarStats.createSpan({ cls: "manager-repo-page__stat" });
            chip.setAttribute("aria-label", `${item.label} ${item.value}`);
            const chipIcon = chip.createSpan({ cls: "manager-repo-page__stat-icon" });
            setIcon(chipIcon, item.icon);
            chip.createSpan({ cls: "manager-repo-page__stat-label", text: item.label });
            chip.createSpan({ cls: "manager-repo-page__stat-value", text: `${item.value}` });
        });

        const body = workspace.createDiv("manager-repo-page__body");
        if (this.activePage === "sources") {
            this.showSourcesPanel(body);
            return;
        }

        const panel = body.createDiv("manager-install");

        const typeSetting = new Setting(panel)
            .setName(t("管理器_安装_类型_标题"))
            .setDesc(t("管理器_安装_类型_描述"));
        typeSetting.settingEl.addClass("manager-install__setting");
        typeSetting.controlEl.addClass("manager-install__type-control");
        const typeSegment = typeSetting.controlEl.createDiv("manager-install__segmented");
        const createTypeButton = (type: "plugin" | "theme", icon: string, label: string) => {
            const button = typeSegment.createEl("button", { cls: "manager-install__segment" });
            button.type = "button";
            button.toggleClass("is-active", this.installType === type);
            button.setAttribute("aria-pressed", `${this.installType === type}`);
            const iconEl = button.createSpan({ cls: "manager-install__segment-icon" });
            setIcon(iconEl, icon);
            button.createSpan({ text: label });
            button.addEventListener("click", () => {
                if (this.installType === type) return;
                this.installType = type;
                this.renderContent();
            });
        };
        createTypeButton("plugin", "blocks", t("管理器_安装_类型_插件"));
        createTypeButton("theme", "palette", t("管理器_安装_类型_主题"));

        let fetchButton: ButtonComponent | undefined;
        let installButton: ButtonComponent | undefined;
        let versionInputEl: HTMLInputElement | undefined;
        let versionSelectEl: HTMLSelectElement | undefined;
        const resetVersionControls = () => {
            if (versionSelectEl) {
                versionSelectEl.innerHTML = "";
                const option = document.createElement("option");
                option.value = "";
                option.text = t("管理器_安装_版本_默认最新");
                versionSelectEl.appendChild(option);
                versionSelectEl.value = "";
            }
            if (versionInputEl) versionInputEl.value = "";
        };
        let releaseTitleEl: HTMLElement | undefined;
        let releaseMetaEl: HTMLElement | undefined;
        let releaseBodyEl: HTMLElement | undefined;
        const formatReleaseDate = (value?: string) => {
            if (!value) return "";
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return "";
            return date.toLocaleDateString();
        };
        const getSelectedRelease = () => {
            if (this.installVersions.length === 0) return null;
            const selected = this.installVersion.trim();
            if (selected) return this.installVersions.find((item) => item.version === selected) ?? null;
            return this.installVersions[0];
        };
        const updateReleaseInfo = () => {
            if (!releaseTitleEl || !releaseMetaEl || !releaseBodyEl) return;
            const release = getSelectedRelease();
            releaseTitleEl.empty();
            releaseMetaEl.empty();
            releaseBodyEl.empty();
            if (!release) {
                releaseTitleEl.setText(t("安装_版本更新信息_标题"));
                releaseBodyEl.setText(t("安装_版本更新信息_空提示"));
                releaseBodyEl.addClass("is-empty");
                return;
            }
            releaseBodyEl.removeClass("is-empty");
            releaseTitleEl.setText(release.name || release.version);
            const metaParts = [
                release.version,
                release.prerelease ? t("安装_发布类型_预发布") : t("安装_发布类型_正式版"),
                formatReleaseDate(release.publishedAt),
            ].filter(Boolean);
            releaseMetaEl.setText(metaParts.join(" · "));
            releaseBodyEl.setText((release.body || "").trim() || t("安装_暂无更新说明"));
        };
        const fetchVersions = async () => {
            const validRepo = this.requireInstallRepo();
            if (!validRepo) {
                new Notice(t("管理器_安装_仓库为空提示"));
                return;
            }
            fetchButton?.setDisabled(true);
            fetchButton?.setButtonText(t("管理器_安装_版本_获取中"));
            try {
                this.installVersions = await fetchReleaseVersions(this.manager, validRepo);
                this.installVersion = "";
                if (this.installVersions.length === 0) new Notice(t("管理器_安装_版本_空提示"));
            } catch (e) {
                console.error(e);
                new Notice(t("管理器_安装_版本_失败提示"));
            } finally {
                this.renderContent();
            }
        };

        const repoSetting = new Setting(panel)
            .setName(t("管理器_安装_仓库_标题"))
            .setDesc(t("管理器_安装_仓库_描述"));
        repoSetting.settingEl.addClass("manager-install__setting");
        repoSetting.controlEl.addClass("manager-install__repo-control");
        repoSetting.addText((text) => {
            text.setPlaceholder(t("管理器_安装_仓库_占位"));
            text.setValue(this.installRepo);
            text.inputEl.addClass("manager-install__repo-input");
            text.inputEl.setAttribute("spellcheck", "false");
            text.onChange((value) => {
                const nextRepo = sanitizeRepo(value);
                if (nextRepo !== this.getNormalizedInstallRepo()) {
                    this.installVersions = [];
                    this.installVersion = "";
                    resetVersionControls();
                }
                this.installRepo = value;
                installButton?.setDisabled(!this.isValidInstallRepo(nextRepo));
            });
            text.inputEl.addEventListener("blur", () => {
                const nextRepo = this.getNormalizedInstallRepo();
                this.installRepo = nextRepo;
                text.setValue(nextRepo);
                installButton?.setDisabled(!this.isValidInstallRepo(nextRepo));
            });
            text.inputEl.addEventListener("keydown", (event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void fetchVersions();
            });
        });

        const historyItems = this.getInstallHistoryOptions();
        if (historyItems.length > 0) {
            const historyPanel = panel.createDiv("manager-install__history");
            const historyHead = historyPanel.createDiv("manager-install__history-head");
            const historyTitle = historyHead.createDiv("manager-install__history-title");
            const historyIcon = historyTitle.createSpan({ cls: "manager-install__history-title-icon" });
            setIcon(historyIcon, "history");
            historyTitle.createSpan({ text: t("安装_历史_标题") });
            historyTitle.createSpan({ cls: "manager-install__history-count", text: `${historyItems.length}` });
            if (this.getInstallHistory().length > 0) {
                const clearHistoryBtn = historyHead.createEl("button", { cls: "manager-install__history-clear" });
                clearHistoryBtn.type = "button";
                clearHistoryBtn.setAttribute("aria-label", t("安装_历史_清空"));
                clearHistoryBtn.setAttribute("title", t("安装_历史_清空"));
                const clearIcon = clearHistoryBtn.createSpan();
                setIcon(clearIcon, "x");
                clearHistoryBtn.addEventListener("click", async () => {
                    if (!window.confirm(t("安装_历史_清空_确认"))) return;
                    this.manager.settings.INSTALL_HISTORY = [];
                    await this.manager.saveSettings();
                    this.renderContent();
                });
            }

            const historyList = historyPanel.createDiv("manager-install__history-list");
            historyList.setAttribute("tabindex", "0");
            historyList.setAttribute("aria-label", t("安装_历史_标题"));
            historyItems.forEach((item) => {
                const historyBtn = historyList.createEl("button", { cls: "manager-install__history-item" });
                historyBtn.type = "button";
                historyBtn.setAttribute("aria-label", t("安装_历史_选择_标签", { repo: item.repo }));
                historyBtn.setAttribute("title", item.repo);
                const itemIcon = historyBtn.createSpan({ cls: "manager-install__history-item-icon" });
                setIcon(itemIcon, item.type === "plugin" ? "blocks" : "palette");
                const textWrap = historyBtn.createSpan({ cls: "manager-install__history-item-text" });
                textWrap.createSpan({ cls: "manager-install__history-item-repo", text: item.repo });
                historyBtn.addEventListener("click", () => {
                    this.installRepo = item.repo;
                    this.installType = item.type;
                    this.installVersion = item.version || "";
                    this.installVersions = [];
                    this.installTrackSource = item.trackSource ?? true;
                    this.renderContent();
                });
            });
        }

        const versionSetting = new Setting(panel)
            .setName(t("管理器_安装_版本_标题"))
            .setDesc(t("管理器_安装_版本_描述"));
        versionSetting.settingEl.addClass("manager-install__setting");
        versionSetting.controlEl.addClass("manager-install__version-control");
        versionSetting.addDropdown((dd) => {
            versionSelectEl = dd.selectEl;
            dd.addOption("", t("管理器_安装_版本_默认最新"));
            this.installVersions.forEach((v) => dd.addOption(v.version, `${v.version}${v.prerelease ? " (pre)" : ""}`));
            dd.setValue(this.installVersion);
            dd.onChange((v) => {
                this.installVersion = v;
                if (versionInputEl) versionInputEl.value = v;
                updateReleaseInfo();
            });
            dd.selectEl.addClass("manager-install__version-select");
        });
        versionSetting.addText((text) => {
            versionInputEl = text.inputEl;
            text.setPlaceholder("tag");
            text.setValue(this.installVersion);
            text.inputEl.addClass("manager-install__version-input");
            text.inputEl.setAttribute("spellcheck", "false");
            text.onChange((value) => {
                this.installVersion = value.trim();
                updateReleaseInfo();
            });
            text.inputEl.addEventListener("keydown", (event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void fetchVersions();
            });
        });
        versionSetting.addButton((btn) => {
            fetchButton = btn;
            btn.setButtonText(t("管理器_安装_版本_获取按钮"));
            btn.onClick(() => { void fetchVersions(); });
        });

        const releaseInfo = panel.createDiv("manager-install__release");
        const releaseInfoHead = releaseInfo.createDiv("manager-install__release-head");
        const releaseInfoIcon = releaseInfoHead.createSpan({ cls: "manager-install__release-icon" });
        setIcon(releaseInfoIcon, "newspaper");
        const releaseInfoText = releaseInfoHead.createDiv("manager-install__release-text");
        releaseTitleEl = releaseInfoText.createDiv("manager-install__release-title");
        releaseMetaEl = releaseInfoText.createDiv("manager-install__release-meta");
        releaseBodyEl = releaseInfo.createDiv("manager-install__release-body");
        updateReleaseInfo();

        const trackSetting = new Setting(panel)
            .setName(t("来源_跟踪来源_标题"))
            .setDesc(t("来源_跟踪来源_描述"));
        trackSetting.settingEl.addClass("manager-install__setting");
        trackSetting.addToggle((toggle) => {
            toggle.setValue(this.installTrackSource);
            toggle.onChange((value) => {
                this.installTrackSource = value;
            });
        });

        const action = new Setting(panel)
            .setName(t("管理器_安装_操作_标题"))
            .setDesc(`${repoIsValid ? repo : t("管理器_安装_仓库_占位")} · ${typeLabel} · ${versionLabel}`);
        action.settingEl.addClass("manager-install__setting");
        action.settingEl.addClass("manager-install__action");
        action.addButton((btn) => {
            installButton = btn;
            btn.setButtonText(t("管理器_安装_操作_按钮"));
            btn.setCta();
            btn.setDisabled(!repoIsValid);
            btn.onClick(async () => {
                const validRepo = this.requireInstallRepo();
                if (!validRepo) { new Notice(t("管理器_安装_仓库为空提示")); return; }
                btn.setDisabled(true);
                btn.setButtonText(t("管理器_安装_操作_安装中"));
                const ok = this.installType === "plugin"
                    ? await installPluginFromGithub(this.manager, validRepo, this.installVersion)
                    : await installThemeFromGithub(this.manager, validRepo, this.installVersion);
                btn.setDisabled(false);
                if (ok) {
                    this.rememberInstallHistory(validRepo, this.installType, this.installVersion, this.installTrackSource);
                    if (this.installTrackSource) {
                        const pluginId = this.installType === "plugin" ? this.getPluginIdByRepo(validRepo) : validRepo;
                        this.upsertBetaSource({
                            id: pluginId || validRepo,
                            repo: validRepo,
                            type: this.installType,
                            mode: this.installVersion ? "frozen" : "latest",
                            frozenVersion: this.installVersion || undefined,
                            autoUpdate: false,
                            enabled: true,
                            localVersion: this.installVersion || getSelectedRelease()?.version || undefined,
                            latestVersion: this.installVersion || getSelectedRelease()?.version || undefined,
                            lastChecked: Date.now(),
                        });
                    }
                    await this.manager.saveSettings();
                    this.activePage = this.installTrackSource ? "sources" : "plugins";
                    this.syncPageChrome();
                    this.renderContent();
                } else {
                    btn.setButtonText(t("管理器_安装_操作_按钮"));
                }
            });
        });
    }

    private async showRibbonPanel(renderGeneration = this.renderGeneration) {
        this.contentEl.empty();
        const page = this.contentEl.createDiv("manager-ribbon-page ribbon-manager-modal");
        page.createDiv({
            cls: "manager-ribbon-page__loading",
            text: this.manager.translator.t("Ribbon_标题"),
        });
        if (!this.ribbonPage) this.ribbonPage = new RibbonModal(this.app, this.manager);
        this.manager.ribbonModal = this.ribbonPage;
        await this.ribbonPage.syncRibbonItems();
        if (!this.isRenderCurrent(renderGeneration, "ribbon")) return;
        this.ribbonPage.display(page, false);
    }

    private showTroubleshootPanel() {
        this.contentEl.empty();
        if (!this.troubleshootPanel) {
            this.troubleshootPanel = new TroubleshootPanel(this.app, this.manager, () => this.updateStats());
        }
        this.troubleshootPanel.display(this.contentEl);
    }

    private renderTransferCardHeader(card: HTMLElement, icon: string, title: string, desc: string) {
        const header = card.createDiv("manager-transfer-card__header");
        const iconWrap = header.createDiv("manager-transfer-card__icon");
        setIcon(iconWrap, icon);
        const textWrap = header.createDiv("manager-transfer-card__title-group");
        textWrap.createDiv({ cls: "manager-transfer-card__title", text: title });
        textWrap.createDiv({ cls: "manager-transfer-card__desc", text: desc });
    }

    private renderTransferExportHeader(card: HTMLElement) {
        const t = (k: any) => this.manager.translator.t(k);
        const header = card.createDiv("manager-transfer-card__header manager-transfer-card__header--split");
        const main = header.createDiv("manager-transfer-card__header-main");
        const iconWrap = main.createDiv("manager-transfer-card__icon");
        setIcon(iconWrap, "package-open");
        const textWrap = main.createDiv("manager-transfer-card__title-group");
        textWrap.createDiv({ cls: "manager-transfer-card__title", text: t("导入导出_导出标题") });
        textWrap.createDiv({ cls: "manager-transfer-card__desc", text: t("导入导出_导出说明") });

        const downloadBtn = new ButtonComponent(header);
        downloadBtn.setIcon("download");
        downloadBtn.setButtonText(t("导入导出_下载JSON"));
        downloadBtn.setCta();
        downloadBtn.setDisabled(this.transferBusy);
        downloadBtn.onClick(() => { void this.exportTransferPackage("download"); });
    }

    private renderTransferDownloadHeader(card: HTMLElement) {
        const t = (k: any) => this.manager.translator.t(k);
        const header = card.createDiv("manager-transfer-card__header manager-transfer-card__header--split");
        const main = header.createDiv("manager-transfer-card__header-main");
        const iconWrap = main.createDiv("manager-transfer-card__icon");
        setIcon(iconWrap, "download");
        const textWrap = main.createDiv("manager-transfer-card__title-group");
        textWrap.createDiv({ cls: "manager-transfer-card__title", text: t("导入导出_下载清单标题") });
        textWrap.createDiv({ cls: "manager-transfer-card__desc", text: t("导入导出_下载清单说明") });

        const total = this.transferPackage
            ? (this.transferPackage.data.plugins || []).length + (this.transferPackage.data.themes || []).length
            : 0;
        const downloadAllBtn = new ButtonComponent(header);
        downloadAllBtn.setIcon("download");
        downloadAllBtn.setButtonText(t("导入导出_一键下载"));
        downloadAllBtn.setCta();
        downloadAllBtn.setDisabled(this.transferBusy || total === 0);
        downloadAllBtn.onClick(() => { void this.downloadAllTransferItems(); });
    }

    private renderTransferMetric(container: HTMLElement, icon: string, label: string, value: string | number, tone?: string, summaryKey?: string): HTMLElement {
        const metric = container.createDiv(`manager-transfer-metric${tone ? ` ${tone}` : ""}`);
        const iconEl = metric.createSpan({ cls: "manager-transfer-metric__icon" });
        setIcon(iconEl, icon);
        const text = metric.createSpan({ cls: "manager-transfer-metric__text" });
        text.createSpan({ cls: "manager-transfer-metric__label", text: label });
        const valueEl = text.createSpan({ cls: "manager-transfer-metric__value", text: `${value}` });
        if (summaryKey) valueEl.setAttribute("data-transfer-summary-value", summaryKey);
        return metric;
    }

    private renderTransferBuildToggle(container: HTMLElement, key: "plugins" | "themes" | "pluginConfigs" | "taxonomy" | "layout" | "sources" | "workspaceSettings", icon: string, label: string, desc: string) {
        const option = container.createDiv("manager-transfer-option");
        const text = option.createDiv("manager-transfer-option__text");
        const title = text.createDiv("manager-transfer-option__title");
        const iconEl = title.createSpan({ cls: "manager-transfer-option__icon" });
        setIcon(iconEl, icon);
        title.createSpan({ text: label });
        text.createDiv({ cls: "manager-transfer-option__desc", text: desc });
        const control = option.createDiv("manager-transfer-option__control");
        const toggle = new ToggleComponent(control);
        toggle.setValue(Boolean(this.transferBuildOptions[key]));
        toggle.toggleEl.setAttribute("aria-label", label);
        toggle.onChange((value) => {
            this.transferBuildOptions[key] = value;
        });
    }

    private renderTransferImportToggle(container: HTMLElement, key: keyof Omit<ManagerTransferImportOptions, "installVersionStrategy" | "selectedPluginConfigIds">, icon: string, label: string, desc: string) {
        const option = container.createDiv("manager-transfer-option");
        const text = option.createDiv("manager-transfer-option__text");
        const title = text.createDiv("manager-transfer-option__title");
        const iconEl = title.createSpan({ cls: "manager-transfer-option__icon" });
        setIcon(iconEl, icon);
        title.createSpan({ text: label });
        text.createDiv({ cls: "manager-transfer-option__desc", text: desc });
        const control = option.createDiv("manager-transfer-option__control");
        const toggle = new ToggleComponent(control);
        toggle.setValue(Boolean(this.transferImportOptions[key]));
        toggle.toggleEl.setAttribute("aria-label", label);
        toggle.onChange((value) => {
            this.transferImportOptions[key] = value;
        });
    }

    private getTransferPluginItems(): PluginManifest[] {
        return (Object.values(this.appPlugins.manifests || {}) as PluginManifest[])
            .filter((plugin) => plugin.id !== this.manager.manifest.id)
            .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    }

    private async getTransferPluginConfigItems(
        plugins: PluginManifest[]
    ): Promise<Array<{ id: string; name: string; meta: string }>> {
        const adapter = this.app.vault.adapter;
        const items: Array<{ id: string; name: string; meta: string }> = [];
        for (const plugin of plugins) {
            const path = normalizePath(`${this.app.vault.configDir}/plugins/${plugin.id}/data.json`);
            try {
                if (!(await adapter.exists(path))) continue;
                items.push({
                    id: plugin.id,
                    name: plugin.name || plugin.id,
                    meta: `${plugin.id} · data.json`,
                });
            } catch {
                // A single unreadable plugin folder should not block the export page.
            }
        }
        return items.sort((a, b) => a.name.localeCompare(b.name));
    }

    private async getTransferThemeItems(): Promise<ManagerTransferTheme[]> {
        return collectInstalledThemes(this.manager, undefined, false);
    }

    private ensureTransferSelections(
        plugins: PluginManifest[],
        themes: ManagerTransferTheme[],
        pluginConfigs: Array<{ id: string }>
    ) {
        const pluginIds = new Set(plugins.map((plugin) => plugin.id));
        const themeNames = new Set(themes.map((theme) => theme.name));
        const pluginConfigIds = new Set(pluginConfigs.map((config) => config.id));

        if (!this.transferSelectionInitialized) {
            this.transferSelectedPluginIds = new Set(pluginIds);
            this.transferSelectedThemeNames = new Set(themeNames);
            this.transferSelectedPluginConfigIds = new Set();
            this.transferSelectionInitialized = true;
            return;
        }

        this.transferSelectedPluginIds = new Set([...this.transferSelectedPluginIds].filter((id) => pluginIds.has(id)));
        this.transferSelectedThemeNames = new Set([...this.transferSelectedThemeNames].filter((name) => themeNames.has(name)));
        this.transferSelectedPluginConfigIds = new Set([...this.transferSelectedPluginConfigIds].filter((id) => pluginConfigIds.has(id)));
    }

    private createSelectedTransferBuildOptions(): ManagerTransferBuildOptions {
        const selectedPluginIds = [...this.transferSelectedPluginIds];
        const selectedThemeNames = [...this.transferSelectedThemeNames];
        const selectedPluginConfigIds = [...this.transferSelectedPluginConfigIds];
        return {
            ...DEFAULT_TRANSFER_BUILD_OPTIONS,
            plugins: selectedPluginIds.length > 0,
            themes: selectedThemeNames.length > 0,
            pluginConfigs: selectedPluginConfigIds.length > 0,
            taxonomy: false,
            layout: false,
            sources: false,
            workspaceSettings: false,
            selectedPluginIds,
            selectedThemeNames,
            selectedPluginConfigIds,
        };
    }

    private updateTransferSelectionSummary() {
        const setValue = (key: string, value: number) => {
            const el = this.contentEl.querySelector<HTMLElement>(`[data-transfer-summary-value="${key}"]`);
            if (el) el.setText(`${value}`);
        };
        setValue("selected-plugins", this.transferSelectedPluginIds.size);
        setValue("selected-themes", this.transferSelectedThemeNames.size);
        setValue("selected-configs", this.transferSelectedPluginConfigIds.size);
    }

    private renderTransferSelectionList(
        container: HTMLElement,
        title: string,
        icon: string,
        emptyText: string,
        items: Array<{ id: string; name: string; meta: string; icon: string; type: string; selected: boolean; configAvailable?: boolean; configSelected?: boolean; configLabel?: string }>,
        onChange: (id: string, selected: boolean) => void,
        onSelectAll: (selected: boolean) => void,
        onConfigChange?: (id: string, selected: boolean) => void,
        onConfigSelectAll?: (selected: boolean) => void
    ) {
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        const panel = container.createDiv("manager-transfer-list");
        const header = panel.createDiv("manager-transfer-list__header");
        const titleWrap = header.createDiv("manager-transfer-list__title");
        const titleIcon = titleWrap.createSpan({ cls: "manager-transfer-list__icon" });
        setIcon(titleIcon, icon);
        titleWrap.createSpan({ text: title });
        const actions = header.createDiv("manager-transfer-list__actions");
        const totalCount = items.length + items.filter((item) => item.configAvailable).length;
        const getSelectedCount = () => items.filter((item) => item.selected).length
            + items.filter((item) => item.configAvailable && item.configSelected).length;
        const countEl = actions.createSpan({
            cls: "manager-transfer-list__count",
            text: t("导入导出_已选数量", { selected: getSelectedCount(), total: totalCount }),
        });
        const updateSelectionChrome = () => {
            const selectedCount = getSelectedCount();
            const allSelected = totalCount > 0 && selectedCount === totalCount;
            countEl.setText(t("导入导出_已选数量", { selected: selectedCount, total: totalCount }));
            toggleAll.setText(allSelected ? t("导入导出_取消全选") : t("导入导出_全选"));
            this.updateTransferSelectionSummary();
        };
        const toggleAll = actions.createEl("button", {
            cls: "manager-transfer-list__toggle-all",
            text: totalCount > 0 && getSelectedCount() === totalCount ? t("导入导出_取消全选") : t("导入导出_全选"),
        });
        toggleAll.type = "button";
        toggleAll.disabled = this.transferBusy || items.length === 0;

        const body = panel.createDiv("manager-transfer-list__body");
        toggleAll.addEventListener("click", () => {
            const nextSelected = !(totalCount > 0 && getSelectedCount() === totalCount);
            onSelectAll(nextSelected);
            onConfigSelectAll?.(nextSelected);
            items.forEach((item) => {
                item.selected = nextSelected;
                if (item.configAvailable) item.configSelected = nextSelected;
            });
            body.querySelectorAll<HTMLInputElement>(".manager-transfer-list__checkbox, .manager-transfer-list__config-checkbox")
                .forEach((input) => {
                    input.checked = nextSelected;
                });
            updateSelectionChrome();
        });
        if (items.length === 0) {
            body.createDiv({ cls: "manager-transfer-list__empty", text: emptyText });
            return;
        }

        items.forEach((item) => {
            const row = body.createDiv("manager-transfer-list__item");
            const primary = row.createEl("label", { cls: "manager-transfer-list__primary" });
            const checkbox = primary.createEl("input", { type: "checkbox", cls: "manager-transfer-list__checkbox" }) as HTMLInputElement;
            checkbox.checked = item.selected;
            checkbox.disabled = this.transferBusy;
            checkbox.addEventListener("change", () => {
                item.selected = checkbox.checked;
                onChange(item.id, checkbox.checked);
                updateSelectionChrome();
            });

            const itemIcon = primary.createSpan({ cls: "manager-transfer-list__item-icon" });
            setIcon(itemIcon, item.icon);
            const text = primary.createSpan({ cls: "manager-transfer-list__text" });
            text.createSpan({ cls: "manager-transfer-list__name", text: item.name });
            text.createSpan({ cls: "manager-transfer-list__meta", text: `${item.type} · ${item.meta}` });

            if (item.configAvailable && onConfigChange) {
                const config = row.createEl("label", { cls: "manager-transfer-list__config" });
                const configCheckbox = config.createEl("input", { type: "checkbox", cls: "manager-transfer-list__config-checkbox" }) as HTMLInputElement;
                configCheckbox.checked = Boolean(item.configSelected);
                configCheckbox.disabled = this.transferBusy;
                const configIcon = config.createSpan({ cls: "manager-transfer-list__config-icon" });
                setIcon(configIcon, "file-cog");
                config.createSpan({ cls: "manager-transfer-list__config-text", text: item.configLabel || t("导入导出_配置短标签") });
                configCheckbox.addEventListener("change", () => {
                    item.configSelected = configCheckbox.checked;
                    onConfigChange(item.id, configCheckbox.checked);
                    updateSelectionChrome();
                });
            }
        });
    }

    private createTransferFilename(): string {
        const pad = (value: number) => `${value}`.padStart(2, "0");
        const d = new Date();
        const stamp = [
            d.getFullYear(),
            pad(d.getMonth() + 1),
            pad(d.getDate()),
            "-",
            pad(d.getHours()),
            pad(d.getMinutes()),
            pad(d.getSeconds()),
        ].join("");
        return `obsidian-plugin-pack-${stamp}.json`;
    }

    private downloadTextFile(filename: string, text: string) {
        const blob = new Blob([text], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    private async writeTransferPackageToVault(filename: string, text: string): Promise<string> {
        const adapter = this.app.vault.adapter;
        const folder = "Obsidian-Plugin-Exports";
        if (!(await adapter.exists(folder))) await adapter.mkdir(folder);
        const path = normalizePath(`${folder}/${filename}`);
        await adapter.write(path, text);
        return path;
    }

    private async exportTransferPackage(mode: "download" | "vault") {
        if (this.transferBusy) return;
        const selectedOptions = this.createSelectedTransferBuildOptions();
        if (
            (selectedOptions.selectedPluginIds || []).length
            + (selectedOptions.selectedThemeNames || []).length
            + (selectedOptions.selectedPluginConfigIds || []).length === 0
        ) {
            new Notice(this.manager.translator.t("导入导出_未选择导出项"));
            return;
        }
        this.transferBusy = true;
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        const progress = this.showInlineProgress(t("导入导出_生成中"), t("导入导出_生成准备"));
        try {
            const transferPackage = await buildManagerTransferPackage(this.manager, selectedOptions, (processed, total, current) => {
                progress.update(processed, total, current);
            });
            const filename = this.createTransferFilename();
            const text = JSON.stringify(transferPackage, null, 2);
            if (mode === "download") {
                this.downloadTextFile(filename, text);
                new Notice(t("导入导出_已下载", { name: filename }));
            } else {
                const path = await this.writeTransferPackageToVault(filename, text);
                new Notice(t("导入导出_已保存", { path }));
            }
        } catch (error) {
            console.error("[BPM] export transfer package failed", error);
            new Notice(t("导入导出_导出失败"));
        } finally {
            progress.hide();
            this.transferBusy = false;
            this.renderContent();
        }
    }

    private async loadTransferFile(file: File) {
        const t = (k: any) => this.manager.translator.t(k);
        try {
            const raw = await file.text();
            const transferPackage = parseManagerTransferPackage(raw);
            this.transferPackage = transferPackage;
            this.transferPreview = await createManagerTransferPreview(this.manager, transferPackage);
            this.transferImportResult = undefined;
            this.transferFileName = file.name;
            this.renderContent();
        } catch (error) {
            console.error("[BPM] import transfer package parse failed", error);
            new Notice(t("导入导出_文件无效"));
        }
    }

    private normalizeTransferRepo(input?: string): string {
        const repo = sanitizeRepo(input || "");
        if (!repo || repo.includes(":")) return "";
        return repo.includes("/") ? repo : "";
    }

    private async resolveTransferPluginRepo(plugin: ManagerTransferPackage["data"]["plugins"][number]): Promise<string> {
        const repo = this.normalizeTransferRepo(plugin.repo || plugin.downloadUrl);
        if (repo && repo.includes("/")) return repo;
        try {
            return this.normalizeTransferRepo(await this.manager.repoResolver.resolveRepo(plugin.id) || "");
        } catch {
            return "";
        }
    }

    private resolveTransferThemeRepo(theme: ManagerTransferTheme): string {
        return this.normalizeTransferRepo(theme.repo || theme.downloadUrl);
    }

    private isTransferPluginSameLocalVersion(plugin: ManagerTransferPackage["data"]["plugins"][number]): boolean {
        const localVersion = (this.appPlugins.manifests?.[plugin.id] as PluginManifest | undefined)?.version?.trim();
        const packageVersion = plugin.version?.trim();
        return Boolean(localVersion && packageVersion && localVersion === packageVersion);
    }

    private createEmptyTransferResult(): ManagerTransferImportResult {
        return {
            installedPlugins: 0,
            updatedPlugins: 0,
            skippedPlugins: 0,
            failedPlugins: [],
            installedThemes: 0,
            updatedThemes: 0,
            skippedThemes: 0,
            failedThemes: [],
            appliedPluginConfigs: 0,
            skippedPluginConfigs: 0,
            failedPluginConfigs: [],
            settingsMerged: false,
            layoutMerged: false,
            sourcesMerged: false,
        };
    }

    private async downloadTransferPlugin(plugin: ManagerTransferPackage["data"]["plugins"][number], result: ManagerTransferImportResult) {
        const repo = await this.resolveTransferPluginRepo(plugin);
        if (!repo) {
            result.failedPlugins.push({
                id: plugin.id,
                name: plugin.name || plugin.id,
                reason: this.manager.translator.t("导入导出_缺少下载来源"),
            });
            return;
        }

        const wasInstalled = Boolean(this.appPlugins.manifests?.[plugin.id]);
        const ok = await installPluginFromGithub(this.manager, repo, undefined, false);
        await this.appPlugins.loadManifests();
        if (ok && this.appPlugins.manifests?.[plugin.id]) {
            if (wasInstalled) {
                result.updatedPlugins++;
            } else {
                result.installedPlugins++;
            }
            return;
        }

        result.failedPlugins.push({
            id: plugin.id,
            name: plugin.name || plugin.id,
            reason: this.manager.translator.t("导入导出_下载失败"),
        });
    }

    private async downloadTransferTheme(theme: ManagerTransferTheme, result: ManagerTransferImportResult) {
        const repo = this.resolveTransferThemeRepo(theme);
        if (!repo) {
            result.failedThemes.push({
                id: theme.name,
                name: theme.name,
                reason: this.manager.translator.t("导入导出_缺少下载来源"),
            });
            return;
        }

        const installedBefore = await collectInstalledThemes(this.manager, undefined, false);
        const wasInstalled = installedBefore.some((item) => item.name === theme.name);
        const ok = await installThemeFromGithub(this.manager, repo);
        if (ok) {
            if (wasInstalled) {
                result.updatedThemes++;
            } else {
                result.installedThemes++;
            }
            return;
        }

        result.failedThemes.push({
            id: theme.name,
            name: theme.name,
            reason: this.manager.translator.t("导入导出_下载失败"),
        });
    }

    private async downloadSingleTransferItem(kind: "plugin" | "theme", index: number) {
        if (!this.transferPackage || this.transferBusy) return;
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        const result = this.createEmptyTransferResult();
        this.transferBusy = true;
        const itemName = kind === "plugin"
            ? this.transferPackage.data.plugins[index]?.name || this.transferPackage.data.plugins[index]?.id
            : this.transferPackage.data.themes[index]?.name;
        const progress = this.showInlineProgress(t("导入导出_下载中"), itemName);
        progress.update(0, 1, itemName);
        try {
            if (kind === "plugin") {
                const plugin = this.transferPackage.data.plugins[index];
                if (plugin) await this.downloadTransferPlugin(plugin, result);
            } else {
                const theme = this.transferPackage.data.themes[index];
                if (theme) await this.downloadTransferTheme(theme, result);
            }
            progress.update(1, 1, itemName);
            this.transferImportResult = result;
            this.transferPreview = await createManagerTransferPreview(this.manager, this.transferPackage);
            this.updateStats();
            new Notice(t(result.failedPlugins.length + result.failedThemes.length > 0 ? "导入导出_下载失败" : "导入导出_下载完成"));
        } catch (error) {
            console.error("[BPM] transfer item download failed", error);
            new Notice(t("导入导出_下载失败"));
        } finally {
            progress.hide();
            this.transferBusy = false;
            this.renderContent();
        }
    }

    private async downloadAllTransferItems() {
        if (!this.transferPackage || this.transferBusy) return;
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        const plugins = this.transferPackage.data.plugins || [];
        const themes = this.transferPackage.data.themes || [];
        const total = plugins.length + themes.length;
        if (total === 0) return;

        const result = this.createEmptyTransferResult();
        this.transferBusy = true;
        const progress = this.showInlineProgress(t("导入导出_下载中"), this.transferFileName);
        let processed = 0;
        try {
            for (const plugin of plugins) {
                progress.update(processed, total, plugin.name || plugin.id);
                if (this.isTransferPluginSameLocalVersion(plugin)) {
                    result.skippedPlugins++;
                } else {
                    await this.downloadTransferPlugin(plugin, result);
                }
                processed++;
            }
            for (const theme of themes) {
                progress.update(processed, total, theme.name);
                await this.downloadTransferTheme(theme, result);
                processed++;
            }
            progress.update(processed, total);
            this.transferImportResult = result;
            this.transferPreview = await createManagerTransferPreview(this.manager, this.transferPackage);
            this.updateStats();
            new Notice(t(result.failedPlugins.length + result.failedThemes.length > 0 ? "导入导出_下载部分失败" : "导入导出_下载完成"));
        } catch (error) {
            console.error("[BPM] transfer batch download failed", error);
            new Notice(t("导入导出_下载失败"));
        } finally {
            progress.hide();
            this.transferBusy = false;
            this.renderContent();
        }
    }

    private renderTransferDownloadGroup(
        container: HTMLElement,
        title: string,
        icon: string,
        emptyText: string,
        items: Array<{ name: string; meta: string; icon: string; type: string; canDownload: boolean; onDownload: () => void; actionText?: string; statusText?: string; secondaryText?: string; canSecondary?: boolean; onSecondary?: () => void }>
    ) {
        const t = (k: any) => this.manager.translator.t(k);
        const panel = container.createDiv("manager-transfer-list manager-transfer-download-list");
        const header = panel.createDiv("manager-transfer-list__header");
        const titleWrap = header.createDiv("manager-transfer-list__title");
        const titleIcon = titleWrap.createSpan({ cls: "manager-transfer-list__icon" });
        setIcon(titleIcon, icon);
        titleWrap.createSpan({ text: title });
        header.createSpan({ cls: "manager-transfer-list__count", text: `${items.length}` });

        const body = panel.createDiv("manager-transfer-list__body");
        if (items.length === 0) {
            body.createDiv({ cls: "manager-transfer-list__empty", text: emptyText });
            return;
        }

        items.forEach((item) => {
            const row = body.createDiv("manager-transfer-download__item");
            const itemIcon = row.createSpan({ cls: "manager-transfer-list__item-icon" });
            setIcon(itemIcon, item.icon);
            const text = row.createSpan({ cls: "manager-transfer-list__text" });
            text.createSpan({ cls: "manager-transfer-list__name", text: item.name });
            text.createSpan({ cls: "manager-transfer-list__meta", text: `${item.type} · ${item.meta}` });
            const actions = row.createSpan({ cls: "manager-transfer-download__actions" });
            if (item.statusText) {
                actions.createSpan({ cls: "manager-transfer-download__status", text: item.statusText });
            } else {
                const button = actions.createEl("button", { cls: "manager-transfer-download__button", text: item.actionText || t("导入导出_下载按钮") });
                button.type = "button";
                button.disabled = this.transferBusy || !item.canDownload;
                button.addEventListener("click", () => {
                    item.onDownload();
                });
            }
            if (item.onSecondary) {
                const secondary = actions.createEl("button", { cls: "manager-transfer-download__button manager-transfer-download__button--secondary", text: item.secondaryText || t("导入导出_配置短标签") });
                secondary.type = "button";
                secondary.disabled = this.transferBusy || !item.canSecondary;
                secondary.addEventListener("click", () => {
                    item.onSecondary?.();
                });
            }
        });
    }

    private renderTransferImportDownloadList(container: HTMLElement) {
        if (!this.transferPackage) return;
        const t = (k: any) => this.manager.translator.t(k);
        const wrap = container.createDiv("manager-transfer-selection-grid manager-transfer-download-grid");
        const configs = this.transferPackage.data.pluginConfigs || [];
        const configByPluginId = new Map(configs.map((config) => [config.id, config]));
        const pluginIds = new Set((this.transferPackage.data.plugins || []).map((plugin) => plugin.id));
        const pluginItems = (this.transferPackage.data.plugins || []).map((plugin, index) => {
            const sameLocalVersion = this.isTransferPluginSameLocalVersion(plugin);
            return {
                name: plugin.name || plugin.id,
                meta: `${plugin.id}${plugin.version ? ` · v${plugin.version}` : ""}`,
                icon: "blocks",
                type: t("导入导出_类型_插件"),
                canDownload: !sameLocalVersion && Boolean(plugin.id || plugin.repo || plugin.downloadUrl),
                onDownload: () => { void this.downloadSingleTransferItem("plugin", index); },
                statusText: sameLocalVersion ? t("导入导出_已是当前版本") : undefined,
                secondaryText: configByPluginId.has(plugin.id) ? t("导入导出_配置短标签") : undefined,
                canSecondary: configByPluginId.has(plugin.id),
                onSecondary: configByPluginId.has(plugin.id) ? () => { void this.importTransferPluginConfigs([plugin.id]); } : undefined,
            };
        });
        const themeItems = (this.transferPackage.data.themes || []).map((theme, index) => ({
                name: theme.name,
                meta: `${theme.version ? `v${theme.version}` : t("导入导出_主题无版本")}${theme.active ? ` · ${t("导入导出_当前主题")}` : ""}`,
                icon: "palette",
                type: t("导入导出_类型_主题"),
                canDownload: Boolean(this.resolveTransferThemeRepo(theme)),
                onDownload: () => { void this.downloadSingleTransferItem("theme", index); },
        }));
        const configOnlyItems = configs
            .filter((config) => !pluginIds.has(config.id))
            .map((config) => ({
                name: config.name || config.id,
                meta: `${config.id} · ${config.path}`,
                icon: "file-cog",
                type: t("导入导出_类型_配置"),
                canDownload: true,
                actionText: t("导入导出_导入配置"),
                onDownload: () => { void this.importTransferPluginConfigs([config.id]); },
            }));
        this.renderTransferDownloadGroup(
            wrap,
            t("导入导出_下载列表"),
            "download",
            t("导入导出_无下载项"),
            [...pluginItems, ...themeItems, ...configOnlyItems]
        );
    }

    private renderTransferResult(container: HTMLElement) {
        if (!this.transferImportResult) return;
        const t = (k: any) => this.manager.translator.t(k);
        const result = this.transferImportResult;
        const card = container.createDiv("manager-transfer-result");
        const title = card.createDiv("manager-transfer-result__title");
        const icon = title.createSpan({ cls: "manager-transfer-result__icon" });
        setIcon(icon, "check-check");
        title.createSpan({ text: t("导入导出_导入结果") });
        const metrics = card.createDiv("manager-transfer-result__metrics");
        this.renderTransferMetric(metrics, "download", t("导入导出_结果_已安装插件"), result.installedPlugins);
        this.renderTransferMetric(metrics, "blocks", t("导入导出_结果_已更新插件"), result.updatedPlugins);
        this.renderTransferMetric(metrics, "file-cog", t("导入导出_结果_配置文件"), result.appliedPluginConfigs);
        this.renderTransferMetric(metrics, "palette", t("导入导出_结果_已安装主题"), result.installedThemes);
        this.renderTransferMetric(metrics, "radio-tower", t("导入导出_结果_来源"), result.sourcesMerged ? t("通用_完成_文本") : t("通用_跳过_文本"));
        const failures = [...result.failedPlugins, ...result.failedThemes, ...result.failedPluginConfigs];
        if (failures.length > 0) {
            const list = card.createDiv("manager-transfer-result__failures");
            failures.slice(0, 8).forEach((failure) => {
                const item = list.createDiv("manager-transfer-result__failure");
                item.createSpan({ cls: "manager-transfer-result__failure-name", text: failure.name || failure.id });
                item.createSpan({ cls: "manager-transfer-result__failure-reason", text: failure.reason });
            });
        }
    }

    private renderTransferVersionStrategy(container: HTMLElement) {
        const t = (k: any) => this.manager.translator.t(k);
        const row = container.createDiv("manager-transfer-strategy");
        row.createDiv({ cls: "manager-transfer-strategy__label", text: t("导入导出_版本策略") });
        const controls = row.createDiv("manager-transfer-strategy__controls");
        const createButton = (strategy: "latest" | "package", icon: string, label: string) => {
            const button = controls.createEl("button", { cls: "manager-transfer-segment" });
            button.type = "button";
            button.toggleClass("is-active", this.transferImportOptions.installVersionStrategy === strategy);
            button.setAttribute("aria-pressed", `${this.transferImportOptions.installVersionStrategy === strategy}`);
            const iconEl = button.createSpan({ cls: "manager-transfer-segment__icon" });
            setIcon(iconEl, icon);
            button.createSpan({ text: label });
            button.addEventListener("click", () => {
                this.transferImportOptions.installVersionStrategy = strategy;
                this.renderContent();
            });
        };
        createButton("latest", "sparkles", t("导入导出_版本策略_最新"));
        createButton("package", "package-check", t("导入导出_版本策略_配置包"));
    }

    private async runTransferImport() {
        if (!this.transferPackage || this.transferBusy) return;
        this.transferBusy = true;
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        const progress = this.showInlineProgress(t("导入导出_导入中"), this.transferFileName);
        try {
            const result = await applyManagerTransferPackage(this.manager, this.transferPackage, this.transferImportOptions, (processed, total, current) => {
                progress.update(processed, total, current);
            });
            this.transferImportResult = result;
            this.transferPreview = await createManagerTransferPreview(this.manager, this.transferPackage);
            this.updateStats();
            new Notice(t("导入导出_导入完成"));
        } catch (error) {
            console.error("[BPM] import transfer package failed", error);
            new Notice(t("导入导出_导入失败"));
        } finally {
            progress.hide();
            this.transferBusy = false;
            this.renderContent();
        }
    }

    private async importTransferPluginConfigs(configIds: string[]) {
        if (!this.transferPackage || this.transferBusy) return;
        const selectedPluginConfigIds = [...new Set(configIds)];
        if (selectedPluginConfigIds.length === 0) {
            new Notice(this.manager.translator.t("导入导出_未选择配置文件"));
            return;
        }

        this.transferBusy = true;
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        const progress = this.showInlineProgress(t("导入导出_导入配置中"), this.transferFileName);
        const configOnlyPackage: ManagerTransferPackage = {
            ...this.transferPackage,
            data: {
                ...this.transferPackage.data,
                plugins: [],
                themes: [],
            },
        };

        try {
            const result = await applyManagerTransferPackage(this.manager, configOnlyPackage, {
                ...DEFAULT_TRANSFER_IMPORT_OPTIONS,
                applyPluginConfigs: true,
                selectedPluginConfigIds,
            }, (processed, total, current) => {
                progress.update(processed, total, current);
            });
            this.transferImportResult = result;
            this.transferPreview = await createManagerTransferPreview(this.manager, this.transferPackage);
            this.updateStats();
            new Notice(t("导入导出_导入配置完成", { count: result.appliedPluginConfigs }));
        } catch (error) {
            console.error("[BPM] import transfer plugin configs failed", error);
            new Notice(t("导入导出_导入失败"));
        } finally {
            progress.hide();
            this.transferBusy = false;
            this.renderContent();
        }
    }

    private async showTransferPanel(renderGeneration = this.renderGeneration) {
        this.contentEl.empty();
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        const page = this.contentEl.createDiv("manager-transfer");
        const plugins = this.getTransferPluginItems();
        const themes = await this.getTransferThemeItems();
        const pluginConfigs = await this.getTransferPluginConfigItems(plugins);
        if (!this.isRenderCurrent(renderGeneration, "transfer")) return;
        this.ensureTransferSelections(plugins, themes, pluginConfigs);

        const importCard = page.createDiv("manager-transfer-card manager-transfer-import-card");
        this.renderTransferCardHeader(importCard, "archive-restore", t("导入导出_导入标题"), t("导入导出_导入说明"));
        const fileInput = importCard.createEl("input", { type: "file", cls: "manager-transfer-file-input" });
        fileInput.accept = ".json,application/json";
        fileInput.addEventListener("change", () => {
            const file = fileInput.files?.[0];
            if (file) void this.loadTransferFile(file);
            fileInput.value = "";
        });
        const dropzone = importCard.createDiv("manager-transfer-dropzone manager-transfer-dropzone--compact");
        dropzone.setAttribute("role", "button");
        dropzone.setAttribute("tabindex", "0");
        dropzone.setAttribute("aria-label", t("导入导出_选择文件"));
        const dropIcon = dropzone.createDiv("manager-transfer-dropzone__icon");
        setIcon(dropIcon, "file-up");
        dropzone.createDiv({ cls: "manager-transfer-dropzone__title", text: t("导入导出_选择文件") });
        dropzone.createDiv({ cls: "manager-transfer-dropzone__desc", text: t("导入导出_选择文件说明") });
        dropzone.addEventListener("click", () => fileInput.click());
        dropzone.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            fileInput.click();
        });
        dropzone.addEventListener("dragover", (event) => {
            event.preventDefault();
            dropzone.addClass("is-dragover");
        });
        dropzone.addEventListener("dragleave", () => dropzone.removeClass("is-dragover"));
        dropzone.addEventListener("drop", (event) => {
            event.preventDefault();
            dropzone.removeClass("is-dragover");
            const file = event.dataTransfer?.files?.[0];
            if (file) void this.loadTransferFile(file);
        });

        const summary = page.createDiv("manager-transfer-summary");
        this.renderTransferMetric(summary, "blocks", t("导入导出_本机插件"), Math.max(0, Object.keys(this.appPlugins.manifests || {}).length - 1));
        this.renderTransferMetric(summary, "palette", t("导入导出_本机主题"), themes.length);
        this.renderTransferMetric(summary, "file-cog", t("导入导出_本机配置"), pluginConfigs.length);
        this.renderTransferMetric(summary, "check-check", t("导入导出_已选插件"), this.transferSelectedPluginIds.size, undefined, "selected-plugins");
        this.renderTransferMetric(summary, "badge-check", t("导入导出_已选主题"), this.transferSelectedThemeNames.size, undefined, "selected-themes");
        this.renderTransferMetric(summary, "file-check-2", t("导入导出_已选配置"), this.transferSelectedPluginConfigIds.size, undefined, "selected-configs");

        const grid = page.createDiv("manager-transfer-workspace");

        const exportCard = grid.createDiv("manager-transfer-card");
        this.renderTransferExportHeader(exportCard);
        const selectionGrid = exportCard.createDiv("manager-transfer-selection-grid");
        const pluginSelectionItems = plugins.map((plugin) => ({
            id: plugin.id,
            name: plugin.name || plugin.id,
            meta: `${plugin.id}${plugin.version ? ` · v${plugin.version}` : ""}`,
            icon: "blocks",
            type: t("导入导出_类型_插件"),
            selected: this.transferSelectedPluginIds.has(plugin.id),
            configAvailable: pluginConfigs.some((config) => config.id === plugin.id),
            configSelected: this.transferSelectedPluginConfigIds.has(plugin.id),
            configLabel: t("导入导出_配置短标签"),
        }));
        const themeSelectionItems = themes.map((theme) => ({
            id: theme.name,
            name: theme.name,
            meta: `${theme.version ? `v${theme.version}` : t("导入导出_主题无版本")}${theme.active ? ` · ${t("导入导出_当前主题")}` : ""}`,
            icon: "palette",
            type: t("导入导出_类型_主题"),
            selected: this.transferSelectedThemeNames.has(theme.name),
        }));
        this.renderTransferSelectionList(
            selectionGrid,
            t("导入导出_导出列表"),
            "package-open",
            t("导入导出_无导出项"),
            [...pluginSelectionItems, ...themeSelectionItems],
            (id, selected) => {
                if (plugins.some((plugin) => plugin.id === id)) {
                    if (selected) {
                        this.transferSelectedPluginIds.add(id);
                    } else {
                        this.transferSelectedPluginIds.delete(id);
                    }
                } else {
                    if (selected) {
                        this.transferSelectedThemeNames.add(id);
                    } else {
                        this.transferSelectedThemeNames.delete(id);
                    }
                }
            },
            (selected) => {
                this.transferSelectedPluginIds = selected ? new Set(plugins.map((plugin) => plugin.id)) : new Set();
                this.transferSelectedThemeNames = selected ? new Set(themes.map((theme) => theme.name)) : new Set();
            },
            (id, selected) => {
                if (selected) {
                    this.transferSelectedPluginConfigIds.add(id);
                } else {
                    this.transferSelectedPluginConfigIds.delete(id);
                }
            },
            (selected) => {
                this.transferSelectedPluginConfigIds = selected ? new Set(pluginConfigs.map((config) => config.id)) : new Set();
            }
        );

        const packageCard = grid.createDiv("manager-transfer-card manager-transfer-package-card");
        this.renderTransferDownloadHeader(packageCard);
        if (this.transferPackage) {
            this.renderTransferImportDownloadList(packageCard);
        } else {
            const emptyWrap = packageCard.createDiv("manager-transfer-selection-grid manager-transfer-download-grid");
            this.renderTransferDownloadGroup(
                emptyWrap,
                t("导入导出_下载列表"),
                "download",
                t("导入导出_未载入插件包"),
                []
            );
        }

        this.renderTransferResult(page);
    }

    private getVaultRoleLabel(role: SharedVaultRole): string {
        const t = (k: any) => this.manager.translator.t(k);
        switch (role) {
            case "main": return t("共享库_角色_主库");
            case "linked": return t("共享库_角色_软链接库");
            case "mixed": return t("共享库_角色_部分链接");
            case "missing": return t("共享库_角色_路径失效");
            default: return t("共享库_角色_本地库");
        }
    }

    private getVaultFolderLabel(status: SharedVaultFolderStatus): string {
        const t = (k: any) => this.manager.translator.t(k);
        if (!status.exists) return t("共享库_状态_不存在");
        if (status.isSymlink) return t("共享库_状态_已链接");
        return t("共享库_状态_本地文件夹");
    }

    private renderVaultMetric(container: HTMLElement, iconName: string, label: string, value: string | number) {
        const item = container.createDiv("manager-vault-metric");
        const icon = item.createSpan({ cls: "manager-vault-metric__icon" });
        setIcon(icon, iconName);
        const text = item.createDiv("manager-vault-metric__text");
        text.createSpan({ cls: "manager-vault-metric__label", text: label });
        text.createSpan({ cls: "manager-vault-metric__value", text: `${value}` });
    }

    private renderVaultFolderPill(container: HTMLElement, status: SharedVaultFolderStatus) {
        const kindLabel = status.kind === "plugins"
            ? this.manager.translator.t("共享库_文件夹_插件")
            : this.manager.translator.t("共享库_文件夹_主题");
        const pill = container.createSpan({ cls: "manager-vault-folder-pill" });
        pill.toggleClass("is-linked", status.isSymlink);
        pill.toggleClass("is-missing", !status.exists);
        const icon = pill.createSpan({ cls: "manager-vault-folder-pill__icon" });
        setIcon(icon, status.kind === "plugins" ? "blocks" : "palette");
        pill.createSpan({ cls: "manager-vault-folder-pill__label", text: kindLabel });
        pill.createSpan({ cls: "manager-vault-folder-pill__state", text: this.getVaultFolderLabel(status) });
        pill.createSpan({ cls: "manager-vault-folder-pill__count", text: `${status.itemCount}` });
    }

    private renderVaultEmpty(container: HTMLElement, iconName: string, title: string, desc: string) {
        const empty = container.createDiv("manager-vault-empty");
        const icon = empty.createDiv("manager-vault-empty__icon");
        setIcon(icon, iconName);
        empty.createDiv({ cls: "manager-vault-empty__title", text: title });
        empty.createDiv({ cls: "manager-vault-empty__desc", text: desc });
    }

    private renderVaultWarning(container: HTMLElement, text: string) {
        const warning = container.createDiv("manager-vault-warning");
        const icon = warning.createSpan({ cls: "manager-vault-warning__icon" });
        setIcon(icon, "triangle-alert");
        warning.createSpan({ cls: "manager-vault-warning__text", text });
    }

    private createVaultActionButton(
        container: HTMLElement,
        iconName: string,
        tooltip: string,
        onClick: () => void | Promise<void>,
        disabled = false
    ) {
        const button = new ButtonComponent(container);
        button.setIcon(iconName);
        button.setTooltip(tooltip);
        button.buttonEl.addClass("manager-vault-action");
        button.buttonEl.setAttribute("aria-label", tooltip);
        button.setDisabled(disabled);
        button.onClick(() => {
            void onClick();
        });
        return button;
    }

    private async runVaultOperation(action: () => Promise<void>, successMessage: string) {
        try {
            await action();
            new Notice(successMessage);
            await this.reloadShowData();
        } catch (error) {
            console.error("[BPM] shared vault operation failed", error);
            new Notice((error as Error)?.message || this.manager.translator.t("通用_失败_文本"));
        }
    }

    private async handleCreateSharedVaultLinks() {
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        const targetPath = this.vaultTargetPath.trim();
        const kinds: SharedFolderKind[] = [
            ...(this.vaultLinkPlugins ? ["plugins" as SharedFolderKind] : []),
            ...(this.vaultLinkThemes ? ["themes" as SharedFolderKind] : []),
        ];
        if (!targetPath) {
            new Notice(t("共享库_提示_请输入目标库"));
            return;
        }
        if (kinds.length === 0) {
            new Notice(t("共享库_提示_至少选择文件夹"));
            return;
        }
        if (this.vaultBackupExisting && !window.confirm(t("共享库_确认_备份后链接"))) return;

        await this.runVaultOperation(async () => {
            const results = await createSharedVaultLinks(this.manager, targetPath, kinds, this.vaultBackupExisting);
            this.vaultTargetPath = normalizeSharedVaultInputPath(targetPath);
            if (results.some((result) => result.backupPath)) {
                new Notice(t("共享库_提示_已备份原文件夹"));
            }
        }, t("共享库_提示_创建链接成功"));
    }

    private renderVaultToggleOption(
        container: HTMLElement,
        iconName: string,
        title: string,
        desc: string,
        value: boolean,
        onChange: (value: boolean) => void
    ) {
        const option = container.createDiv("manager-vault-option");
        const icon = option.createSpan({ cls: "manager-vault-option__icon" });
        setIcon(icon, iconName);
        const text = option.createDiv("manager-vault-option__text");
        text.createDiv({ cls: "manager-vault-option__title", text: title });
        text.createDiv({ cls: "manager-vault-option__desc", text: desc });
        const control = option.createDiv("manager-vault-option__control");
        new ToggleComponent(control)
            .setValue(value)
            .onChange(onChange);
    }

    private renderVaultSetupCard(page: HTMLElement, snapshotVaultCount: number, currentVault?: SharedVaultStatus) {
        const t = (k: any) => this.manager.translator.t(k);
        const card = page.createDiv("manager-vault-card manager-vault-setup");
        const header = card.createDiv("manager-vault-card__header");
        const icon = header.createDiv("manager-vault-card__icon");
        setIcon(icon, "folder-sync");
        const title = header.createDiv("manager-vault-card__title-group");
        title.createDiv({ cls: "manager-vault-card__title", text: t("共享库_链接设置_标题") });
        title.createDiv({ cls: "manager-vault-card__desc", text: t("共享库_链接设置_说明") });

        const form = card.createDiv("manager-vault-form");
        const pathField = form.createDiv("manager-vault-path-field");
        const pathText = pathField.createDiv("manager-vault-path-field__text");
        pathText.createDiv({ cls: "manager-vault-path-field__label", text: t("共享库_目标库路径_标题") });
        pathText.createDiv({ cls: "manager-vault-path-field__desc", text: t("共享库_目标库路径_说明") });
        const pathControl = pathField.createDiv("manager-vault-path-field__control");
        const input = new TextComponent(pathControl);
        input.setPlaceholder(t("共享库_目标库路径_占位"));
        input.setValue(this.vaultTargetPath);
        input.onChange((value) => {
            this.vaultTargetPath = value;
        });

        const options = form.createDiv("manager-vault-options");
        this.renderVaultToggleOption(
            options,
            "blocks",
            t("共享库_链接插件_标题"),
            t("共享库_链接插件_说明"),
            this.vaultLinkPlugins,
            (value) => {
                this.vaultLinkPlugins = value;
            }
        );
        this.renderVaultToggleOption(
            options,
            "palette",
            t("共享库_链接主题_标题"),
            t("共享库_链接主题_说明"),
            this.vaultLinkThemes,
            (value) => {
                this.vaultLinkThemes = value;
            }
        );
        this.renderVaultToggleOption(
            options,
            "archive",
            t("共享库_备份已有_标题"),
            t("共享库_备份已有_说明"),
            this.vaultBackupExisting,
            (value) => {
                this.vaultBackupExisting = value;
            }
        );

        const actions = card.createDiv("manager-vault-form__actions");
        const setMainButton = new ButtonComponent(actions);
        setMainButton.setIcon("crown");
        setMainButton.setButtonText(t("共享库_设为主库_按钮"));
        const canSetCurrentAsMain = !currentVault || currentVault.role === "main" || currentVault.role === "local";
        setMainButton.setDisabled(!canSetCurrentAsMain);
        setMainButton.onClick(() => {
            void this.runVaultOperation(async () => {
                await setCurrentVaultAsSharedMain(this.manager);
            }, t("共享库_提示_已设为主库"));
        });

        const linkButton = new ButtonComponent(actions);
        linkButton.setIcon("link");
        linkButton.setButtonText(t("共享库_创建链接_按钮"));
        linkButton.setCta();
        linkButton.onClick(() => {
            void this.handleCreateSharedVaultLinks();
        });

        if (snapshotVaultCount === 0) {
            this.renderVaultWarning(card, t("共享库_提示_未发现库"));
        }
        if (!canSetCurrentAsMain) {
            this.renderVaultWarning(card, t("共享库_提示_当前库不能设为主库"));
        }
    }

    private renderVaultList(container: HTMLElement, vaults: SharedVaultStatus[]) {
        const t = (k: any) => this.manager.translator.t(k);
        const list = container.createDiv("manager-vault-list");
        for (const vault of vaults) {
            const selected = vault.id === this.vaultExpandedId;
            const card = list.createDiv("manager-vault-item");
            card.toggleClass("is-current", vault.isCurrent);
            card.toggleClass("is-selected", selected);
            card.toggleClass("is-missing", !vault.exists);

            const main = card.createDiv("manager-vault-item__main");
            const icon = main.createDiv("manager-vault-item__icon");
            setIcon(icon, vault.role === "main" ? "crown" : vault.role === "linked" ? "link" : "folder");
            const text = main.createDiv("manager-vault-item__text");
            const titleRow = text.createDiv("manager-vault-item__title-row");
            titleRow.createSpan({ cls: "manager-vault-item__name", text: vault.name });
            if (vault.isCurrent) titleRow.createSpan({ cls: "manager-vault-item__badge", text: t("共享库_当前库") });
            titleRow.createSpan({ cls: `manager-vault-item__role is-${vault.role}`, text: this.getVaultRoleLabel(vault.role) });
            text.createDiv({ cls: "manager-vault-item__path", text: vault.path });
            const folderRow = text.createDiv("manager-vault-item__folders");
            this.renderVaultFolderPill(folderRow, vault.plugins);
            this.renderVaultFolderPill(folderRow, vault.themes);

            const actions = card.createDiv("manager-vault-item__actions");
            this.createVaultActionButton(actions, selected ? "check" : "sliders-horizontal", t("共享库_操作_管理"), () => {
                this.vaultExpandedId = vault.id;
                this.renderContent();
            }, selected);
            this.createVaultActionButton(actions, "folder-open", t("共享库_操作_打开目录"), () => {
                managerOpen(vault.path, this.manager);
            }, !vault.exists);
            this.createVaultActionButton(actions, "unlink", t("共享库_操作_解除插件链接"), async () => {
                if (!window.confirm(t("共享库_确认_解除链接"))) return;
                await this.runVaultOperation(async () => {
                    await unlinkSharedVaultFolder(this.manager, vault.path, "plugins");
                }, t("共享库_提示_解除链接成功"));
            }, !vault.plugins.isSymlink || vault.isCurrent);
            this.createVaultActionButton(actions, "palette", t("共享库_操作_解除主题链接"), async () => {
                if (!window.confirm(t("共享库_确认_解除链接"))) return;
                await this.runVaultOperation(async () => {
                    await unlinkSharedVaultFolder(this.manager, vault.path, "themes");
                }, t("共享库_提示_解除链接成功"));
            }, !vault.themes.isSymlink);
            this.createVaultActionButton(actions, "trash-2", t("共享库_操作_移出列表"), async () => {
                await this.runVaultOperation(async () => {
                    await forgetSharedVault(this.manager, vault.path);
                }, t("共享库_提示_已移出列表"));
            }, vault.isCurrent || vault.role === "main");
        }
    }

    private renderVaultPluginManager(container: HTMLElement, vault: SharedVaultStatus, plugins: SharedPluginCatalogItem[]) {
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        const card = container.createDiv("manager-vault-panel");
        const header = card.createDiv("manager-vault-panel__header");
        const title = header.createDiv("manager-vault-panel__title");
        const icon = title.createSpan({ cls: "manager-vault-panel__icon" });
        setIcon(icon, "blocks");
        title.createSpan({ text: t("共享库_插件管理_标题") });
        header.createSpan({ cls: "manager-vault-panel__count", text: `${vault.enabledPluginIds.length}/${plugins.length}` });

        const canManagePlugins = vault.exists && (vault.role === "main" || vault.plugins.isSymlink);
        if (!canManagePlugins) {
            this.renderVaultEmpty(card, "link", t("共享库_插件管理_未链接标题"), t("共享库_插件管理_未链接说明"));
            return;
        }
        if (plugins.length === 0) {
            this.renderVaultEmpty(card, "package-x", t("共享库_插件管理_空标题"), t("共享库_插件管理_空说明"));
            return;
        }

        if (this.settings.DELAY) {
            this.renderVaultWarning(card, t("共享库_延迟模式_提示"));
        }

        const enabledSet = new Set(vault.enabledPluginIds);
        const list = card.createDiv("manager-vault-plugin-list");
        for (const plugin of plugins) {
            const isSelf = vault.isCurrent && plugin.id === this.manager.manifest.id;
            const enabled = isSelf ? true : enabledSet.has(plugin.id);
            const item = list.createDiv("manager-vault-plugin");
            item.toggleClass("is-enabled", enabled);
            const itemIcon = item.createDiv("manager-vault-plugin__icon");
            setIcon(itemIcon, enabled ? "check-circle-2" : "circle");
            const text = item.createDiv("manager-vault-plugin__text");
            text.createDiv({ cls: "manager-vault-plugin__name", text: plugin.name || plugin.id });
            text.createDiv({
                cls: "manager-vault-plugin__meta",
                text: `${plugin.id}${plugin.version ? ` · v${plugin.version}` : ""}`,
            });
            const control = item.createDiv("manager-vault-plugin__control");
            const toggle = new ToggleComponent(control);
            toggle.setValue(enabled);
            toggle.setDisabled(isSelf);
            toggle.onChange(async (value) => {
                toggle.setDisabled(true);
                await this.runVaultOperation(async () => {
                    await setSharedVaultPluginEnabled(this.manager, vault.path, plugin.id, value);
                }, t("共享库_提示_插件状态已更新", { name: plugin.name || plugin.id }));
            });
        }
    }

    private renderVaultThemeManager(container: HTMLElement, vault: SharedVaultStatus, themes: SharedThemeCatalogItem[]) {
        const t = (k: any) => this.manager.translator.t(k);
        const card = container.createDiv("manager-vault-panel");
        const header = card.createDiv("manager-vault-panel__header");
        const title = header.createDiv("manager-vault-panel__title");
        const icon = title.createSpan({ cls: "manager-vault-panel__icon" });
        setIcon(icon, "palette");
        title.createSpan({ text: t("共享库_主题管理_标题") });
        header.createSpan({ cls: "manager-vault-panel__count", text: `${themes.length}` });

        const canManageThemes = vault.exists && (vault.role === "main" || vault.themes.isSymlink);
        if (!canManageThemes) {
            this.renderVaultEmpty(card, "link", t("共享库_主题管理_未链接标题"), t("共享库_主题管理_未链接说明"));
            return;
        }

        const row = card.createDiv("manager-vault-theme-row");
        const text = row.createDiv("manager-vault-theme-row__text");
        text.createDiv({ cls: "manager-vault-theme-row__label", text: t("共享库_当前主题_标题") });
        text.createDiv({ cls: "manager-vault-theme-row__desc", text: vault.activeTheme || t("共享库_默认主题") });
        const control = row.createDiv("manager-vault-theme-row__control");
        const dropdown = new DropdownComponent(control);
        dropdown.addOption("", t("共享库_默认主题"));
        const hasActiveTheme = !vault.activeTheme || themes.some((theme) => theme.name === vault.activeTheme);
        if (!hasActiveTheme) dropdown.addOption(vault.activeTheme, vault.activeTheme);
        for (const theme of themes) {
            dropdown.addOption(theme.name, `${theme.name}${theme.version ? ` · v${theme.version}` : ""}`);
        }
        dropdown.setValue(vault.activeTheme);
        dropdown.onChange(async (value) => {
            await this.runVaultOperation(async () => {
                await setSharedVaultTheme(this.manager, vault.path, value);
            }, t("共享库_提示_主题已更新"));
        });
    }

    private renderVaultSelector(container: HTMLElement, vaults: SharedVaultStatus[], selectedVault: SharedVaultStatus) {
        const t = (k: any) => this.manager.translator.t(k);
        const selector = container.createDiv("manager-vault-selector");
        const label = selector.createDiv("manager-vault-selector__label");
        const icon = label.createSpan({ cls: "manager-vault-selector__icon" });
        setIcon(icon, "folder-cog");
        const text = label.createDiv("manager-vault-selector__text");
        text.createDiv({ cls: "manager-vault-selector__title", text: t("共享库_管理库_标题") });
        text.createDiv({ cls: "manager-vault-selector__desc", text: t("共享库_管理库_说明") });
        const control = selector.createDiv("manager-vault-selector__control");
        const dropdown = new DropdownComponent(control);
        for (const vault of vaults) {
            const suffix = [
                this.getVaultRoleLabel(vault.role),
                vault.isCurrent ? t("共享库_当前库") : "",
            ].filter(Boolean).join(" · ");
            dropdown.addOption(vault.id, `${vault.name}${suffix ? ` · ${suffix}` : ""}`);
        }
        dropdown.setValue(selectedVault.id);
        dropdown.onChange((value) => {
            this.vaultExpandedId = value;
            this.renderContent();
        });
    }

    private renderVaultDetail(container: HTMLElement, vault: SharedVaultStatus, vaults: SharedVaultStatus[], plugins: SharedPluginCatalogItem[], themes: SharedThemeCatalogItem[]) {
        const t = (k: any) => this.manager.translator.t(k);
        const detail = container.createDiv("manager-vault-detail");
        this.renderVaultSelector(detail, vaults, vault);
        const header = detail.createDiv("manager-vault-detail__header");
        const title = header.createDiv("manager-vault-detail__title");
        const icon = title.createSpan({ cls: "manager-vault-detail__icon" });
        setIcon(icon, vault.role === "main" ? "crown" : "folder-cog");
        title.createSpan({ text: vault.name });
        header.createSpan({ cls: `manager-vault-detail__role is-${vault.role}`, text: this.getVaultRoleLabel(vault.role) });
        detail.createDiv({ cls: "manager-vault-detail__path", text: vault.path });

        if (!vault.exists) {
            this.renderVaultEmpty(detail, "folder-x", t("共享库_详情_路径失效标题"), t("共享库_详情_路径失效说明"));
            return;
        }

        const panels = detail.createDiv("manager-vault-detail__panels");
        this.renderVaultPluginManager(panels, vault, plugins);
        this.renderVaultThemeManager(panels, vault, themes);
    }

    private async showVaultSharePanel(renderGeneration = this.renderGeneration) {
        this.contentEl.empty();
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        const page = this.contentEl.createDiv("manager-vault-share");

        if (Platform.isMobileApp || !isSharedVaultFsAvailable()) {
            this.renderVaultEmpty(page, "monitor-x", t("共享库_桌面端限定_标题"), t("共享库_桌面端限定_说明"));
            return;
        }

        const [snapshot, plugins, themes] = await Promise.all([
            getSharedVaultSnapshot(this.manager),
            readSharedPluginCatalog(this.manager),
            readSharedThemeCatalog(this.manager),
        ]);
        if (!this.isRenderCurrent(renderGeneration, "vaults")) return;

        const currentVault = snapshot.vaults.find((vault) => vault.isCurrent) || snapshot.vaults[0];
        if (!this.vaultExpandedId || !snapshot.vaults.some((vault) => vault.id === this.vaultExpandedId)) {
            this.vaultExpandedId = currentVault?.id || "";
        }
        const selectedVault = snapshot.vaults.find((vault) => vault.id === this.vaultExpandedId) || currentVault;

        const summary = page.createDiv("manager-vault-summary");
        this.renderVaultMetric(summary, "crown", t("共享库_统计_主库"), snapshot.mainVaultPath ? snapshot.mainVaultPath : t("共享库_未设置"));
        this.renderVaultMetric(summary, "folder-kanban", t("共享库_统计_纳管库"), snapshot.vaults.length);
        this.renderVaultMetric(summary, "blocks", t("共享库_统计_共享插件"), plugins.length);
        this.renderVaultMetric(summary, "palette", t("共享库_统计_共享主题"), themes.length);

        if (snapshot.error) {
            this.renderVaultWarning(page, snapshot.error);
        }

        this.renderVaultSetupCard(page, snapshot.vaults.length, currentVault);

        const workspace = page.createDiv("manager-vault-workspace");
        const vaultListCard = workspace.createDiv("manager-vault-card");
        const listHeader = vaultListCard.createDiv("manager-vault-card__header");
        const listIcon = listHeader.createDiv("manager-vault-card__icon");
        setIcon(listIcon, "folder-kanban");
        const listTitle = listHeader.createDiv("manager-vault-card__title-group");
        listTitle.createDiv({ cls: "manager-vault-card__title", text: t("共享库_库列表_标题") });
        listTitle.createDiv({ cls: "manager-vault-card__desc", text: t("共享库_库列表_说明") });
        this.renderVaultList(vaultListCard, snapshot.vaults);

        if (selectedVault) {
            this.renderVaultDetail(workspace, selectedVault, snapshot.vaults, plugins, themes);
        }
    }

    private renderContent() {
        const renderGeneration = this.nextRenderGeneration();
        this.contentEl.empty();
        if (this.activePage === "ribbon") {
            void this.showRibbonPanel(renderGeneration);
        } else if (this.activePage === "hidden") {
            this.showHiddenPanel();
        } else if (this.activePage === "troubleshoot") {
            this.showTroubleshootPanel();
        } else if (this.activePage === "transfer") {
            void this.showTransferPanel(renderGeneration);
        } else if (this.activePage === "vaults") {
            void this.showVaultSharePanel(renderGeneration);
        } else if (this.activePage === "install" || this.activePage === "sources" || this.installMode) {
            this.showInstallPanel();
        } else {
            void this.showData(renderGeneration);
        }
    }

    private bindLongPressTooltip(el: HTMLElement | undefined, text?: string) {
        if (!el || !text) return;
        let timer: number | undefined;
        const show = () => { new Notice(text, 1500); };
        const clear = () => { if (timer) window.clearTimeout(timer); timer = undefined; };
        el.addEventListener("touchstart", () => {
            timer = window.setTimeout(show, 500);
        });
        el.addEventListener("touchend", clear);
        el.addEventListener("touchcancel", clear);
    }

    public async reloadShowData() {
        if (this.settings.DEBUG) console.log("[BPM] reloadShowData start, children before empty:", this.contentEl.children.length);
        const renderGeneration = this.nextRenderGeneration();
        const modalElement: HTMLElement = this.contentEl;
        const scrollTop = modalElement.scrollTop;
        modalElement.empty();
        if (this.activePage === "ribbon") {
            await this.showRibbonPanel(renderGeneration);
            if (!this.isRenderCurrent(renderGeneration, "ribbon")) return;
            modalElement.scrollTo(0, scrollTop);
        } else if (this.activePage === "hidden") {
            this.showHiddenPanel();
            modalElement.scrollTo(0, scrollTop);
        } else if (this.activePage === "troubleshoot") {
            this.showTroubleshootPanel();
            modalElement.scrollTo(0, scrollTop);
        } else if (this.activePage === "transfer") {
            await this.showTransferPanel(renderGeneration);
            if (!this.isRenderCurrent(renderGeneration, "transfer")) return;
            modalElement.scrollTo(0, scrollTop);
        } else if (this.activePage === "vaults") {
            await this.showVaultSharePanel(renderGeneration);
            if (!this.isRenderCurrent(renderGeneration, "vaults")) return;
            modalElement.scrollTo(0, scrollTop);
        } else if (this.activePage === "install" || this.activePage === "sources" || this.installMode) {
            this.showInstallPanel();
            modalElement.scrollTo(0, scrollTop);
        } else {
            await this.showData(renderGeneration);
            if (!this.isRenderCurrent(renderGeneration, "plugins")) return;
            modalElement.scrollTo(0, scrollTop);
        }
        if (this.settings.DEBUG) console.log("[BPM] reloadShowData end, children after render:", this.contentEl.children.length);
    }

    private async refreshFilterOptions(preserveScroll = false) {
        const scrollTop = preserveScroll ? this.contentEl.scrollTop : 0;
        // 重新计算并刷新分组/标签/延迟下拉的计数
        if (this.groupDropdown) {
            const currentGroup = this.groupDropdown.selectEl.value ?? (this.settings.PERSISTENCE ? this.settings.FILTER_GROUP : this.group);
            const groupCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const groupId = plugin.group || ""; acc[groupId] = (acc[groupId] || 0) + 1; return acc; }, { "": 0 });
            const groups = this.settings.GROUPS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${groupCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("筛选_全部_描述") });
            const current = this.settings.PERSISTENCE ? this.settings.FILTER_GROUP : currentGroup;
            this.resetDropdown(this.groupDropdown, groups, current);
        }
        if (this.tagDropdown) {
            const currentTag = this.tagDropdown.selectEl.value ?? (this.settings.PERSISTENCE ? this.settings.FILTER_TAG : this.tag);
            const tagCounts: { [key: string]: number } = this.settings.Plugins.reduce((acc, plugin) => { plugin.tags.forEach((tag) => { acc[tag] = (acc[tag] || 0) + 1; }); return acc; }, {} as { [key: string]: number });
            const tags = this.settings.TAGS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${tagCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("筛选_全部_描述") });
            const current = this.settings.PERSISTENCE ? this.settings.FILTER_TAG : currentTag;
            this.resetDropdown(this.tagDropdown, tags, current);
        }
        if (this.settings.DELAY && this.delayDropdown) {
            const currentDelay = this.delayDropdown.selectEl.value ?? (this.settings.PERSISTENCE ? this.settings.FILTER_DELAY : this.delay);
            const delayCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const delay = plugin.delay || ""; acc[delay] = (acc[delay] || 0) + 1; return acc; }, { "": 0 });
            const delays = this.settings.DELAYS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} (${delayCounts[item.id] || 0})`; return acc; }, { "": this.manager.translator.t("筛选_全部_描述") });
            const current = this.settings.PERSISTENCE ? this.settings.FILTER_DELAY : currentDelay;
            this.resetDropdown(this.delayDropdown, delays, current);
        }
        await this.reloadShowData();
        if (preserveScroll) this.contentEl.scrollTo({ top: scrollTop });
    }

    private resetDropdown(dropdown: DropdownComponent, options: Record<string, string>, value: string) {
        dropdown.selectEl.empty();
        dropdown.addOptions(options);
        dropdown.setValue(options[value] ? value : Object.keys(options)[0] || "");
    }

    public async onOpen() {
        await this.showHead();
        await this.showData();
        this.searchEl.inputEl.focus();
        this.applyEditingStyle();
        // [功能] ctrl+f聚焦
        document.addEventListener("keydown", (event) => {
            if (event.ctrlKey && event.key.toLowerCase() === "f") {
                if (this.searchEl.inputEl) {
                    this.searchEl.inputEl.focus();
                }
            }
        });
    }

    public async onClose() {
        this.contentEl.empty();
        if (this.manager.ribbonModal === this.ribbonPage) this.manager.ribbonModal = null;
        if (this.modalContainer) this.modalContainer.removeClass("manager-container--editing");
    }

    private applyEditingStyle() {
        if (!this.modalContainer) return;
        if (this.editorMode) {
            this.modalContainer.addClass("manager-container--editing");
        } else {
            this.modalContainer.removeClass("manager-container--editing");
        }
    }
}
