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
import { installPluginFromGithub, installThemeFromGithub, fetchReleaseVersions, ReleaseVersion } from "../github-install";
import { BPM_TAG_ID } from "src/repo-resolver";
import { normalizePath } from "obsidian";



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

        // [操作行]
        const actionWrapper = this.titleEl.createDiv("manager-section manager-section--row");
        const actionHeader = actionWrapper.createDiv("manager-section__header");
        const actionArrow = actionHeader.createSpan({ text: this.actionCollapsed ? "▼" : "▲" });
        actionArrow.addClass("manager-section__arrow");
        actionHeader.createSpan({ text: this.manager.translator.t("通用_操作_文本") });
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
        const updateActionState = () => {
            actionContent.toggleClass("is-collapsed", this.actionCollapsed);
            actionWrapper.toggleClass("is-collapsed", this.actionCollapsed);
            actionArrow.setText(this.actionCollapsed ? "▼" : "▲");
        };
        actionHeader.onclick = () => { this.actionCollapsed = !this.actionCollapsed; updateActionState(); };
        const actionBar = new Setting(actionContent).setClass("manager-bar__action").setName("");

        // [操作行] Github
        const githubButton = new ButtonComponent(actionBar.controlEl);
        githubButton.setIcon("github");
        githubButton.setTooltip(this.manager.translator.t("管理器_GITHUB_描述"));
        githubButton.setCta();
        this.bindLongPressTooltip(githubButton.buttonEl, this.manager.translator.t("管理器_GITHUB_描述"));
        githubButton.onClick(() => { window.open(this.manager.manifest.authorUrl) });
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
        updateButton.setCta();
        this.bindLongPressTooltip(updateButton.buttonEl, this.manager.translator.t("管理器_检查更新_描述"));
        updateButton.onClick(async () => {
            try {
                const result = await this.appPlugins.checkForUpdates();
                this.appSetting.open();
                this.appSetting.openTabById("community-plugins");
            } catch (error) {
                console.error("检查更新时出错:", error); // 处理可能出现的错误
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
        //     // new Notice('功能未完成，敬请期待！');
        // })

        // [操作行] 插件隐藏
        const hideButton = new ButtonComponent(actionBar.controlEl);
        hideButton.setIcon("eye-off");
        this.bindLongPressTooltip(hideButton.buttonEl, this.manager.translator.t("菜单_隐藏插件_标题"));
        hideButton.onClick(async () => {
            const plugins: PluginManifest[] = Object.values(this.appPlugins.manifests);
            plugins.sort((item1, item2) => { return item1.name.localeCompare(item2.name); });
            new HideModal(this.app, this.manager, this, plugins).open();
        })

        // [操作行] 重载插件
        const reloadButton = new ButtonComponent(actionBar.controlEl);
        reloadButton.setIcon("refresh-ccw");
        reloadButton.setTooltip(this.manager.translator.t("管理器_重载插件_描述"));
        this.bindLongPressTooltip(reloadButton.buttonEl, this.manager.translator.t("管理器_重载插件_描述"));
        reloadButton.onClick(async () => {
            new Notice("重新加载第三方插件");
            await this.appPlugins.loadManifests();
            this.reloadShowData();
        });

        // [操作行] 一键禁用
        const disableButton = new ButtonComponent(actionBar.controlEl);
        disableButton.setIcon("square");
        disableButton.setTooltip(this.manager.translator.t("管理器_一键禁用_描述"));
        this.bindLongPressTooltip(disableButton.buttonEl, this.manager.translator.t("管理器_一键禁用_描述"));
                        disableButton.onClick(async () => {
                            new DisableModal(this.app, this.manager, async () => {
                                for (const plugin of this.displayPlugins) {
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

        // [操作行] 编辑模式
        const editorButton = new ButtonComponent(actionBar.controlEl);
        this.editorMode ? editorButton.setIcon("pen-off") : editorButton.setIcon("pen");
        editorButton.setTooltip(this.manager.translator.t("管理器_编辑模式_描述"));
        this.bindLongPressTooltip(editorButton.buttonEl, this.manager.translator.t("管理器_编辑模式_描述"));
        editorButton.onClick(() => {
            this.editorMode = !this.editorMode;
            this.editorMode ? editorButton.setIcon("pen-off") : editorButton.setIcon("pen");
            this.applyEditingStyle();
            if (!this.editorMode) {
                this.refreshFilterOptions();
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
        updateActionState();

        // [操作行] 插件/主题安装模式
        const installToggle = new ButtonComponent(actionBar.controlEl);
        installToggle.setIcon("download");
        installToggle.setTooltip("安装插件 / 主题（GitHub 仓库）");
        this.bindLongPressTooltip(installToggle.buttonEl, "安装插件 / 主题（GitHub 仓库）");
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

        // [搜索行]
        const filterWrapper = this.titleEl.createDiv("manager-section manager-section--row");
        const filterHeader = filterWrapper.createDiv("manager-section__header");
        const filterArrow = filterHeader.createSpan({ text: this.filterCollapsed ? "▼" : "▲" });
        filterArrow.addClass("manager-section__arrow");
        filterHeader.createSpan({ text: this.manager.translator.t("通用_搜索_文本") });
        const filterContent = filterWrapper.createDiv("manager-section__content");
        filterContent.addClass("manager-section__content--filters");
        const updateFilterState = () => {
            filterContent.toggleClass("is-collapsed", this.filterCollapsed);
            filterWrapper.toggleClass("is-collapsed", this.filterCollapsed);
            filterArrow.setText(this.filterCollapsed ? "▼" : "▲");
        };
        filterHeader.onclick = () => { this.filterCollapsed = !this.filterCollapsed; updateFilterState(); };

        const searchBar = new Setting(filterContent).setClass("manager-bar__search").setName("");
        this.searchBarEl = searchBar.settingEl;
        updateFilterState();

        const filterOptions = {
            "all": this.manager.translator.t("筛选_全部_描述"),
            "enabled": this.manager.translator.t("筛选_仅启用_描述"),
            "disabled": this.manager.translator.t("筛选_仅禁用_描述"),
            "grouped": this.manager.translator.t("筛选_已分组_描述"),
            "ungrouped": this.manager.translator.t("筛选_未分组_描述"),
            "tagged": this.manager.translator.t("筛选_有标签_描述"),
            "untagged": this.manager.translator.t("筛选_无标签_描述"),
            "noted": this.manager.translator.t("筛选_有笔记_描述"),
        };
        // 过滤器
        const filterDropdown = new DropdownComponent(searchBar.controlEl);
        filterDropdown.addOptions(filterOptions);
        filterDropdown.setValue(this.filter || "all");
        filterDropdown.onChange((value) => {
            this.filter = value;
            this.reloadShowData();
        });


        // [搜索行] 分组选择列表
        const groupCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const groupId = plugin.group || ""; acc[groupId] = (acc[groupId] || 0) + 1; return acc; }, { "": 0 });
        const groups = this.settings.GROUPS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${groupCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("通用_无分组_文本") });
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

        // [搜索行] 标签选择列表
        const tagCounts: { [key: string]: number } = this.settings.Plugins.reduce((acc, plugin) => { plugin.tags.forEach((tag) => { acc[tag] = (acc[tag] || 0) + 1; }); return acc; }, {} as { [key: string]: number });
        const tags = this.settings.TAGS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${tagCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("通用_无标签_文本") });
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

        // [搜索行] 延迟选择列表
        if (this.settings.DELAY) {
            const delayCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const delay = plugin.delay || ""; acc[delay] = (acc[delay] || 0) + 1; return acc; }, { "": 0 });
            const delays = this.settings.DELAYS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} (${delayCounts[item.id] || 0})`; return acc; }, { "": this.manager.translator.t("通用_无延迟_文本") });
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
        this.searchEl.onChange((value: string) => { this.searchText = value; this.reloadShowData(); });
    }

    public async showData() {
        const plugins: PluginManifest[] = Object.values(this.appPlugins.manifests);
        plugins.sort((item1, item2) => { return item1.name.localeCompare(item2.name); });
        this.displayPlugins = [];
        for (const plugin of plugins) {
            const ManagerPlugin = this.manager.settings.Plugins.find((mp) => mp.id === plugin.id);
            const pluginDir = normalizePath(`${this.app.vault.configDir}/${plugin.dir ? plugin.dir : ""}`);
            // 插件是否开启
            const isEnabled = this.settings.DELAY ? ManagerPlugin?.enabled : this.appPlugins.enabledPlugins.has(plugin.id);
            if (ManagerPlugin) {
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
                if (this.settings.HIDES.includes(plugin.id)) continue;
                // [过滤] 自身
                if (plugin.id === this.manager.manifest.id) continue;

                const itemEl = new Setting(this.contentEl);
                itemEl.setClass("manager-item");
                itemEl.nameEl.addClass("manager-item__name-container");
                itemEl.descEl.addClass("manager-item__description-container");

                // [右键操作]
                itemEl.settingEl.addEventListener("contextmenu", (event) => {
                    event.preventDefault(); // 阻止默认的右键菜单
                    const menu = new Menu();
                    // 第一组：插件信息类
                    // [菜单] GITHUB
                    menu.addItem((item) =>
                        item.setTitle(this.manager.translator.t("菜单_GitHub_标题"))
                            .setIcon("github")
                            .onClick(() => { window.open(`obsidian://BPM-plugin-github?id=${plugin.id}`) })
                    );
                    menu.addSeparator(); // 分隔符
                    // 第二组：插件管理类
                    // [菜单] 单次启动
                    if (!this.settings.DELAY) menu.addItem((item) =>
                        item.setTitle(this.manager.translator.t("菜单_单次启动_描述"))
                            .setIcon("repeat-1")
                            .setDisabled(isEnabled)
                            .onClick(async () => {
                                new Notice("开启中，请稍等");
                                await this.appPlugins.enablePlugin(plugin.id);
                                await this.reloadShowData();

                            })
                    );
                    // [菜单] 重启插件
                    if (!this.settings.DELAY) menu.addItem((item) =>
                        item.setTitle(this.manager.translator.t("菜单_重启插件_描述"))
                            .setIcon("refresh-ccw")
                            .setDisabled(!isEnabled)
                            .onClick(async () => {
                                new Notice("重启中，请稍等");
                                await this.appPlugins.disablePluginAndSave(plugin.id);
                                await this.appPlugins.enablePluginAndSave(plugin.id);
                                await this.reloadShowData();
                            })
                    );
                    // [菜单] 隐藏插件
                    menu.addItem((item) =>
                        item.setTitle(this.manager.translator.t("菜单_隐藏插件_标题"))
                            .setIcon("eye-off")
                            .onClick(() => {
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
                const version = createSpan({ text: `[${plugin.version}]`, cls: ["manager-item__name-version"], });
                itemEl.nameEl.appendChild(version);

                // [默认] 笔记图标
                if (ManagerPlugin.note?.length > 0) {
                    const note = createSpan();
                    note.style.cssText = "width:16px; height:16px; display:inline-flex; color: var(--text-accent);";
                    note.addEventListener("click", () => { new NoteModal(this.app, this.manager, ManagerPlugin, this).open(); });
                    itemEl.nameEl.appendChild(note);
                    setIcon(note, "notebook-pen");
                }

                // [默认] 延迟
                if (this.settings.DELAY && !this.editorMode && ManagerPlugin.delay !== "") {
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
                    // [按钮] 打开仓库
                    const openRepoButton = new ExtraButtonComponent(itemEl.controlEl);
                    openRepoButton.setIcon("github");
                    openRepoButton.setTooltip("正在检测仓库地址...");
                    openRepoButton.setDisabled(true);
                    const repo = await this.manager.repoResolver.resolveRepo(plugin.id);
                    if (repo) {
                        openRepoButton.setTooltip(`打开仓库：${repo}`);
                        openRepoButton.setDisabled(false);
                        openRepoButton.onClick(() => window.open(`https://github.com/${repo}`));
                    } else {
                        const isBpmInstall = this.manager.settings.BPM_INSTALLED.includes(plugin.id);
                        openRepoButton.setTooltip(isBpmInstall ? "未记录仓库地址" : "本插件非官方/bpm安装，请手动添加来源");
                    }

                    // [按钮] 打开设置
                    if (isEnabled) {
                        const openPluginSetting = new ExtraButtonComponent(itemEl.controlEl);
                        openPluginSetting.setIcon("settings");
                        openPluginSetting.setTooltip(this.manager.translator.t("管理器_打开设置_描述"));
                        openPluginSetting.onClick(() => {
                            openPluginSetting.setDisabled(true);
                            this.appSetting.open();
                            this.appSetting.openTabById(plugin.id);
                            openPluginSetting.setDisabled(false);
                        });
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
                    deletePluginButton.onClick(async () => {
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

                    // [按钮] 切换状态
                    const toggleSwitch = new ToggleComponent(itemEl.controlEl);
                    toggleSwitch.setTooltip(this.manager.translator.t("管理器_切换状态_描述"));
                    toggleSwitch.setValue(isEnabled);
                    toggleSwitch.onChange(async () => {
                        const ManagerPlugin = this.settings.Plugins.find((p) => p.id === plugin.id);
                        if (this.settings.DELAY) {
                            if (toggleSwitch.getValue()) {
                                if (this.settings.FADE_OUT_DISABLED_PLUGINS) itemEl.settingEl.removeClass("inactive"); // [淡化插件]
                                if (ManagerPlugin) ManagerPlugin.enabled = true;
                                await this.manager.savePluginAndExport(plugin.id);
                                await this.appPlugins.enablePlugin(plugin.id);
                            } else {
                                if (this.settings.FADE_OUT_DISABLED_PLUGINS) itemEl.settingEl.addClass("inactive"); // [淡化插件]
                                if (ManagerPlugin) ManagerPlugin.enabled = false;
                                await this.manager.savePluginAndExport(plugin.id);
                                await this.appPlugins.disablePlugin(plugin.id);
                            }
                        } else {
                            if (toggleSwitch.getValue()) {
                                if (this.settings.FADE_OUT_DISABLED_PLUGINS) itemEl.settingEl.removeClass("inactive"); // [淡化插件]
                                if (ManagerPlugin) ManagerPlugin.enabled = true;
                                await this.appPlugins.enablePluginAndSave(plugin.id);
                            } else {
                                if (this.settings.FADE_OUT_DISABLED_PLUGINS) itemEl.settingEl.addClass("inactive"); // [淡化插件]
                                if (ManagerPlugin) ManagerPlugin.enabled = false;
                                await this.appPlugins.disablePluginAndSave(plugin.id);
                            }
                            await this.manager.savePluginAndExport(plugin.id);
                        }
                        Commands(this.app, this.manager);
                        this.reloadShowData();
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
                        delaysEl.setValue(ManagerPlugin.delay);
                        delaysEl.onChange(async (value) => {
                            ManagerPlugin.delay = value;
                            await this.manager.savePluginAndExport(plugin.id);
                            this.reloadShowData();
                        });
                    }
                }
            }
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
        const summary = `[${this.manager.translator.t(
            "通用_总计_文本"
        )}] ${totalCount} [${this.manager.translator.t(
            "通用_启用_文本"
        )}] ${enabledCount} [${this.manager.translator.t(
            "通用_禁用_文本"
        )}] ${disabledCount} `;
        return summary;
    }

    // 安装面板
    private showInstallPanel() {
        this.contentEl.empty();
        const info = this.contentEl.createEl("div");
        info.addClass("manager-install__info");
        info.setText("从 GitHub 仓库安装插件或主题（读取最新发布资产）。");

        const typeSetting = new Setting(this.contentEl)
            .setName("类型")
            .setDesc("选择要安装插件或主题");
        typeSetting.addDropdown((dd) => {
            dd.addOptions({ "plugin": "插件", "theme": "主题" });
            dd.setValue(this.installType);
            dd.onChange((v: "plugin" | "theme") => { this.installType = v; });
        });

        const repoSetting = new Setting(this.contentEl)
            .setName("仓库")
            .setDesc("GitHub 仓库路径，支持 <user>/<repo> 和 https://github.com/<user>/<repo> 两种形式。");
        repoSetting.addText((text) => {
            text.setPlaceholder("user/repo");
            text.setValue(this.installRepo);
            text.onChange((v) => { this.installRepo = v; this.installVersions = []; this.installVersion = ""; this.renderContent(); });
        });

        const versionSetting = new Setting(this.contentEl)
            .setName("版本")
            .setDesc("点击获取 GitHub 发布版本后可选择；不选择则默认最新。");
        versionSetting.addDropdown((dd) => {
            dd.addOption("", "最新发布");
            this.installVersions.forEach((v) => dd.addOption(v.version, `${v.version}${v.prerelease ? " (pre)" : ""}`));
            dd.setValue(this.installVersion);
            dd.onChange((v) => { this.installVersion = v; });
            dd.selectEl.style.minWidth = "200px";
        });
        versionSetting.addButton((btn) => {
            btn.setButtonText("获取版本");
            btn.setCta();
            btn.onClick(async () => {
                if (!this.installRepo) { new Notice("请先填写仓库路径"); return; }
                btn.setDisabled(true);
                btn.setButtonText("获取中...");
                try {
                    this.installVersions = await fetchReleaseVersions(this.manager, this.installRepo);
                    if (this.installVersions.length === 0) new Notice("未找到发行版本，尝试手动填写 tag");
                    this.installVersion = "";
                } catch (e) {
                    console.error(e);
                    new Notice("获取发行版本失败，请检查仓库或网络");
                }
                btn.setDisabled(false);
                btn.setButtonText("获取版本");
                this.renderContent();
            });
        });

        const action = new Setting(this.contentEl)
            .setName("操作");
        action.addButton((btn) => {
            btn.setButtonText("开始安装");
            btn.setCta();
            btn.onClick(async () => {
                if (!this.installRepo) { new Notice("请输入仓库路径"); return; }
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
        let scrollTop = 0;
        const modalElement: HTMLElement = this.contentEl;
        scrollTop = modalElement.scrollTop;
        modalElement.empty();
        if (this.installMode) {
            this.showInstallPanel();
        } else {
            this.showData();
            modalElement.scrollTo(0, scrollTop);
        }
    }

    private refreshFilterOptions() {
        // 重新计算并刷新分组/标签/延迟下拉的计数
        if (this.groupDropdown) {
            const groupCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const groupId = plugin.group || ""; acc[groupId] = (acc[groupId] || 0) + 1; return acc; }, { "": 0 });
            const groups = this.settings.GROUPS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${groupCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("通用_无分组_文本") });
            const current = this.settings.PERSISTENCE ? this.settings.FILTER_GROUP : this.group;
            this.resetDropdown(this.groupDropdown, groups, current);
        }
        if (this.tagDropdown) {
            const tagCounts: { [key: string]: number } = this.settings.Plugins.reduce((acc, plugin) => { plugin.tags.forEach((tag) => { acc[tag] = (acc[tag] || 0) + 1; }); return acc; }, {} as { [key: string]: number });
            const tags = this.settings.TAGS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${tagCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("通用_无标签_文本") });
            const current = this.settings.PERSISTENCE ? this.settings.FILTER_TAG : this.tag;
            this.resetDropdown(this.tagDropdown, tags, current);
        }
        if (this.settings.DELAY && this.delayDropdown) {
            const delayCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const delay = plugin.delay || ""; acc[delay] = (acc[delay] || 0) + 1; return acc; }, { "": 0 });
            const delays = this.settings.DELAYS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} (${delayCounts[item.id] || 0})`; return acc; }, { "": this.manager.translator.t("通用_无延迟_文本") });
            const current = this.settings.PERSISTENCE ? this.settings.FILTER_DELAY : this.delay;
            this.resetDropdown(this.delayDropdown, delays, current);
        }
        this.renderContent();
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
