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
    ToggleComponent,
    Platform,
} from "obsidian";

import { BPM_IGNORE_TAG, ManagerPlugin } from "../data/types";
import { ManagerSettings } from "../settings/data";
import { managerOpen } from "../utils";

import Manager from "main";
import { GroupModal } from "./group-modal";
import { TagsModal } from "./tags-modal";
import { DeleteModal } from "./delete-modal";
import Commands from "src/command";
import { DisableModal } from "./disable-modal";
import { NoteModal } from "./note-modal";
import { ShareModal } from "./share-modal";
import { HideModal } from "./hide-modal";
import { ShareTModal } from "./share-t-modal";
import { TroubleshootModal } from "../troubleshoot/troubleshoot-modal";
import { installPluginFromGithub, installThemeFromGithub, fetchReleaseVersions, ReleaseVersion } from "../github-install";
import { BPM_TAG_ID } from "src/repo-resolver";
import { normalizePath } from "obsidian";
import { UpdateModal } from "./update-modal";
import { RibbonModal } from "./ribbon-modal";



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
    installType: "plugin" | "theme" = "plugin";
    installRepo = "";
    installVersion = "";
    installVersions: ReleaseVersion[] = [];
    searchBarEl?: HTMLElement;
    groupDropdown?: DropdownComponent;
    tagDropdown?: DropdownComponent;
    delayDropdown?: DropdownComponent;
    actionCollapsed = false;
    filterCollapsed = false;
    private reloadingManifests = false;
    private mobileFiltersCollapsed = true;

    private showInlineProgress(text: string, subText?: string) {
        const notice = new Notice("", 0);
        notice.noticeEl.empty();
        const wrap = document.createElement("div");
        wrap.addClass("bpm-update-progress");
        const title = document.createElement("div");
        title.setText(text);
        const sub = document.createElement("div");
        sub.addClass("bpm-update-progress__sub");
        if (subText) sub.setText(subText);
        const bar = document.createElement("div");
        bar.addClass("bpm-progress");
        const fill = document.createElement("div");
        fill.addClass("bpm-progress__bar");
        fill.style.width = "0%";
        bar.appendChild(fill);
        wrap.appendChild(title);
        wrap.appendChild(sub);
        wrap.appendChild(bar);
        notice.noticeEl.appendChild(wrap);
        return {
            update: (processed: number, total = 1, current?: string) => {
                const ratio = total > 0 ? Math.min(1, processed / total) : 0;
                fill.style.width = `${ratio * 100}%`;
                sub.setText(`${processed}/${total}${current ? ` · ${current}` : ""}`);
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

    constructor(app: App, manager: Manager) {
        super(app);
        // @ts-ignore 
        this.appSetting = this.app.setting;
        // @ts-ignore
        this.appPlugins = this.app.plugins;
        this.manager = manager;
        this.settings = manager.settings;
        this.basePath = normalizePath(`${this.app.vault.configDir}`);
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
        //@ts-ignore
        const modalEl: HTMLElement = this.contentEl.parentElement;
        this.modalContainer = modalEl;
        modalEl.addClass("manager-container");
        if (Platform.isMobileApp) modalEl.addClass("manager-container--mobile");
        // 靠上
        if (!this.settings.CENTER && !Platform.isMobileApp) modalEl.addClass("manager-container__top");
        if (this.editorMode) modalEl.addClass("manager-container--editing");

        modalEl.removeChild(modalEl.getElementsByClassName("modal-close-button")[0]);
        this.titleEl.parentElement?.addClass("manager-container__header");
        this.contentEl.addClass("manager-item-container");
        // 添加页尾
        this.footEl = document.createElement("div");
        this.footEl.addClass("manager-food");
        this.modalEl.appendChild(this.footEl);


        if (Platform.isMobileApp) {
            this.showHeadMobile();
            return;
        }

        // [操作行]
        const actionWrapper = this.titleEl.createDiv("manager-section manager-section--actions");
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
        const actionBar = new Setting(actionContent).setClass("manager-bar__action").setName("");

        // [操作行] Github
        const githubButton = new ButtonComponent(actionBar.controlEl);
        githubButton.setIcon("github");
        githubButton.setTooltip(this.manager.translator.t("管理器_GITHUB_描述"));
        this.bindLongPressTooltip(githubButton.buttonEl, this.manager.translator.t("管理器_GITHUB_描述"));
        githubButton.onClick(() => { window.open("https://github.com/zenozero-dev/obsidian-manager"); });
        // [操作行] Github
        const tutorialButton = new ButtonComponent(actionBar.controlEl);
        tutorialButton.setIcon("book-open");
        tutorialButton.setTooltip(this.manager.translator.t("管理器_视频教程_描述"));
        this.bindLongPressTooltip(tutorialButton.buttonEl, this.manager.translator.t("管理器_视频教程_描述"));
        tutorialButton.onClick(() => { window.open("https://www.bilibili.com/video/BV1WyrkYMEce/"); });

        // [操作行] 检查更新
        const updateButton = new ButtonComponent(actionBar.controlEl);
        updateButton.setIcon("rss");
        updateButton.setTooltip(this.manager.translator.t("管理器_检查更新_描述"));
        this.bindLongPressTooltip(updateButton.buttonEl, this.manager.translator.t("管理器_检查更新_描述"));
        updateButton.onClick(async () => {
            updateButton.setDisabled(true);
            try {
                await this.manager.checkUpdatesWithNotice();
                const count = Object.values(this.manager.updateStatus || {}).filter(s => s.hasUpdate).length;
                new Notice(`检查完成，发现 ${count} 个插件有可用更新`);
                this.reloadShowData();
            } catch (error) {
                console.error("检查更新时出错:", error);
                new Notice("检查更新失败，请稍后重试");
            } finally {
                updateButton.setDisabled(false);
            }
        });

        // [操作行] 插件分享
        // const shareButton = new ButtonComponent(actionBar.controlEl);
        // shareButton.setIcon("external-link");
        // // shareButton.setTooltip(this.manager.translator.t("管理器_插件分享_描述"));
        // shareButton.onClick(async () => {
        //     new ShareTModal(this.app, this.manager, (type: string, url?: string) => {
        //         if (type == 'import') {
        //             const plugins = this.displayPlugins.map(plugin => ({
        //                 id: plugin.id,
        //                 name: plugin.name,
        //                 version: plugin.version,
        //                 author: plugin.author,
        //                 description: plugin.description,
        //                 enabled: this.appPlugins.enabledPlugins.has(plugin.id),
        //                 export: true,
        //             }));

        //             // 添加管理器自身信息
        //             plugins.push({
        //                 id: this.manager.manifest.id,
        //                 name: this.manager.manifest.name,
        //                 version: this.manager.manifest.version,
        //                 author: this.manager.manifest.author,
        //                 description: this.manager.manifest.description,
        //                 enabled: this.appPlugins.enabledPlugins.has(this.manager.manifest.id),
        //                 export: true,
        //             });

        //             console.log("当前插件详细信息:", plugins);

        //             // new ShareModal(this.app, this.manager, plugins).open();
        //         }
        //     }).open();
        // new Notice('功能未完成，敬请期待！');
        // })

        // [操作行] Ribbon 管理
        const ribbonButton = new ButtonComponent(actionBar.controlEl);
        ribbonButton.setIcon("grip-vertical");
        ribbonButton.setTooltip(this.manager.translator.t("管理器_Ribbon管理_描述"));
        this.bindLongPressTooltip(ribbonButton.buttonEl, this.manager.translator.t("管理器_Ribbon管理_描述"));
        ribbonButton.onClick(() => {
            new RibbonModal(this.app, this.manager).open();
        });

        // [操作行] 插件隐藏
        const hideButton = new ButtonComponent(actionBar.controlEl);
        hideButton.setIcon("eye-off");
        const hideTooltip = this.manager.translator.t("菜单_隐藏插件_标题");
        hideButton.setTooltip(hideTooltip);
        this.bindLongPressTooltip(hideButton.buttonEl, hideTooltip);
        hideButton.onClick(async () => {
            const all = Object.values(this.appPlugins.manifests) as PluginManifest[];
            const plugins: PluginManifest[] = all.filter((pm) => pm.id !== this.manager.manifest.id);
            plugins.sort((item1, item2) => { return item1.name.localeCompare(item2.name); });
            new HideModal(this.app, this.manager, this, plugins).open();
        })

        // [操作行] 重载插件
        const reloadButton = new ButtonComponent(actionBar.controlEl);
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

        // [操作行] 一键禁用
        const disableButton = new ButtonComponent(actionBar.controlEl);
        disableButton.setIcon("square");
        disableButton.setTooltip(this.manager.translator.t("管理器_一键禁用_描述"));
        this.bindLongPressTooltip(disableButton.buttonEl, this.manager.translator.t("管理器_一键禁用_描述"));
        disableButton.onClick(async () => {
            new DisableModal(this.app, this.manager, async () => {
                for (const plugin of this.displayPlugins) {
                    if (plugin.id === this.manager.manifest.id) continue;
                    if (this.settings.DELAY) {
                        const ManagerPlugin = this.settings.Plugins.find((p) => p.id === plugin.id);
                        if (ManagerPlugin && ManagerPlugin.enabled) {
                            await this.appPlugins.disablePlugin(plugin.id);
                            ManagerPlugin.enabled = false;
                            await this.manager.savePluginAndExport(plugin.id);
                            this.reloadShowData();
                        }
                    } else {
                        if (this.appPlugins.enabledPlugins.has(plugin.id)) {
                            const ManagerPlugin = this.settings.Plugins.find((p) => p.id === plugin.id);
                            if (ManagerPlugin) ManagerPlugin.enabled = false;
                            await this.appPlugins.disablePluginAndSave(plugin.id);
                            await this.manager.savePluginAndExport(plugin.id);
                            this.reloadShowData();
                        }
                    }
                    Commands(this.app, this.manager);
                }
            }).open();
        });

        // [操作行] 一键启用
        const enableButton = new ButtonComponent(actionBar.controlEl);
        enableButton.setIcon("square-check");
        enableButton.setTooltip(this.manager.translator.t("管理器_一键启用_描述"));
        this.bindLongPressTooltip(enableButton.buttonEl, this.manager.translator.t("管理器_一键启用_描述"));
        enableButton.onClick(async () => {
            new DisableModal(this.app, this.manager, async () => {
                for (const plugin of this.displayPlugins) {
                    if (plugin.id === this.manager.manifest.id) continue;
                    if (this.settings.DELAY) {
                        const ManagerPlugin = this.manager.settings.Plugins.find((mp) => mp.id === plugin.id);
                        if (ManagerPlugin && !ManagerPlugin.enabled) {
                            await this.appPlugins.enablePlugin(plugin.id);
                            ManagerPlugin.enabled = true;
                            await this.manager.savePluginAndExport(plugin.id);
                            this.reloadShowData();
                        }
                    } else {
                        if (!this.appPlugins.enabledPlugins.has(plugin.id)) {
                            const ManagerPlugin = this.manager.settings.Plugins.find((mp) => mp.id === plugin.id);
                            if (ManagerPlugin) ManagerPlugin.enabled = true;
                            await this.appPlugins.enablePluginAndSave(plugin.id);
                            await this.manager.savePluginAndExport(plugin.id);
                            this.reloadShowData();
                        }
                    }
                    Commands(this.app, this.manager);
                }
            }).open();
        });

        // [操作行] 排查冲突
        const troubleshootButton = new ButtonComponent(actionBar.controlEl);
        troubleshootButton.setIcon("search");
        troubleshootButton.setTooltip(this.manager.translator.t("排查_按钮_描述"));
        this.bindLongPressTooltip(troubleshootButton.buttonEl, this.manager.translator.t("排查_按钮_描述"));
        troubleshootButton.onClick(() => {
            new TroubleshootModal(this.app, this.manager).open();
        });

        // [操作行] 编辑模式
        const editorButton = new ButtonComponent(actionBar.controlEl);
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

        // [操作行] 插件设置
        const settingsButton = new ButtonComponent(actionBar.controlEl);
        settingsButton.setIcon("settings");
        settingsButton.setTooltip(this.manager.translator.t("管理器_插件设置_描述"));
        this.bindLongPressTooltip(settingsButton.buttonEl, this.manager.translator.t("管理器_插件设置_描述"));
        settingsButton.onClick(() => {
            this.appSetting.open();
            this.appSetting.openTabById(this.manager.manifest.id);
            // this.close();
        });

        // [操作行] 插件/主题安装模式
        const installToggle = new ButtonComponent(actionBar.controlEl);
        installToggle.setIcon("download");
        const installTooltip = this.manager.translator.t("管理器_安装_GITHUB_描述");
        installToggle.setTooltip(installTooltip);
        this.bindLongPressTooltip(installToggle.buttonEl, installTooltip);
        installToggle.onClick(() => {
            this.installMode = !this.installMode;
            installToggle.setIcon(this.installMode ? "arrow-left" : "download");
            if (this.searchBarEl) {
                this.installMode ? this.searchBarEl.addClass("manager-display-none") : this.searchBarEl.removeClass("manager-display-none");
            }
            this.renderContent();
        });


        // [测试行] 刷新插件
        if (this.developerMode) {
            const testButton = new ButtonComponent(actionBar.controlEl);
            testButton.setIcon("refresh-ccw");
            testButton.setTooltip("刷新插件");
            testButton.onClick(async () => {
                this.close();
                await this.appPlugins.disablePlugin(this.manager.manifest.id);
                await this.appPlugins.enablePlugin(this.manager.manifest.id);
            });
        }

        // [测试行] 测试插件
        if (this.developerMode) {
            const testButton = new ButtonComponent(actionBar.controlEl);
            testButton.setIcon("test-tube");
            testButton.setTooltip("测试插件");
            testButton.onClick(async () => {
                // 获取当前页面所有的插件ID 然后将其转换为列表
            });
        }

        // [过滤行]
        const filterWrapper = this.titleEl.createDiv("manager-section manager-section--filters");
        const filterContent = filterWrapper.createDiv("manager-section__content");
        filterContent.addClass("manager-section__content--filters");

        const searchBar = new Setting(filterContent).setClass("manager-bar__search").setName("");
        this.searchBarEl = searchBar.settingEl;

        const filterOptions = {
            "all": this.manager.translator.t("筛选_状态_全部"),
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
        const filterDropdown = new DropdownComponent(searchBar.controlEl);
        filterDropdown.addOptions(filterOptions);
        filterDropdown.setValue(this.filter || "all");
        filterDropdown.onChange((value) => {
            this.filter = value;
            this.reloadShowData();
        });


        // [过滤行] 分组选择列表
        const groupCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const groupId = plugin.group || ""; acc[groupId] = (acc[groupId] || 0) + 1; return acc; }, { "": 0 });
        const groups = this.settings.GROUPS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${groupCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("筛选_分组_全部") });
        this.groupDropdown = new DropdownComponent(searchBar.controlEl);
        this.groupDropdown.addOptions(groups);
        this.groupDropdown.setValue(this.settings.PERSISTENCE ? this.settings.FILTER_GROUP : this.group);
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
        const tags = this.settings.TAGS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${tagCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("筛选_标签_全部") });
        this.tagDropdown = new DropdownComponent(searchBar.controlEl);
        this.tagDropdown.addOptions(tags);
        this.tagDropdown.setValue(this.settings.PERSISTENCE ? this.settings.FILTER_TAG : this.tag);
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
            const delays = this.settings.DELAYS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} (${item.time}s) [${delayCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("筛选_延迟_全部") });
            this.delayDropdown = new DropdownComponent(searchBar.controlEl);
            this.delayDropdown.addOptions(delays);
            this.delayDropdown.setValue(this.settings.PERSISTENCE ? this.settings.FILTER_DELAY : this.delay);
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
        this.searchEl = new SearchComponent(searchBar.controlEl);
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
            if (this.searchBarEl) {
                this.installMode ? this.searchBarEl.addClass("manager-display-none") : this.searchBarEl.removeClass("manager-display-none");
            }
            this.renderContent();
            this.showHeadMobile();
        });

        // 检查更新按钮
        const updateBtn = new ButtonComponent(topActions);
        updateBtn.setIcon("rss");
        updateBtn.setTooltip(t("管理器_检查更新_描述"));
        this.bindLongPressTooltip(updateBtn.buttonEl, t("管理器_检查更新_描述"));
        updateBtn.onClick(async () => {
            await this.manager.checkUpdatesWithNotice();
            await this.reloadShowData();
        });

        // 更多操作菜单
        const moreBtn = new ButtonComponent(topActions);
        moreBtn.setIcon("more-vertical");
        moreBtn.setTooltip(t("管理器_更多操作_描述"));
        this.bindLongPressTooltip(moreBtn.buttonEl, t("管理器_更多操作_描述"));
        moreBtn.buttonEl.addEventListener("click", (ev) => {
            const menu = new Menu();
            // 一键禁用
            menu.addItem((item) => item.setTitle(t("管理器_一键禁用_描述")).setIcon("square").onClick(async () => {
                new DisableModal(this.app, this.manager, async () => {
                    for (const plugin of this.displayPlugins) {
                        if (plugin.id === this.manager.manifest.id) continue;
                        if (this.settings.DELAY) {
                            const ManagerPlugin = this.settings.Plugins.find((p) => p.id === plugin.id);
                            if (ManagerPlugin && ManagerPlugin.enabled) {
                                await this.appPlugins.disablePlugin(plugin.id);
                                ManagerPlugin.enabled = false;
                                await this.manager.savePluginAndExport(plugin.id);
                            }
                        } else {
                            if (this.appPlugins.enabledPlugins.has(plugin.id)) {
                                const ManagerPlugin = this.settings.Plugins.find((p) => p.id === plugin.id);
                                if (ManagerPlugin) ManagerPlugin.enabled = false;
                                await this.appPlugins.disablePluginAndSave(plugin.id);
                                await this.manager.savePluginAndExport(plugin.id);
                            }
                        }
                        Commands(this.app, this.manager);
                    }
                    this.reloadShowData();
                }).open();
            }));
            // 一键启用
            menu.addItem((item) => item.setTitle(t("管理器_一键启用_描述")).setIcon("square-check").onClick(async () => {
                new DisableModal(this.app, this.manager, async () => {
                    for (const plugin of this.displayPlugins) {
                        if (plugin.id === this.manager.manifest.id) continue;
                        if (this.settings.DELAY) {
                            const ManagerPlugin = this.manager.settings.Plugins.find((mp) => mp.id === plugin.id);
                            if (ManagerPlugin && !ManagerPlugin.enabled) {
                                await this.appPlugins.enablePlugin(plugin.id);
                                ManagerPlugin.enabled = true;
                                await this.manager.savePluginAndExport(plugin.id);
                            }
                        } else {
                            if (!this.appPlugins.enabledPlugins.has(plugin.id)) {
                                const ManagerPlugin = this.manager.settings.Plugins.find((mp) => mp.id === plugin.id);
                                if (ManagerPlugin) ManagerPlugin.enabled = true;
                                await this.appPlugins.enablePluginAndSave(plugin.id);
                                await this.manager.savePluginAndExport(plugin.id);
                            }
                        }
                        Commands(this.app, this.manager);
                    }
                    this.reloadShowData();
                }).open();
            }));
            menu.addSeparator();
            // 重载插件
            menu.addItem((item) => item.setTitle(t("管理器_重载插件_描述")).setIcon("refresh-ccw").onClick(async () => {
                await this.appPlugins.loadManifests();
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
            menu.showAtMouseEvent(ev as MouseEvent);
        });

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
        const statusSetting = new Setting(filterPanel).setName(t("筛选_状态_全部"));
        statusSetting.addDropdown((dd) => {
            dd.addOptions({
                "all": t("筛选_状态_全部"),
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
        const groups = this.settings.GROUPS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${groupCounts[item.id] || 0}]`; return acc; }, { "": t("筛选_分组_全部") });
        const groupSetting = new Setting(filterPanel).setName(t("筛选_分组_全部"));
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
        const tags = this.settings.TAGS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${tagCounts[item.id] || 0}]`; return acc; }, { "": t("筛选_标签_全部") });
        const tagSetting = new Setting(filterPanel).setName(t("筛选_标签_全部"));
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
            const delays = this.settings.DELAYS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} (${delayCounts[item.id] || 0})`; return acc; }, { "": t("筛选_延迟_全部") });
            const delaySetting = new Setting(filterPanel).setName(t("筛选_延迟_全部"));
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
            btn.addClass("bpm-mobile-footer__btn");
            setIcon(btn, icon);
            const labelEl = document.createElement("span");
            labelEl.addClass("bpm-mobile-footer__btn-label");
            labelEl.setText(label);
            btn.appendChild(labelEl);
            btn.addEventListener("click", onClick);
            this.bindLongPressTooltip(btn, label);
            return btn;
        };

        // 一键禁用按钮
        const disableBtn = createFooterBtn("square", t("管理器_一键禁用_描述"), async () => {
            new DisableModal(this.app, this.manager, async () => {
                for (const plugin of this.displayPlugins) {
                    if (plugin.id === this.manager.manifest.id) continue;
                    if (this.settings.DELAY) {
                        const ManagerPlugin = this.settings.Plugins.find((p) => p.id === plugin.id);
                        if (ManagerPlugin && ManagerPlugin.enabled) {
                            await this.appPlugins.disablePlugin(plugin.id);
                            ManagerPlugin.enabled = false;
                            await this.manager.savePluginAndExport(plugin.id);
                        }
                    } else {
                        if (this.appPlugins.enabledPlugins.has(plugin.id)) {
                            const ManagerPlugin = this.settings.Plugins.find((p) => p.id === plugin.id);
                            if (ManagerPlugin) ManagerPlugin.enabled = false;
                            await this.appPlugins.disablePluginAndSave(plugin.id);
                            await this.manager.savePluginAndExport(plugin.id);
                        }
                    }
                    Commands(this.app, this.manager);
                }
                this.reloadShowData();
            }).open();
        });
        footer.appendChild(disableBtn);

        // 一键启用按钮
        const enableBtn = createFooterBtn("square-check", t("管理器_一键启用_描述"), async () => {
            new DisableModal(this.app, this.manager, async () => {
                for (const plugin of this.displayPlugins) {
                    if (plugin.id === this.manager.manifest.id) continue;
                    if (this.settings.DELAY) {
                        const ManagerPlugin = this.manager.settings.Plugins.find((mp) => mp.id === plugin.id);
                        if (ManagerPlugin && !ManagerPlugin.enabled) {
                            await this.appPlugins.enablePlugin(plugin.id);
                            ManagerPlugin.enabled = true;
                            await this.manager.savePluginAndExport(plugin.id);
                        }
                    } else {
                        if (!this.appPlugins.enabledPlugins.has(plugin.id)) {
                            const ManagerPlugin = this.manager.settings.Plugins.find((mp) => mp.id === plugin.id);
                            if (ManagerPlugin) ManagerPlugin.enabled = true;
                            await this.appPlugins.enablePluginAndSave(plugin.id);
                            await this.manager.savePluginAndExport(plugin.id);
                        }
                    }
                    Commands(this.app, this.manager);
                }
                this.reloadShowData();
            }).open();
        });
        footer.appendChild(enableBtn);

        // 检查更新按钮
        const updateBtn = createFooterBtn("rss", t("管理器_检查更新_描述"), async () => {
            await this.manager.checkUpdatesWithNotice();
            await this.reloadShowData();
        });
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
            menu.showAtMouseEvent(ev as MouseEvent);
        });
        footer.appendChild(moreBtn);

        this.modalEl.appendChild(footer);
    }

    public async showData() {
        // 使用 manifests 按 id 去重，防止重复渲染
        const manifestMap = this.appPlugins.manifests;
        if (this.settings.DEBUG) console.log("[BPM] render showData manifests size:", Object.keys(manifestMap).length);
        const uniqMap = new Map<string, PluginManifest>();
        Object.values(manifestMap).forEach((mf: PluginManifest) => {
            uniqMap.set(mf.id, mf);
        });
        const uniquePlugins = Array.from(uniqMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        if (this.settings.DEBUG) console.log("[BPM] render showData uniquePlugins:", uniquePlugins.map(p => p.id).join(","));

        if (this.settings.DEBUG) console.log("[BPM] render showData before loop, children:", this.contentEl.children.length);
        this.displayPlugins = [];
        const renderedIds = new Set<string>();
        for (const plugin of uniquePlugins) {
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

            const itemEl = new Setting(this.contentEl);
            itemEl.settingEl.setAttr("data-plugin-id", plugin.id);
            itemEl.setClass("manager-item");
            itemEl.nameEl.addClass("manager-item__name-container");
            itemEl.descEl.addClass("manager-item__description-container");
            itemEl.controlEl.addClass("manager-item__controls");

            // [右键操作]
            itemEl.settingEl.addEventListener("contextmenu", (event) => {
                event.preventDefault(); // 阻止默认的右键菜单
                const menu = new Menu();
                // 第一组：插件信息类
                menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_检查更新_标题"))
                        .setIcon("rss")
                        .onClick(async () => {
                            await this.manager.checkUpdateForPlugin(plugin.id);
                            await this.reloadShowData();
                        })
                );
                menu.addSeparator(); // 分隔符
                // 第二组：插件管理类
                // [菜单] 单次启动
                if (!this.settings.DELAY) menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_单次启动_描述"))
                        .setIcon("repeat-1")
                        .setDisabled(isSelf || isEnabled)
                        .onClick(async () => {
                            new Notice(this.manager.translator.t("管理器_单次启动中_提示"));
                            await this.appPlugins.enablePlugin(plugin.id);
                            await this.reloadShowData();

                        })
                );
                // [菜单] 重启插件
                if (!this.settings.DELAY) menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_重启插件_描述"))
                        .setIcon("refresh-ccw")
                        .setDisabled(isSelf || !isEnabled)
                        .onClick(async () => {
                            new Notice(this.manager.translator.t("管理器_重启中_提示"));
                            await this.appPlugins.disablePluginAndSave(plugin.id);
                            await this.appPlugins.enablePluginAndSave(plugin.id);
                            await this.reloadShowData();
                        })
                );
                // [菜单] 隐藏插件
                menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_隐藏插件_标题"))
                        .setIcon("eye-off")
                        .setDisabled(isSelf)
                        .onClick(() => {
                            if (isSelf) return;
                            const isHidden = this.settings.HIDES.includes(plugin.id);
                            if (isHidden) {
                                this.settings.HIDES = this.settings.HIDES.filter(id => id !== plugin.id);
                            } else {
                                this.settings.HIDES.push(plugin.id);
                            }
                            this.manager.saveSettings();
                            this.reloadShowData();
                        })
                );
                // [菜单] 分享插件
                // menu.addItem((item) =>
                //     item.setTitle("分享插件_标题")
                //         .setIcon("share-2")
                //         .onClick(() => {
                //             const plugins: PluginManifest[] = Object.values(this.appPlugins.manifests);
                //             plugins.sort((item1, item2) => { return item1.name.localeCompare(item2.name); });
                //         })
                // );

                menu.addSeparator(); // 分隔符
                // 第三组：插件设置类
                // [菜单] 插件笔记
                menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_笔记_标题")).setIcon("notebook-pen").onClick(() => { new NoteModal(this.app, this.manager, ManagerPlugin, this).open(); })
                );
                // [菜单] 快捷键
                menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_快捷键_标题")).setIcon("circle-plus").onClick(async () => {
                        await this.appSetting.open();
                        await this.appSetting.openTabById("hotkeys");
                        const tab = await this.appSetting.activeTab;
                        tab.searchComponent.inputEl.value = plugin.id;
                        tab.updateHotkeyVisibility();
                        tab.searchComponent.inputEl.blur();
                    })
                );
                // [菜单] 复制ID
                menu.addItem((item) =>
                    item.setTitle(this.manager.translator.t("菜单_复制ID_标题"))
                        .setIcon("copy")
                        .onClick(() => {
                            navigator.clipboard.writeText(plugin.id);
                            new Notice(this.manager.translator.t("通知_ID已复制"));
                        })
                );
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
                if (!this.editorMode && !Platform.isMobileApp) {
                    const downloadBtn = new ExtraButtonComponent(itemEl.controlEl);
                    downloadBtn.setIcon("download");
                    downloadBtn.setTooltip(this.manager.translator.t("管理器_下载更新_描述"));
                    downloadBtn.onClick(() => {
                        const versions = updateInfo.versions && updateInfo.versions.length > 0
                            ? updateInfo.versions
                            : [{ version: updateInfo.remoteVersion!, prerelease: false }];
                        new UpdateModal(this.app, this.manager, plugin.id, versions, updateInfo.remoteVersion, updateInfo.repo || undefined).open();
                    });
                }
            }
            itemEl.nameEl.appendChild(versionWrap);

            // [默认] 笔记图标
            if (ManagerPlugin.note?.length > 0) {
                const note = createSpan();
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
            const desc = createDiv({ text: ManagerPlugin.desc, title: plugin.description, cls: ["manager-item__name-desc"], });

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
            itemEl.descEl.appendChild(tags);
            ManagerPlugin.tags.map((id: string) => {
                const item = this.settings.TAGS.find((item) => item.id === id);
                if (item) {
                    if (item.id === BPM_TAG_ID && this.settings.HIDE_BPM_TAG) {
                        // skip render
                    } else {
                        const tag = this.manager.createTag(item.name, item.color, this.settings.TAG_STYLE);
                        if (this.editorMode && item.id !== BPM_TAG_ID) tag.onclick = () => { new TagsModal(this.app, this.manager, this, ManagerPlugin).open(); };
                        tags.appendChild(tag);
                    }
                }
            });

            // [编辑] 标签组
            if (this.editorMode) {
                const tag = this.manager.createTag("+", "", "");
                tag.onclick = () => { new TagsModal(this.app, this.manager, this, ManagerPlugin).open(); };
                tags.appendChild(tag);
            }

            if (!this.editorMode) {
                const isMobile = Platform.isMobileApp;

                let openPluginSetting: ExtraButtonComponent | null = null;
                let openPluginSettingEl: HTMLElement | undefined;

                if (isMobile) {
                    const moreButton = new ExtraButtonComponent(itemEl.controlEl);
                    moreButton.setIcon("more-vertical");
                    moreButton.setTooltip(this.manager.translator.t("管理器_更多操作_描述"));
                    const moreEl = ((moreButton as any).extraSettingsEl || (moreButton as any).buttonEl) as HTMLElement | undefined;
                    this.bindLongPressTooltip(moreEl, this.manager.translator.t("管理器_更多操作_描述"));
                    moreEl?.addEventListener("click", (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const menu = new Menu();
                        menu.addItem((item) => item
                            .setTitle(this.manager.translator.t("管理器_检查更新_描述"))
                            .setIcon("rss")
                            .onClick(async () => {
                                await this.manager.checkUpdateForPlugin(plugin.id);
                                await this.reloadShowData();
                            }));
                        if (updateInfo?.hasUpdate && updateInfo.remoteVersion) {
                            menu.addItem((item) => item
                                .setTitle(this.manager.translator.t("管理器_下载更新_描述"))
                                .setIcon("download")
                                .onClick(() => {
                                    const versions = updateInfo.versions && updateInfo.versions.length > 0
                                        ? updateInfo.versions
                                        : [{ version: updateInfo.remoteVersion!, prerelease: false }];
                                    new UpdateModal(this.app, this.manager, plugin.id, versions, updateInfo.remoteVersion, updateInfo.repo || undefined).open();
                                }));
                        }
                        menu.addSeparator();
                        menu.addItem((item) => item
                            .setTitle(this.manager.translator.t("管理器_打开设置_描述"))
                            .setIcon("settings")
                            .setDisabled(!isEnabled)
                            .onClick(() => {
                                this.appSetting.open();
                                this.appSetting.openTabById(plugin.id);
                            }));
                        menu.addItem((item) => item
                            .setTitle(this.manager.translator.t("管理器_打开目录_描述"))
                            .setIcon("folder-open")
                            .onClick(() => {
                                managerOpen(pluginDir, this.manager);
                            }));
                        menu.addItem((item) => item
                            .setTitle(this.manager.translator.t("管理器_打开仓库_标题"))
                            .setIcon("github")
                            .onClick(async () => {
                                const repo = await this.manager.repoResolver.resolveRepo(plugin.id);
                                if (repo) {
                                    window.open(`https://github.com/${repo}`);
                                } else {
                                    const isBpmInstall = this.manager.settings.BPM_INSTALLED.includes(plugin.id);
                                    new Notice(isBpmInstall
                                        ? this.manager.translator.t("管理器_仓库未记录_提示")
                                        : this.manager.translator.t("管理器_仓库需手动添加_提示"));
                                }
                            }));
                        menu.addSeparator();
                        menu.addItem((item) => item
                            .setTitle(this.manager.translator.t("管理器_删除插件_描述"))
                            .setIcon("trash")
                            .setDisabled(isSelf)
                            .onClick(async () => {
                                if (isSelf) return;
                                new DeleteModal(this.app, this.manager, async () => {
                                    await this.appPlugins.uninstallPlugin(plugin.id);
                                    await this.appPlugins.loadManifests();
                                    this.reloadShowData();
                                    Commands(this.app, this.manager);
                                    this.manager.synchronizePlugins(Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manager.manifest.id) as PluginManifest[]);
                                    new Notice(this.manager.translator.t("卸载_通知_一"));
                                }).open();
                            }));
                        menu.showAtMouseEvent(event as MouseEvent);
                    });
                } else {
                    // [按钮] 打开仓库
                    const openRepoButton = new ExtraButtonComponent(itemEl.controlEl);
                    openRepoButton.setIcon("github");
                    openRepoButton.setTooltip(this.manager.translator.t("管理器_仓库检测中_提示"));
                    openRepoButton.setDisabled(true);
                    const repo = await this.manager.repoResolver.resolveRepo(plugin.id);
                    if (repo) {
                        openRepoButton.setTooltip(this.manager.translator.t("管理器_打开仓库_提示").replace("{repo}", repo));
                        openRepoButton.setDisabled(false);
                        openRepoButton.onClick(() => window.open(`https://github.com/${repo}`));
                    } else {
                        const isBpmInstall = this.manager.settings.BPM_INSTALLED.includes(plugin.id);
                        openRepoButton.setTooltip(isBpmInstall
                            ? this.manager.translator.t("管理器_仓库未记录_提示")
                            : this.manager.translator.t("管理器_仓库需手动添加_提示"));
                    }

                    // [按钮] 打开设置
                    openPluginSetting = new ExtraButtonComponent(itemEl.controlEl);
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

                    // [按钮] 打开目录
                    const openPluginDirButton = new ExtraButtonComponent(itemEl.controlEl);
                    openPluginDirButton.setIcon("folder-open");
                    openPluginDirButton.setTooltip(this.manager.translator.t("管理器_打开目录_描述"));
                    openPluginDirButton.onClick(() => {
                        openPluginDirButton.setDisabled(true);
                        managerOpen(pluginDir, this.manager);
                        openPluginDirButton.setDisabled(false);
                    });

                    // [按钮] 删除插件
                    const deletePluginButton = new ExtraButtonComponent(itemEl.controlEl);
                    deletePluginButton.setIcon("trash");
                    deletePluginButton.setTooltip(this.manager.translator.t("管理器_删除插件_描述"));
                    if (isSelf) deletePluginButton.setDisabled(true);
                    deletePluginButton.onClick(async () => {
                        if (isSelf) return;
                        new DeleteModal(this.app, this.manager, async () => {
                            await this.appPlugins.uninstallPlugin(plugin.id);
                            await this.appPlugins.loadManifests();
                            this.reloadShowData();
                            // 刷新命令行
                            Commands(this.app, this.manager);
                            // 删除同理
                            this.manager.synchronizePlugins(Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manager.manifest.id) as PluginManifest[]);
                            new Notice(this.manager.translator.t("卸载_通知_一"));
                        }).open();
                    });
                }

                // [按钮] 切换状态
                const toggleSwitch = new ToggleComponent(itemEl.controlEl);
                toggleSwitch.setTooltip(this.manager.translator.t("管理器_切换状态_描述"));
                toggleSwitch.setValue(isEnabled);

                // 检查 BPM 忽略标签
                const ManagerPlugin = this.settings.Plugins.find((p) => p.id === plugin.id);
                const isBpmIgnored = ManagerPlugin?.tags?.includes(BPM_IGNORE_TAG);

                if (isSelf) {
                    toggleSwitch.setValue(true);
                    toggleSwitch.setDisabled(true);
                    toggleSwitch.setTooltip(this.manager.translator.t("管理器_自身不可禁用_提示"));
                } else if (isBpmIgnored) {
                    toggleSwitch.setDisabled(true);
                    toggleSwitch.setTooltip(this.manager.translator.t("提示_BPM忽略_描述"));
                } else toggleSwitch.onChange(async () => {
                    const targetEnabled = toggleSwitch.getValue();
                    const removeByFilter = (this.filter === "enabled" && !targetEnabled) || (this.filter === "disabled" && targetEnabled);
                    const updateCardUI = () => {
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
                        this.footEl.innerHTML = this.count();
                    };
                    if (this.settings.DELAY) {
                        if (targetEnabled) {
                            if (ManagerPlugin) ManagerPlugin.enabled = true;
                            await this.manager.savePluginAndExport(plugin.id);
                            await this.appPlugins.enablePlugin(plugin.id);
                        } else {
                            if (ManagerPlugin) ManagerPlugin.enabled = false;
                            await this.manager.savePluginAndExport(plugin.id);
                            await this.appPlugins.disablePlugin(plugin.id);
                        }
                    } else {
                        if (targetEnabled) {
                            if (ManagerPlugin) ManagerPlugin.enabled = true;
                            await this.appPlugins.enablePluginAndSave(plugin.id);
                        } else {
                            if (ManagerPlugin) ManagerPlugin.enabled = false;
                            await this.appPlugins.disablePluginAndSave(plugin.id);
                        }
                        await this.manager.savePluginAndExport(plugin.id);
                    }
                    Commands(this.app, this.manager);
                    updateCardUI();
                });
            }
            //
            if (this.editorMode) {
                // [按钮] 还原内容
                const reloadButton = new ExtraButtonComponent(itemEl.controlEl);
                reloadButton.setIcon("refresh-ccw");
                reloadButton.setTooltip(this.manager.translator.t("管理器_还原内容_描述"));
                reloadButton.onClick(async () => {
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
                    delaysEl.addOptions(delays);
                    delaysEl.setValue(ManagerPlugin.delay);

                    const pSettings = this.settings.Plugins.find(p => p.id === plugin.id);
                    const isIgnored = pSettings?.tags?.includes(BPM_IGNORE_TAG);

                    if (isIgnored) {
                        delaysEl.setDisabled(true);
                    } else {
                        delaysEl.onChange(async (value) => {
                            ManagerPlugin.delay = value;
                            await this.manager.savePluginAndExport(plugin.id);
                            this.reloadShowData();
                        });
                    }
                }
            }
        }
        if (this.settings.DEBUG) {
            const cards = Array.from(this.contentEl.querySelectorAll(".manager-item"));
            console.log("[BPM] render showData after loop, cards:", cards.length, "ids:", cards.map(el => el.getAttribute("data-plugin-id")).filter(Boolean).join(","));
        }
        // 计算页尾
        this.footEl.innerHTML = this.count();
    }

    public count(): string {
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
        const totalLabel = this.manager.translator.t("通用_总计_文本");
        const enabledLabel = this.manager.translator.t("通用_启用_文本");
        const disabledLabel = this.manager.translator.t("通用_禁用_文本");

        return `<span class="bpm-stat-chip bpm-stat-chip--total"><span class="bpm-stat-chip__label">${totalLabel}</span><span class="bpm-stat-chip__value">${totalCount}</span></span><span class="bpm-stat-chip bpm-stat-chip--enabled"><span class="bpm-stat-chip__label">${enabledLabel}</span><span class="bpm-stat-chip__value">${enabledCount}</span></span><span class="bpm-stat-chip bpm-stat-chip--disabled"><span class="bpm-stat-chip__label">${disabledLabel}</span><span class="bpm-stat-chip__value">${disabledCount}</span></span>`;
    }

    // 安装面板
    private showInstallPanel() {
        this.contentEl.empty();
        const t = (k: any) => this.manager.translator.t(k);
        const info = this.contentEl.createEl("div");
        info.addClass("manager-install__info");
        info.setText(t("管理器_安装_介绍"));

        const typeSetting = new Setting(this.contentEl)
            .setName(t("管理器_安装_类型_标题"))
            .setDesc(t("管理器_安装_类型_描述"));
        typeSetting.addDropdown((dd) => {
            dd.addOptions({ "plugin": t("管理器_安装_类型_插件"), "theme": t("管理器_安装_类型_主题") });
            dd.setValue(this.installType);
            dd.onChange((v: "plugin" | "theme") => { this.installType = v; });
        });

        const repoSetting = new Setting(this.contentEl)
            .setName(t("管理器_安装_仓库_标题"))
            .setDesc(t("管理器_安装_仓库_描述"));
        repoSetting.addText((text) => {
            text.setPlaceholder(t("管理器_安装_仓库_占位"));
            text.setValue(this.installRepo);
            text.onChange((v) => { this.installRepo = v; this.installVersions = []; this.installVersion = ""; this.renderContent(); });
        });

        const versionSetting = new Setting(this.contentEl)
            .setName(t("管理器_安装_版本_标题"))
            .setDesc(t("管理器_安装_版本_描述"));
        versionSetting.addDropdown((dd) => {
            dd.addOption("", t("管理器_安装_版本_默认最新"));
            this.installVersions.forEach((v) => dd.addOption(v.version, `${v.version}${v.prerelease ? " (pre)" : ""}`));
            dd.setValue(this.installVersion);
            dd.onChange((v) => { this.installVersion = v; });
            dd.selectEl.style.minWidth = "200px";
        });
        versionSetting.addButton((btn) => {
            btn.setButtonText(t("管理器_安装_版本_获取按钮"));
            btn.setCta();
            btn.onClick(async () => {
                if (!this.installRepo) { new Notice(t("管理器_安装_仓库为空提示")); return; }
                btn.setDisabled(true);
                btn.setButtonText(t("管理器_安装_版本_获取中"));
                try {
                    this.installVersions = await fetchReleaseVersions(this.manager, this.installRepo);
                    if (this.installVersions.length === 0) new Notice(t("管理器_安装_版本_空提示"));
                    this.installVersion = "";
                } catch (e) {
                    console.error(e);
                    new Notice(t("管理器_安装_版本_失败提示"));
                }
                btn.setDisabled(false);
                btn.setButtonText(t("管理器_安装_版本_获取按钮"));
                this.renderContent();
            });
        });

        const action = new Setting(this.contentEl)
            .setName(t("管理器_安装_操作_标题"));
        action.addButton((btn) => {
            btn.setButtonText(t("管理器_安装_操作_按钮"));
            btn.setCta();
            btn.onClick(async () => {
                if (!this.installRepo) { new Notice(t("管理器_安装_仓库为空提示")); return; }
                btn.setDisabled(true);
                const ok = this.installType === "plugin"
                    ? await installPluginFromGithub(this.manager, this.installRepo, this.installVersion)
                    : await installThemeFromGithub(this.manager, this.installRepo, this.installVersion);
                btn.setDisabled(false);
                if (ok) {
                    this.installMode = false;
                    if (this.searchBarEl) this.searchBarEl.removeClass("manager-display-none");
                    this.renderContent();
                }
            });
        });
    }

    private renderContent() {
        this.contentEl.empty();
        if (this.installMode) {
            this.showInstallPanel();
        } else {
            this.showData();
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
        const modalElement: HTMLElement = this.contentEl;
        const scrollTop = modalElement.scrollTop;
        modalElement.empty();
        if (this.installMode) {
            this.showInstallPanel();
            modalElement.scrollTo(0, scrollTop);
        } else {
            await this.showData();
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
            const groups = this.settings.GROUPS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${groupCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("筛选_分组_全部") });
            const current = this.settings.PERSISTENCE ? this.settings.FILTER_GROUP : currentGroup;
            this.resetDropdown(this.groupDropdown, groups, current);
        }
        if (this.tagDropdown) {
            const currentTag = this.tagDropdown.selectEl.value ?? (this.settings.PERSISTENCE ? this.settings.FILTER_TAG : this.tag);
            const tagCounts: { [key: string]: number } = this.settings.Plugins.reduce((acc, plugin) => { plugin.tags.forEach((tag) => { acc[tag] = (acc[tag] || 0) + 1; }); return acc; }, {} as { [key: string]: number });
            const tags = this.settings.TAGS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${tagCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("筛选_标签_全部") });
            const current = this.settings.PERSISTENCE ? this.settings.FILTER_TAG : currentTag;
            this.resetDropdown(this.tagDropdown, tags, current);
        }
        if (this.settings.DELAY && this.delayDropdown) {
            const currentDelay = this.delayDropdown.selectEl.value ?? (this.settings.PERSISTENCE ? this.settings.FILTER_DELAY : this.delay);
            const delayCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const delay = plugin.delay || ""; acc[delay] = (acc[delay] || 0) + 1; return acc; }, { "": 0 });
            const delays = this.settings.DELAYS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} (${delayCounts[item.id] || 0})`; return acc; }, { "": this.manager.translator.t("筛选_延迟_全部") });
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
        // 在面板打开时暂停导出目录的文件监听，避免监听回调触发频繁刷新
        this.manager.pauseExportWatcher();
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
        if (this.modalContainer) this.modalContainer.removeClass("manager-container--editing");
        // 关闭面板后恢复导出目录的文件监听
        this.manager.resumeExportWatcher();
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
