import { App, Platform, TFile, debounce, Notice } from "obsidian";
import Manager from "../main";

export interface RibbonConfig {
    hiddenItems: { [id: string]: boolean };
}

export class SystemRibbonManager {
    private app: App;
    private manager: Manager;
    private configPath: string;
    private isInternalUpdate: boolean = false;
    private onConfigChange: () => void;
    private fileWatcher: any;

    constructor(app: App, manager: Manager) {
        this.app = app;
        this.manager = manager;
        // 自动判定配置文件路径
        this.configPath = Platform.isMobile
            ? ".obsidian/workspace-mobile.json"
            : ".obsidian/workspace.json"; // 默认路径，可能会根据 configDir 变化

        // 更严谨的路径获取
        if (this.app.vault.configDir) {
            this.configPath = Platform.isMobile
                ? `${this.app.vault.configDir}/workspace-mobile.json`
                : `${this.app.vault.configDir}/workspace.json`;
        }
    }

    /**
     * 读取配置
     * @returns 返回有序的 ID 列表和显隐状态 Map
     */
    public async load(): Promise<{ orderedIds: string[], hiddenStatus: Record<string, boolean> }> {
        try {
            const exists = await this.app.vault.adapter.exists(this.configPath);
            if (!exists) {
                console.warn(`[BPM] Workspace config not found at ${this.configPath}`);
                return { orderedIds: [], hiddenStatus: {} };
            }

            const content = await this.app.vault.adapter.read(this.configPath);
            const json = JSON.parse(content);
            const leftRibbon = json["left-ribbon"];

            if (!leftRibbon || !leftRibbon.hiddenItems) {
                return { orderedIds: [], hiddenStatus: {} };
            }

            // 在 JS 引擎中，和 JSON 标准中，Object.keys 的顺序对于非整数键通常是插入顺序。
            // Obsidian 利用这一特性来存储顺序。
            const hiddenItems = leftRibbon.hiddenItems;
            const orderedIds = Object.keys(hiddenItems);
            const hiddenStatus = hiddenItems;

            return { orderedIds, hiddenStatus };
        } catch (e) {
            console.error("[BPM] Failed to load workspace config", e);
            return { orderedIds: [], hiddenStatus: {} };
        }
    }

    /**
     * 保存配置
     * @param orderedIds 按期望顺序排列的 ID 列表
     * @param hiddenStatus 每个 ID 的显隐状态
     */
    public async save(orderedIds: string[], hiddenStatus: Record<string, boolean>) {
        if (this.isInternalUpdate) return;
        this.isInternalUpdate = true;

        try {
            const exists = await this.app.vault.adapter.exists(this.configPath);
            if (!exists) {
                console.warn(`[BPM] Workspace config not found at ${this.configPath}, skipping save.`);
                return;
            }

            const content = await this.app.vault.adapter.read(this.configPath);
            const json = JSON.parse(content);

            // 构建新的 hiddenItems 对象，严格按照 orderedIds 顺序
            const newHiddenItems: Record<string, boolean> = {};

            // 1. 先加入 orderedIds 中的项
            for (const id of orderedIds) {
                // 如果 hiddenStatus 中没有，默认为 false (显示)
                newHiddenItems[id] = hiddenStatus[id] ?? false;
            }

            // 2. (可选) 保留原文件中有但 orderedIds 中没有的项？
            // 为了防止丢失未被 BPM 管理的图标，应该合并。
            // 但如果 BPM 能够获取所有图标，则不需要。
            // 考虑到安全性，还是检查一下原数据
            if (json["left-ribbon"] && json["left-ribbon"].hiddenItems) {
                const oldKeys = Object.keys(json["left-ribbon"].hiddenItems);
                for (const oldKey of oldKeys) {
                    if (!(oldKey in newHiddenItems)) {
                        newHiddenItems[oldKey] = json["left-ribbon"].hiddenItems[oldKey];
                    }
                }
            }

            // 更新 json
            if (!json["left-ribbon"]) json["left-ribbon"] = {};
            json["left-ribbon"].hiddenItems = newHiddenItems;

            console.log(`[BPM] Saving workspace config to ${this.configPath}`);
            console.log(`[BPM] New hiddenItems:`, newHiddenItems);

            await this.app.vault.adapter.write(this.configPath, JSON.stringify(json, null, 2));
            console.log("[BPM] Workspace config saved successfully.");

        } catch (e) {
            console.error("[BPM] Failed to save workspace config", e);
            new Notice("保存 Ribbon 配置失败，请查看控制台");
        } finally {
            // 延迟释放锁，防止文件系统事件立即触发
            setTimeout(() => {
                this.isInternalUpdate = false;
            }, 1000);
        }
    }

    /**
     * 启动文件监听
     * @param callback 配置变更时的回调
     */
    public startWatch(callback: () => void) {
        this.onConfigChange = callback;
        // 使用 debounce 防止频繁触发
        const debouncedReload = debounce(() => {
            if (this.isInternalUpdate) return;
            console.log("[BPM] Detected workspace config change, reloading...");
            this.onConfigChange();
        }, 1000, true);

        // 监听 vault 修改事件
        this.fileWatcher = this.app.vault.on("modify", (file) => {
            if (file instanceof TFile && file.path === this.configPath) {
                debouncedReload();
            }
        });
    }

    public stopWatch() {
        if (this.fileWatcher) {
            this.app.vault.offref(this.fileWatcher);
            this.fileWatcher = null;
        }
    }
}
