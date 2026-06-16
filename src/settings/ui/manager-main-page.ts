import { DropdownComponent, Setting } from "obsidian";
import BaseSetting from "../base-setting";
import { DEFAULT_MAIN_PAGE_ACTION_PLACEMENT, MAIN_PAGE_ACTION_IDS, MainPageActionId, MainPageActionPlacement } from "../data";
import { getExtraButtonElement } from "src/obsidian-internals";

type ActionConfig = {
    id: MainPageActionId;
    icon: string;
    labelKey: string;
    descKey: string;
};

export default class ManagerMainPage extends BaseSetting {
    private actions: ActionConfig[] = [
        { id: "checkUpdate", icon: "rss", labelKey: "菜单_检查更新_标题", descKey: "设置_主页面功能_检查更新_说明" },
        { id: "downloadUpdate", icon: "download", labelKey: "管理器_下载更新_描述", descKey: "设置_主页面功能_下载更新_说明" },
        { id: "singleStart", icon: "repeat-1", labelKey: "菜单_单次启动_描述", descKey: "设置_主页面功能_单次启动_说明" },
        { id: "restart", icon: "refresh-ccw", labelKey: "菜单_重启插件_描述", descKey: "设置_主页面功能_重启插件_说明" },
        { id: "enableIgnored", icon: "shield-check", labelKey: "菜单_启用BPM忽略插件_标题", descKey: "设置_主页面功能_启用BPM忽略插件_说明" },
        { id: "hide", icon: "eye-off", labelKey: "菜单_隐藏插件_标题", descKey: "设置_主页面功能_隐藏插件_说明" },
        { id: "note", icon: "notebook-pen", labelKey: "菜单_笔记_标题", descKey: "设置_主页面功能_笔记_说明" },
        { id: "hotkeys", icon: "circle-plus", labelKey: "菜单_快捷键_标题", descKey: "设置_主页面功能_快捷键_说明" },
        { id: "copyId", icon: "copy", labelKey: "菜单_复制ID_标题", descKey: "设置_主页面功能_复制ID_说明" },
        { id: "openRepo", icon: "github", labelKey: "管理器_打开仓库_标题", descKey: "设置_主页面功能_打开仓库_说明" },
        { id: "openSettings", icon: "settings", labelKey: "管理器_打开设置_描述", descKey: "设置_主页面功能_打开设置_说明" },
        { id: "openDir", icon: "folder-open", labelKey: "管理器_打开目录_描述", descKey: "设置_主页面功能_打开目录_说明" },
        { id: "clearConfig", icon: "file-cog", labelKey: "管理器_清空配置_描述", descKey: "设置_主页面功能_清空配置_说明" },
        { id: "delete", icon: "trash", labelKey: "管理器_删除插件_描述", descKey: "设置_主页面功能_删除插件_说明" },
    ];

    main(): void {
        new Setting(this.containerEl)
            .setHeading()
            .setName(this.manager.translator.t("设置_主页面功能_标题"))
            .setDesc(this.manager.translator.t("设置_主页面功能_描述"));

        this.settings.MAIN_PAGE_ACTION_PLACEMENT = {
            ...DEFAULT_MAIN_PAGE_ACTION_PLACEMENT,
            ...(this.settings.MAIN_PAGE_ACTION_PLACEMENT || {}),
        };

        const placementOptions: Record<MainPageActionPlacement, string> = {
            item: this.manager.translator.t("设置_主页面功能_展示在Item"),
            menu: this.manager.translator.t("设置_主页面功能_存储在右键"),
        };

        this.actions.forEach((action) => {
            const setting = new Setting(this.containerEl)
                .setName(this.manager.translator.t(action.labelKey))
                .setDesc(this.manager.translator.t(action.descKey));
            setting.setClass("manager-main-page-action-setting");

            setting.addExtraButton((button) => {
                button.setIcon(action.icon);
                button.setDisabled(true);
                getExtraButtonElement(button)?.addClass("manager-main-page-action-setting__icon");
            });

            const dropdown = new DropdownComponent(setting.controlEl);
            dropdown.addOptions(placementOptions);
            dropdown.setValue(this.getPlacement(action.id));
            dropdown.onChange((value) => {
                this.settings.MAIN_PAGE_ACTION_PLACEMENT[action.id] = value as MainPageActionPlacement;
                void this.manager.saveSettings();
                void this.manager.managerModal?.reloadShowData();
            });
        });

        const unknownKeys = Object.keys(this.settings.MAIN_PAGE_ACTION_PLACEMENT)
            .filter((key) => !MAIN_PAGE_ACTION_IDS.includes(key as MainPageActionId));
        if (unknownKeys.length > 0) {
            unknownKeys.forEach((key) => delete this.settings.MAIN_PAGE_ACTION_PLACEMENT[key as MainPageActionId]);
            void this.manager.saveSettings();
        }
    }

    private getPlacement(actionId: MainPageActionId): MainPageActionPlacement {
        return this.settings.MAIN_PAGE_ACTION_PLACEMENT?.[actionId]
            ?? DEFAULT_MAIN_PAGE_ACTION_PLACEMENT[actionId];
    }
}
