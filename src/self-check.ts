/**
 * BPM 启动自检模块
 * 
 * 检测 community-plugins.json 中是否有非 BPM 插件，
 * 提示用户让 BPM 接管插件控制
 */

import { App, ButtonComponent, Modal, Notice, setIcon } from 'obsidian';
import Manager from 'main';
import { BPM_IGNORE_TAG } from './data/types';

const COMMUNITY_PLUGINS_PATH = '.obsidian/community-plugins.json';

/**
 * 读取 community-plugins.json
 */
async function readCommunityPlugins(app: App): Promise<string[]> {
    try {
        const adapter = app.vault.adapter;
        const content = await adapter.read(COMMUNITY_PLUGINS_PATH);
        return JSON.parse(content) as string[];
    } catch (e) {
        console.error('[BPM] Failed to read community-plugins.json:', e);
        return [];
    }
}

/**
 * 写入 community-plugins.json
 */
async function writeCommunityPlugins(app: App, plugins: string[]): Promise<boolean> {
    try {
        const adapter = app.vault.adapter;
        await adapter.write(COMMUNITY_PLUGINS_PATH, JSON.stringify(plugins, null, 2));
        return true;
    } catch (e) {
        console.error('[BPM] Failed to write community-plugins.json:', e);
        return false;
    }
}

/**
 * 执行接管逻辑 (提取为独立函数)
 */
async function execTakeover(app: App, manager: Manager, pluginIds: string[]): Promise<boolean> {
    const bpmId = manager.manifest.id;

    // 将 community-plugins.json 改为只有 BPM
    const success = await writeCommunityPlugins(app, [bpmId]);

    if (success) {
        // 确保这些插件在 BPM 的管理列表中
        for (const id of pluginIds) {
            const existing = manager.settings.Plugins.find(p => p.id === id);
            if (existing) {
                // 保持当前启用状态
                existing.enabled = true;
            } else {
                // 添加到 BPM 管理列表
                // @ts-ignore
                const manifest = app.plugins.manifests[id];
                if (manifest) {
                    manager.settings.Plugins.push({
                        id: id,
                        name: manifest.name,
                        desc: manifest.description || '',
                        group: '',
                        tags: [],
                        enabled: true,
                        delay: 'default',
                        note: ''
                    });
                }
            }
        }

        await manager.saveSettings();
        return true;
    } else {
        return false;
    }
}

/**
 * 执行启动自检
 */
export async function performSelfCheck(manager: Manager): Promise<void> {
    const bpmId = manager.manifest.id;
    const communityPlugins = await readCommunityPlugins(manager.app);

    // 过滤出非 BPM 插件，且未被标记为忽略的插件
    const nonBpmPlugins = communityPlugins.filter(id => {
        if (id === bpmId) return false;

        // 检查是否存在 BPM 忽略标签
        const pluginInBpm = manager.settings.Plugins.find(p => p.id === id);
        if (pluginInBpm && pluginInBpm.tags.includes(BPM_IGNORE_TAG)) {
            return false; // 忽略此插件
        }

        return true;
    });

    if (nonBpmPlugins.length === 0) {
        return;
    }

    // 自动接管逻辑
    if (manager.settings.AUTO_TAKEOVER) {
        const success = await execTakeover(manager.app, manager, nonBpmPlugins);
        if (success) {
            new Notice(manager.translator.t('自检_接管成功_通知'));
        } else {
            new Notice(manager.translator.t('自检_接管失败_通知'));
        }
        return;
    }

    // 检查用户是否已选择忽略
    if (manager.settings.SELF_CHECK_IGNORED) {
        return;
    }

    // 显示接管对话框
    new TakeoverModal(manager.app, manager, nonBpmPlugins).open();
}

/**
 * 接管确认对话框
 */
class TakeoverModal extends Modal {
    private manager: Manager;
    private nonBpmPlugins: string[];
    private t: (key: any) => string;

    constructor(app: App, manager: Manager, nonBpmPlugins: string[]) {
        super(app);
        this.manager = manager;
        this.nonBpmPlugins = nonBpmPlugins;
        this.t = (k: any) => manager.translator.t(k);
    }

    onOpen() {
        const { contentEl, titleEl } = this;

        // 移除默认关闭按钮
        // @ts-ignore
        const modalEl: HTMLElement = contentEl.parentElement;
        modalEl.addClass('bpm-takeover-modal');
        const closeBtn = modalEl.querySelector('.modal-close-button');
        if (closeBtn) closeBtn.remove();

        // 标题
        titleEl.setText(`⚠️ ${this.t('自检_检测到插件_标题')}`);

        // 说明
        contentEl.createEl('p', {
            text: this.t('自检_检测到插件_说明'),
            cls: 'takeover-desc'
        });

        // 插件列表
        const listContainer = contentEl.createDiv('takeover-plugin-list');
        listContainer.createEl('h4', { text: this.t('自检_检测到插件_列表') });
        const ul = listContainer.createEl('ul');

        for (const id of this.nonBpmPlugins) {
            const name = this.getPluginName(id);
            ul.createEl('li', { text: `${name} (${id})` });
        }

        // 警告说明
        contentEl.createEl('p', {
            text: this.t('自检_警告_文本'),
            cls: 'takeover-warning'
        });

        // 操作按钮
        const actionContainer = contentEl.createDiv('takeover-actions');

        const takeoverBtn = new ButtonComponent(actionContainer);
        takeoverBtn.setButtonText(this.t('自检_接管_按钮'));
        takeoverBtn.setCta();
        takeoverBtn.onClick(async () => {
            await this.takeoverPlugins();
        });

        const ignoreBtn = new ButtonComponent(actionContainer);
        ignoreBtn.setButtonText(this.t('自检_忽略_按钮'));
        ignoreBtn.onClick(async () => {
            await this.ignoreWarning();
        });

        const ignoreForeverBtn = new ButtonComponent(actionContainer);
        ignoreForeverBtn.setButtonText(this.t('自检_不再提示_按钮'));
        ignoreForeverBtn.onClick(async () => {
            await this.ignoreForever();
        });
    }

    private getPluginName(id: string): string {
        // @ts-ignore
        const manifests = this.app.plugins.manifests;
        return manifests[id]?.name || id;
    }

    /**
     * 执行接管
     */
    private async takeoverPlugins() {
        const success = await execTakeover(this.app, this.manager, this.nonBpmPlugins);

        if (success) {
            new Notice(this.t('自检_接管成功_通知'));
            this.close();
            // 提示用户重启以使更改生效
            new Notice(this.t('自检_需要重启_通知'), 5000);
        } else {
            new Notice(this.t('自检_接管失败_通知'));
        }
    }

    /**
     * 忽略警告（本次）
     */
    private async ignoreWarning() {
        new Notice(this.t('自检_忽略警告_通知'), 5000);
        this.close();
    }

    /**
     * 不再提示
     */
    private async ignoreForever() {
        this.manager.settings.SELF_CHECK_IGNORED = true;
        await this.manager.saveSettings();
        new Notice(this.t('自检_不再提示确认_通知'));
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
