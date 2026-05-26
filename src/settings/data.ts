import { BetaSource, Delay, InstallHistoryItem, ManagerPlugin, PluginLayoutItem, RibbonItem, SharedVaultEntry, Tag, Type } from '../data/types';
import { TroubleshootState } from '../troubleshoot/troubleshoot-state';

export const MAIN_PAGE_ACTION_IDS = [
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
] as const;

export type MainPageActionId = typeof MAIN_PAGE_ACTION_IDS[number];
export type MainPageActionPlacement = "item" | "menu";
export type MainPageActionPlacementSettings = Partial<Record<MainPageActionId, MainPageActionPlacement>>;

export const DEFAULT_MAIN_PAGE_ACTION_PLACEMENT: Record<MainPageActionId, MainPageActionPlacement> = {
    checkUpdate: "menu",
    downloadUpdate: "item",
    singleStart: "menu",
    restart: "menu",
    hide: "menu",
    note: "menu",
    hotkeys: "menu",
    copyId: "menu",
    openRepo: "item",
    openSettings: "item",
    openDir: "item",
    delete: "item",
};

export interface ManagerSettings {
    // 系统 / 生命周期
    /** 当前界面语言。空字符串表示首次启动时按 Obsidian 当前语言自动初始化。 */
    LANGUAGE: string;
    /** 语言是否已经完成首次自动初始化，避免用户手动改语言后又被系统语言覆盖。 */
    LANGUAGE_INITIALIZED?: boolean;
    /** 已执行到的设置迁移版本，由 migrations.ts 维护，用于避免重复迁移旧数据。 */
    MIGRATION_VERSION?: string;
    /** 调试日志开关。开启后会输出更新检测、仓库解析、迁移等调试信息。 */
    DEBUG: boolean;

    // 基础设置页
    /** 是否持久化管理页筛选状态；关闭时筛选只在当前弹窗生命周期内生效。 */
    PERSISTENCE: boolean;
    /** 管理器弹窗是否居中显示；关闭时桌面端会偏上显示。 */
    CENTER: boolean;
    /** 是否启用 BPM 延迟启动模式；开启后插件启用状态由 BPM 记录驱动。 */
    DELAY: boolean;
    /** 是否在插件卡片中隐藏 BPM 内置标签，例如 BPM 管理标识和 BPM 忽略。 */
    HIDE_BPM_TAG: boolean;
    /** 管理页插件功能显示位置；item 表示直接展示在插件卡片上，menu 表示收纳到右键菜单。 */
    MAIN_PAGE_ACTION_PLACEMENT: MainPageActionPlacementSettings;
    /** 自检发现非 BPM 管理插件时，是否自动接管 community-plugins.json。 */
    AUTO_TAKEOVER: boolean;
    /** 用户是否选择不再显示自检接管提示。 */
    SELF_CHECK_IGNORED?: boolean;
    /** 是否为每个插件注册启用/禁用命令。 */
    COMMAND_ITEM: boolean;
    /** 是否为每个分组注册批量启用/禁用命令。 */
    COMMAND_GROUP: boolean;
    /** 是否在插件启动后自动检查插件更新。 */
    STARTUP_CHECK_UPDATES: boolean;
    /** 是否在插件启动后自动检查 GitHub 来源订阅的远程版本。 */
    SOURCE_STARTUP_CHECK_UPDATES: boolean;
    /** 是否允许启动时执行来源订阅的自动更新；仍会尊重每个来源自己的 autoUpdate 开关。 */
    SOURCE_AUTO_UPDATE: boolean;
    /** GitHub API Token，用于下载 GitHub 插件/主题和降低 API 限流概率。 */
    GITHUB_TOKEN: string;

    // 管理页筛选状态
    /** 持久化的搜索关键词，仅在 PERSISTENCE 开启时作为管理页默认搜索值。 */
    FILTER_SEARCH: string;
    /** 持久化的分组筛选 id，仅在 PERSISTENCE 开启时生效。 */
    FILTER_GROUP: string;
    /** 持久化的标签筛选 id，仅在 PERSISTENCE 开启时生效。 */
    FILTER_TAG: string;
    /** 持久化的延迟配置筛选 id，仅在 PERSISTENCE 与 DELAY 开启时生效。 */
    FILTER_DELAY: string;

    // 样式设置页
    /** 插件卡片展开样式，控制描述、标签、备注等详情的显示策略。 */
    ITEM_STYLE: string;
    /** 分组标签的视觉样式。 */
    GROUP_STYLE: string;
    /** 标签的视觉样式。 */
    TAG_STYLE: string;
    /** 是否降低禁用插件卡片的不透明度，方便视觉区分启用状态。 */
    FADE_OUT_DISABLED_PLUGINS: boolean;

    // 分组 / 标签 / 延迟设置页
    /** 用户自定义分组列表；插件记录通过 group 字段引用这里的 id。 */
    GROUPS: Type[];
    /** 用户自定义标签列表；插件记录通过 tags 数组引用这里的 id。 */
    TAGS: Tag[];
    /** 延迟启动配置列表；插件记录通过 delay 字段引用这里的 id。 */
    DELAYS: Delay[];

    // 插件管理页
    /** BPM 管理的插件主数据，保存插件名、描述、分组、标签、启用状态、延迟和备注。 */
    Plugins: ManagerPlugin[];
    /** 在管理页隐藏的插件 id 列表；只影响 BPM 管理页展示，不卸载插件。 */
    HIDES: string[];
    /** 管理页自定义排序与分割线布局；包含插件项和 separator 项。 */
    PLUGIN_LAYOUT: PluginLayoutItem[];

    // 安装 / 来源页
    /** 插件 id 到 GitHub 仓库的确认映射，用于更新检测、重装和导出信息。 */
    REPO_MAP: Record<string, string>;
    /** 通过 BPM GitHub 安装流程安装过的插件 id，用于标记和卸载提示。 */
    BPM_INSTALLED: string[];
    /** GitHub/Beta 来源订阅列表，用于来源页展示、版本检查和可选自动更新。 */
    BETA_SOURCES: BetaSource[];
    /** 安装页最近使用记录，包含仓库、类型、版本和是否跟踪来源。 */
    INSTALL_HISTORY: InstallHistoryItem[];

    // Ribbon 页面
    /** Ribbon 功能编排记录，保存按钮顺序、显隐、名称和图标。 */
    RIBBON_SETTINGS: RibbonItem[];

    // 共享库 / 软链接
    /** 多库共享时的主库路径；为空时自动按当前库或软链接目标推断。 */
    SHARED_VAULT_MAIN_PATH: string;
    /** 已纳入 BPM 共享管理的 Obsidian 库。 */
    SHARED_VAULTS: SharedVaultEntry[];

    // 旧版 Markdown 导出目录，仅保留用于迁移旧数据；新版导入导出使用管理器内的配置包页面。
    /** @deprecated 插件信息导出目录，相对 vault 根目录；新版不再读取。 */
    EXPORT_DIR: string;

    // 冲突排查页
    /** 插件冲突排查流程的持久化状态，用于关闭弹窗或重启后恢复进度。 */
    TROUBLESHOOT_STATE?: TroubleshootState;
}

export const DEFAULT_SETTINGS: ManagerSettings = {
    // 系统 / 生命周期
    LANGUAGE: "",
    LANGUAGE_INITIALIZED: false,
    MIGRATION_VERSION: "",
    DEBUG: false,

    // 基础设置页
    PERSISTENCE: false,
    CENTER: false,
    DELAY: false,
    HIDE_BPM_TAG: false,
    MAIN_PAGE_ACTION_PLACEMENT: { ...DEFAULT_MAIN_PAGE_ACTION_PLACEMENT },
    AUTO_TAKEOVER: false,
    SELF_CHECK_IGNORED: false,
    COMMAND_ITEM: false,
    COMMAND_GROUP: false,
    STARTUP_CHECK_UPDATES: false,
    SOURCE_STARTUP_CHECK_UPDATES: false,
    SOURCE_AUTO_UPDATE: true,
    GITHUB_TOKEN: "",

    // 管理页筛选状态
    FILTER_SEARCH: "",
    FILTER_GROUP: "",
    FILTER_TAG: "",
    FILTER_DELAY: "",

    // 样式设置页
    ITEM_STYLE: "alwaysExpand",
    GROUP_STYLE: "a",
    TAG_STYLE: "b",
    FADE_OUT_DISABLED_PLUGINS: true,

    // 分组 / 标签 / 延迟设置页
    GROUPS: [],
    TAGS: [],
    DELAYS: [
        {
            "id": "default",
            "name": "Default delay",
            "time": 10
        },
    ],

    // 插件管理页
    Plugins: [],
    HIDES: [],
    PLUGIN_LAYOUT: [],

    // 安装 / 来源页
    REPO_MAP: {},
    BPM_INSTALLED: [],
    BETA_SOURCES: [],
    INSTALL_HISTORY: [],

    // Ribbon 页面
    RIBBON_SETTINGS: [],

    // 共享库 / 软链接
    SHARED_VAULT_MAIN_PATH: "",
    SHARED_VAULTS: [],

    // 旧版 Markdown 导出兼容字段
    EXPORT_DIR: "",

    // 冲突排查页
}
