import {
    App,
    ButtonComponent,
    DropdownComponent,
    ExtraButtonComponent,
    Modal,
    Notice,
    PluginManifest,
    SearchComponent,
    Setting,
    ToggleComponent,
} from "obsidian";

import { ManagerSettings } from "../settings/data";

import Manager from "main";
import { ManagerModal } from "./manager-modal";
import { TagsModal } from "./tags-modal";

interface ExportPluginManifest {
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
    export: boolean;
}

interface ImportPluginManifest {
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
}


// ==============================
//          侧边栏 对话框 翻译
// ==============================
export class HideModal extends Modal {
    manager: Manager;
    managerModal: ManagerModal;
    settings: ManagerSettings;
    // this.app.plugins
    appPlugins;
    // this.app.settings
    appSetting;
    // [本地][变量] 导出插件列表
    plugins: PluginManifest[] = [];

    // 搜索内容
    searchText = "";
    // 搜索结果
    searchEl: SearchComponent;
    delay: string = "";
    tag: string = "";
    group: string = "";
    filter: string = "all";

    constructor(app: App, manager: Manager, managerModal: ManagerModal, plugins: PluginManifest[]) {
        super(app);
        // @ts-ignore
        this.appSetting = this.app.setting;
        // @ts-ignore
        this.appPlugins = this.app.plugins;
        this.manager = manager;
        this.managerModal = managerModal;
        this.settings = manager.settings;
        this.plugins = plugins;
    }

    public async showHead() {
        //@ts-ignore
        const modalEl: HTMLElement = this.contentEl.parentElement;
        modalEl.addClass("manager-container");
        // 靠上
        if (!this.settings.CENTER) modalEl.addClass("manager-container__top");
        modalEl.removeChild(modalEl.getElementsByClassName("modal-close-button")[0]);
        this.titleEl.parentElement?.addClass("manager-container__header");
        this.contentEl.addClass("manager-item-container");

        // [操作行]
        const actionBar = new Setting(this.titleEl).setClass("manager-bar__action").setName(this.manager.translator.t("菜单_隐藏插件_标题"));

        // [操作行] 关闭
        const closeButton = new ButtonComponent(actionBar.controlEl);
        closeButton.setIcon("x");
        closeButton.onClick(() => { this.close(); });

        // [搜索行]
        const searchBar = new Setting(this.titleEl).setClass("manager-bar__search").setName(this.manager.translator.t("通用_搜索_文本"));

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
        filterDropdown.setValue(this.filter);
        filterDropdown.onChange((value) => { this.filter = value; this.reloadShowData(); });

        // [搜索行] 分组选择列表
        const groupCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const groupId = plugin.group || ""; acc[groupId] = (acc[groupId] || 0) + 1; return acc; }, { "": 0 });
        const groups = this.settings.GROUPS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${groupCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("通用_无分组_文本") });
        const groupsDropdown = new DropdownComponent(searchBar.controlEl);
        groupsDropdown.addOptions(groups);
        groupsDropdown.setValue(this.group);
        groupsDropdown.onChange((value) => { this.group = value; this.reloadShowData(); });

        // [搜索行] 标签选择列表
        const tagCounts: { [key: string]: number } = this.settings.Plugins.reduce((acc, plugin) => { plugin.tags.forEach((tag) => { acc[tag] = (acc[tag] || 0) + 1; }); return acc; }, {} as { [key: string]: number });
        const tags = this.settings.TAGS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} [${tagCounts[item.id] || 0}]`; return acc; }, { "": this.manager.translator.t("通用_无标签_文本") });
        const tagsDropdown = new DropdownComponent(searchBar.controlEl);
        tagsDropdown.addOptions(tags);
        tagsDropdown.setValue(this.tag);
        tagsDropdown.onChange((value) => { this.tag = value; this.reloadShowData(); });

        // [搜索行] 延迟选择列表
        if (this.settings.DELAY) {
            const delayCounts = this.settings.Plugins.reduce((acc: { [key: string]: number }, plugin) => { const delay = plugin.delay || ""; acc[delay] = (acc[delay] || 0) + 1; return acc; }, { "": 0 });
            const delays = this.settings.DELAYS.reduce((acc: { [key: string]: string }, item) => { acc[item.id] = `${item.name} (${delayCounts[item.id] || 0})`; return acc; }, { "": this.manager.translator.t("通用_无延迟_文本") });
            const delaysDropdown = new DropdownComponent(searchBar.controlEl);
            delaysDropdown.addOptions(delays);
            delaysDropdown.setValue(this.delay || "");
            delaysDropdown.onChange((value) => { this.delay = value; this.reloadShowData(); });
        }

        // [搜索行] 搜索框
        this.searchEl = new SearchComponent(searchBar.controlEl);
        this.searchEl.onChange((value: string) => { this.searchText = value; this.reloadShowData(); });
    }

    public async showData() {
        for (const plugin of this.plugins) {
            const ManagerPlugin = this.manager.settings.Plugins.find((mp) => mp.id === plugin.id);
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
                // [过滤] 分组 标签 延时
                if (this.group !== "" && (ManagerPlugin.group !== this.group)) continue;
                if (this.tag !== "" && !ManagerPlugin.tags.includes(this.tag)) continue;
                if (this.delay !== "" && ManagerPlugin.delay !== this.delay) continue;
                // [过滤] 搜索
                if (this.searchText !== "" && ManagerPlugin.name.toLowerCase().indexOf(this.searchText.toLowerCase()) == -1 && ManagerPlugin.desc.toLowerCase().indexOf(this.searchText.toLowerCase()) == -1 && plugin.author.toLowerCase().indexOf(this.searchText.toLowerCase()) == -1) continue;
                // [过滤] 自身
                if (plugin.id === this.manager.manifest.id) continue;

                const itemEl = new Setting(this.contentEl);
                itemEl.setClass("manager-item");
                itemEl.nameEl.addClass("manager-item__name-container");
                itemEl.descEl.addClass("manager-item__description-container");

                // [默认] 分组
                if (ManagerPlugin.group !== "") {
                    const group = createSpan({ cls: "manager-item__name-group", });
                    itemEl.nameEl.appendChild(group);
                    const item = this.settings.GROUPS.find((t) => t.id === ManagerPlugin.group);
                    if (item) { const tag = this.manager.createTag(item.name, item.color, this.settings.GROUP_STYLE); group.appendChild(tag); }
                }

                // [默认] 名称
                const title = createSpan({ text: ManagerPlugin.name, cls: "manager-item__name-title", });
                itemEl.nameEl.appendChild(title);

                // [默认] 版本
                const version = createSpan({ text: `[${plugin.version}]`, cls: ["manager-item__name-version"], });
                itemEl.nameEl.appendChild(version);

                // [默认] 延迟
                if (this.settings.DELAY && ManagerPlugin.delay !== "") {
                    const d = this.settings.DELAYS.find((item) => item.id === ManagerPlugin.delay);
                    if (d) {
                        const delay = createSpan({ text: `${d.time}s`, cls: ["manager-item__name-delay"], });
                        itemEl.nameEl.appendChild(delay);
                    }
                }

                // [默认] 描述
                const desc = createDiv({ text: ManagerPlugin.desc, cls: ["manager-item__name-desc"], });
                itemEl.descEl.appendChild(desc);

                // [默认] 标签组
                const tags = createDiv();
                itemEl.descEl.appendChild(tags);
                ManagerPlugin.tags.map((id: string) => {
                    const item = this.settings.TAGS.find((item) => item.id === id);
                    if (item) { const tag = this.manager.createTag(item.name, item.color, this.settings.TAG_STYLE); tags.appendChild(tag); }
                });

                const hiddenToggle = new ToggleComponent(itemEl.controlEl);
                // 判断当前插件是否在隐藏列表
                const isHidden = this.settings.HIDES.includes(plugin.id);
                hiddenToggle.setValue(isHidden);
                hiddenToggle.onChange((value) => {
                    // 更新隐藏列表
                    if (value) this.settings.HIDES.push(plugin.id); else this.settings.HIDES = this.settings.HIDES.filter(id => id !== plugin.id);
                    this.manager.saveSettings();
                    this.managerModal.reloadShowData();
                });
            }
        }
    }

    public async reloadShowData() {
        let scrollTop = 0;
        const modalElement: HTMLElement = this.contentEl;
        scrollTop = modalElement.scrollTop;
        modalElement.empty();
        this.showData();
        modalElement.scrollTo(0, scrollTop);
    }

    public async onOpen() {
        await this.showHead();
        await this.showData();
    }

    public async onClose() {
        this.contentEl.empty();
    }
}
