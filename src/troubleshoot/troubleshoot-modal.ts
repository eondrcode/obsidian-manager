/**
 * 插件冲突排查 - 可拖动悬浮窗
 * 
 * 非模态窗口，用户可以拖动，不会锁定焦点
 */

import { App, ButtonComponent, Notice, Setting, setIcon } from 'obsidian';
import Manager from 'main';
import { TroubleshootState, INITIAL_TROUBLESHOOT_STATE, cloneState } from './troubleshoot-state';
import { TroubleshootAlgorithm } from './troubleshoot-algorithm';
import { TroubleshootResultModal } from './troubleshoot-result';

export class TroubleshootModal {
    private app: App;
    private manager: Manager;
    private algorithm: TroubleshootAlgorithm;
    private state: TroubleshootState;
    private t: (key: any) => string;
    private lastDescription: string = '';

    // 悬浮窗元素
    private containerEl: HTMLElement | null = null;
    private headerEl: HTMLElement | null = null;
    private contentEl: HTMLElement | null = null;

    // 拖动状态
    private isDragging = false;
    private dragOffsetX = 0;
    private dragOffsetY = 0;

    constructor(app: App, manager: Manager) {
        this.app = app;
        this.manager = manager;
        this.algorithm = new TroubleshootAlgorithm(app, manager);
        this.t = (k: any) => manager.translator.t(k);

        // 尝试从设置中恢复状态
        const savedState = manager.settings.TROUBLESHOOT_STATE;
        if (savedState && savedState.status === 'running') {
            this.state = savedState;
        } else {
            this.state = cloneState(INITIAL_TROUBLESHOOT_STATE);
        }
    }

    open() {
        if (this.containerEl) {
            // 已经打开了
            return;
        }
        this.createFloatingWindow();
        this.render();
    }

    close() {
        if (this.containerEl) {
            this.containerEl.remove();
            this.containerEl = null;
            this.headerEl = null;
            this.contentEl = null;
        }
        this.saveState();
    }

    private async saveState() {
        this.manager.settings.TROUBLESHOOT_STATE = this.state;
        await this.manager.saveSettings();
    }

    /**
     * 创建悬浮窗
     */
    private createFloatingWindow() {
        // 创建容器
        this.containerEl = document.body.createDiv({ cls: 'troubleshoot-floating-window' });

        // 创建头部（可拖动）
        this.headerEl = this.containerEl.createDiv({ cls: 'troubleshoot-floating-header' });

        // 创建内容区
        this.contentEl = this.containerEl.createDiv({ cls: 'troubleshoot-floating-content' });

        // 设置初始位置（屏幕右下角）
        this.containerEl.style.position = 'fixed';
        this.containerEl.style.right = '20px';
        this.containerEl.style.bottom = '20px';
        this.containerEl.style.left = 'auto';
        this.containerEl.style.top = 'auto';
        this.containerEl.style.zIndex = '1000';

        // 绑定拖动事件
        this.bindDragEvents();
    }

    /**
     * 绑定拖动事件
     */
    private bindDragEvents() {
        if (!this.headerEl || !this.containerEl) return;

        const onMouseDown = (e: MouseEvent) => {
            if (!this.containerEl) return;
            this.isDragging = true;
            const rect = this.containerEl.getBoundingClientRect();
            this.dragOffsetX = e.clientX - rect.left;
            this.dragOffsetY = e.clientY - rect.top;
            this.headerEl!.addClass('dragging');
            e.preventDefault();
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!this.isDragging || !this.containerEl) return;

            // 使用 left/top 定位
            this.containerEl.style.left = `${e.clientX - this.dragOffsetX}px`;
            this.containerEl.style.top = `${e.clientY - this.dragOffsetY}px`;
            this.containerEl.style.right = 'auto';
            this.containerEl.style.bottom = 'auto';
        };

        const onMouseUp = () => {
            this.isDragging = false;
            this.headerEl?.removeClass('dragging');
        };

        this.headerEl.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        // 触摸设备支持
        this.headerEl.addEventListener('touchstart', (e) => {
            if (!this.containerEl || e.touches.length !== 1) return;
            const touch = e.touches[0];
            const rect = this.containerEl.getBoundingClientRect();
            this.isDragging = true;
            this.dragOffsetX = touch.clientX - rect.left;
            this.dragOffsetY = touch.clientY - rect.top;
        });

        document.addEventListener('touchmove', (e) => {
            if (!this.isDragging || !this.containerEl || e.touches.length !== 1) return;
            const touch = e.touches[0];
            this.containerEl.style.left = `${touch.clientX - this.dragOffsetX}px`;
            this.containerEl.style.top = `${touch.clientY - this.dragOffsetY}px`;
            this.containerEl.style.right = 'auto';
            this.containerEl.style.bottom = 'auto';
        });

        document.addEventListener('touchend', () => {
            this.isDragging = false;
        });
    }

    private async render() {
        if (!this.contentEl || !this.headerEl) return;

        this.contentEl.empty();
        this.headerEl.empty();

        if (this.state.status === 'idle') {
            await this.renderWelcome();
        } else if (this.state.status === 'running') {
            await this.renderProgress();
        } else if (this.state.status === 'completed') {
            this.close();
            new TroubleshootResultModal(this.app, this.manager, this.state).open();
        }
    }

    /**
     * 渲染欢迎界面
     */
    private async renderWelcome() {
        if (!this.headerEl || !this.contentEl) return;

        // 头部
        const titleSpan = this.headerEl.createSpan({ text: this.t('排查_欢迎_标题'), cls: 'troubleshoot-floating-title' });

        // 关闭按钮
        const closeBtn = this.headerEl.createEl('button', { cls: 'troubleshoot-floating-close' });
        setIcon(closeBtn, 'x');
        closeBtn.onclick = () => this.close();

        // 说明
        this.contentEl.createEl('p', {
            text: this.t('排查_欢迎_说明'),
            cls: 'troubleshoot-desc'
        });

        // 当前启用的插件数量
        const enabledPlugins = this.algorithm.getEnabledPlugins();
        this.contentEl.createEl('p', {
            text: `${this.t('排查_当前启用_文本')}: ${enabledPlugins.length}`,
            cls: 'troubleshoot-info'
        });

        // 预计步骤
        const estimatedSteps = Math.ceil(Math.log2(enabledPlugins.length)) * 2 + 2;
        this.contentEl.createEl('p', {
            text: `${this.t('排查_预计步骤_文本')}: ~${estimatedSteps}`,
            cls: 'troubleshoot-info'
        });

        // 操作按钮
        const actionContainer = this.contentEl.createDiv('troubleshoot-actions');

        const startBtn = new ButtonComponent(actionContainer);
        startBtn.setButtonText(this.t('排查_开始_按钮'));
        startBtn.setCta();
        startBtn.onClick(async () => {
            await this.startTroubleshoot();
        });

        const cancelBtn = new ButtonComponent(actionContainer);
        cancelBtn.setButtonText(this.t('排查_取消_按钮'));
        cancelBtn.onClick(() => this.close());
    }

    /**
     * 渲染排查进度界面
     */
    private async renderProgress() {
        if (!this.headerEl || !this.contentEl) return;

        // 头部
        this.headerEl.createSpan({
            text: `${this.t('排查_步骤_文本')} ${this.state.currentStep}`,
            cls: 'troubleshoot-floating-title'
        });

        // 关闭按钮
        const closeBtn = this.headerEl.createEl('button', { cls: 'troubleshoot-floating-close' });
        setIcon(closeBtn, 'x');
        closeBtn.onclick = () => this.confirmExit();

        // 阶段说明
        const algo = this.state.algorithmState;
        let phaseText = '';
        if (algo) {
            switch (algo.stage) {
                case 'initial-confirm':
                    phaseText = this.t('排查_阶段_确认');
                    break;
                case 'bisect-main':
                    phaseText = this.t('排查_阶段_查找第一');
                    break;
                case 'cross-pair-bisect-b':
                case 'cross-pair-bisect-a':
                    phaseText = this.t('排查_阶段_查找第二');
                    break;
                case 'verify-single':
                case 'verify-pair':
                    phaseText = this.t('排查_阶段_验证');
                    break;
            }
        }
        this.contentEl.createEl('p', { text: phaseText, cls: 'troubleshoot-phase' });

        // 当前操作描述
        if (this.lastDescription) {
            this.contentEl.createEl('p', {
                text: `${this.t('排查_当前测试')}: ${this.lastDescription}`,
                cls: 'troubleshoot-desc'
            });
        }

        // 进度条
        const progressContainer = this.contentEl.createDiv('troubleshoot-progress');
        const remaining = this.algorithm.estimateRemainingSteps(this.state);
        const total = this.state.currentStep + remaining;
        const percent = Math.round((this.state.currentStep / total) * 100);

        const progressBar = progressContainer.createDiv('troubleshoot-progress-bar');
        progressBar.style.width = `${percent}%`;
        progressContainer.createSpan({ text: `${percent}%`, cls: 'troubleshoot-progress-text' });

        // 当前启用的插件列表（不省略，可滚动）
        const currentEnabled = this.algorithm.getEnabledPlugins();
        const listContainer = this.contentEl.createDiv('troubleshoot-lists');

        // 启用列表
        const enabledDiv = listContainer.createDiv('troubleshoot-list enabled');
        enabledDiv.createEl('h4', { text: `✅ ${this.t('排查_已启用_文本')} (${currentEnabled.length})` });
        const enabledList = enabledDiv.createEl('ul');

        // 显示全部插件，不省略
        for (const id of currentEnabled) {
            enabledList.createEl('li', { text: this.algorithm.getPluginName(id) });
        }
        if (currentEnabled.length === 0) {
            enabledList.createEl('li', { text: this.t('排查_列表_无'), cls: 'muted' });
        }

        // 提示文字
        this.contentEl.createEl('p', {
            text: this.t('排查_测试提示_文本'),
            cls: 'troubleshoot-hint'
        });

        // 操作按钮
        const actionContainer = this.contentEl.createDiv('troubleshoot-actions');

        const problemExistsBtn = new ButtonComponent(actionContainer);
        problemExistsBtn.setButtonText(`👎 ${this.t('排查_问题还在_按钮')}`);
        problemExistsBtn.onClick(async () => {
            await this.handleFeedback(true);
        });

        const problemGoneBtn = new ButtonComponent(actionContainer);
        problemGoneBtn.setButtonText(`👍 ${this.t('排查_问题消失_按钮')}`);
        problemGoneBtn.setCta();
        problemGoneBtn.onClick(async () => {
            await this.handleFeedback(false);
        });

        const restartBtn = new ButtonComponent(actionContainer);
        restartBtn.setButtonText(`🔄 ${this.t('排查_重启_按钮')}`);
        restartBtn.onClick(async () => {
            await this.saveState();
            this.algorithm.restartObsidian();
        });

        // 底部操作
        const footerContainer = this.contentEl.createDiv('troubleshoot-footer');

        const undoBtn = new ButtonComponent(footerContainer);
        undoBtn.setButtonText(`↩️ ${this.t('排查_撤销_按钮')}`);
        undoBtn.setDisabled(this.state.history.length === 0);
        undoBtn.onClick(async () => {
            await this.undo();
        });

        const exitBtn = new ButtonComponent(footerContainer);
        exitBtn.setButtonText(`🚪 ${this.t('排查_退出_按钮')}`);
        exitBtn.onClick(() => this.confirmExit());
    }

    /**
     * 开始排查
     */
    private async startTroubleshoot() {
        this.state = this.algorithm.initState();
        this.lastDescription = this.t('排查_描述_禁用全部');

        await this.algorithm.startTroubleshoot(this.state);
        await this.saveState();

        new Notice(this.t('排查_已禁用所有_通知'));
        await this.render();
    }

    /**
     * 处理用户反馈
     */
    private async handleFeedback(problemExists: boolean) {
        const result = await this.algorithm.executeNextStep(this.state, problemExists);

        switch (result.type) {
            case 'not-plugin-issue':
                new Notice(this.t('排查_非插件问题_通知'));
                await this.algorithm.restoreOriginal(this.state);
                this.state.status = 'aborted';
                await this.saveState();
                this.close();
                return;

            case 'single':
                // 找到单插件问题
                await this.saveState();
                this.close();
                new TroubleshootResultModal(this.app, this.manager, this.state).open();
                return;

            case 'pair':
                // 找到冲突对
                await this.saveState();
                this.close();
                new TroubleshootResultModal(this.app, this.manager, this.state).open();
                return;

            case 'error':
                new Notice(result.message);
                await this.algorithm.restoreOriginal(this.state);
                this.state.status = 'aborted';
                await this.saveState();
                this.close();
                return;

            case 'continue':
                if (result.nextAction.action === 'test') {
                    this.lastDescription = result.nextAction.description;
                }
                await this.saveState();
                await this.render();
                return;
        }
    }

    /**
     * 撤销上一步
     */
    private async undo() {
        const success = await this.algorithm.undo(this.state);
        if (success) {
            await this.saveState();
            await this.render();
            new Notice(this.t('排查_已撤销_通知'));
        }
    }

    /**
     * 确认退出
     */
    private confirmExit() {
        // 创建确认对话框（简单的 div）
        const overlay = document.body.createDiv({ cls: 'troubleshoot-confirm-overlay' });
        const dialog = overlay.createDiv({ cls: 'troubleshoot-confirm-dialog' });

        dialog.createEl('h4', { text: this.t('排查_退出确认_标题') });
        dialog.createEl('p', { text: this.t('排查_退出确认_文本') });

        const actions = dialog.createDiv('troubleshoot-actions');

        const restoreBtn = new ButtonComponent(actions);
        restoreBtn.setButtonText(this.t('排查_恢复并退出_按钮'));
        restoreBtn.setCta();
        restoreBtn.onClick(async () => {
            await this.algorithm.restoreOriginal(this.state);
            this.state = cloneState(INITIAL_TROUBLESHOOT_STATE);
            await this.saveState();
            overlay.remove();
            this.close();
        });

        const keepBtn = new ButtonComponent(actions);
        keepBtn.setButtonText(this.t('排查_保持并退出_按钮'));
        keepBtn.onClick(async () => {
            await this.saveState();
            overlay.remove();
            this.close();
        });

        const cancelBtn = new ButtonComponent(actions);
        cancelBtn.setButtonText(this.t('排查_继续排查_按钮'));
        cancelBtn.onClick(() => overlay.remove());

        // 点击遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }
}
