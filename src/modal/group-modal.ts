import { App, ExtraButtonComponent, Modal, Notice, setIcon, Setting } from 'obsidian';
import { ManagerSettings } from '../settings/data';
import Manager from 'main';
import { ManagerModal } from './manager-modal';
import { ManagerPlugin } from 'src/data/types';
import Commands from 'src/command';

export class GroupModal extends Modal {
    settings: ManagerSettings;
    manager: Manager;
    managerModal: ManagerModal;
    managerPlugin: ManagerPlugin;
    selected: string;
    add: boolean;
    private defaultGroupColor = '';

    constructor(app: App, manager: Manager, managerModal: ManagerModal, managerPlugin: ManagerPlugin) {
        super(app);
        this.settings = manager.settings;
        this.manager = manager;
        this.managerModal = managerModal;
        this.managerPlugin = managerPlugin;
        this.selected = '';
        this.add = false;
    }

    private getExtraButtonEl(button: ExtraButtonComponent): HTMLElement | undefined {
        return ((button as any).extraSettingsEl || (button as any).buttonEl) as HTMLElement | undefined;
    }

    private prepareIconButton(button: ExtraButtonComponent, label: string, className?: string) {
        button.setTooltip(label);
        const buttonEl = this.getExtraButtonEl(button);
        buttonEl?.setAttribute('aria-label', label);
        if (className) buttonEl?.addClass(className);
    }

    private getGroupUsageCount(groupId: string): number {
        return this.settings.Plugins.reduce((count, plugin) => count + (plugin.group === groupId ? 1 : 0), 0);
    }

    private async showHead() {
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        //@ts-ignore
        const modalEl: HTMLElement = this.contentEl.parentElement;
        modalEl.addClass('manager-editor__container');
        modalEl.addClass('manager-tag-editor');
        modalEl.addClass('manager-group-editor');
        modalEl.getElementsByClassName('modal-close-button')[0]?.remove();
        this.titleEl.parentElement?.addClass('manager-container__header');
        this.contentEl.addClass('manager-item-container');
        this.contentEl.addClass('manager-tag-editor__body');

        // [标题行]
        const titleBar = new Setting(this.titleEl).setClass('manager-bar__title');
        titleBar.settingEl.addClass('manager-tag-editor__titlebar');
        titleBar.nameEl.empty();
        titleBar.descEl.empty();
        const titleWrap = titleBar.nameEl.createDiv('manager-tag-editor__title');
        const titleIcon = titleWrap.createSpan({ cls: 'manager-tag-editor__title-icon' });
        setIcon(titleIcon, 'folders');
        const titleText = titleWrap.createDiv('manager-tag-editor__title-text');
        titleText.createDiv({ cls: 'manager-tag-editor__eyebrow', text: t('分组编辑_标题') });
        titleText.createDiv({ cls: 'manager-tag-editor__plugin-name', text: this.managerPlugin.name || this.managerPlugin.id });
        titleBar.descEl.setText(t('分组编辑_说明'));
        // [标题行] 关闭按钮
        const closeButton = new ExtraButtonComponent(titleBar.controlEl)
        closeButton.setIcon('x')
        this.prepareIconButton(closeButton, t('通用_关闭_文本'));
        closeButton.onClick(() => this.close());
    }

    private async showData() {
        const t = (k: any, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        // 预先计算一个缺省颜色，避免与现有颜色过近
        if (!this.defaultGroupColor) {
            this.defaultGroupColor = this.pickDistinctColor(this.settings.GROUPS.map(g => g.color));
        }
        const page = this.contentEl.createDiv('manager-tag-editor__page');
        const selectedCount = this.managerPlugin.group ? 1 : 0;
        const summary = page.createDiv('manager-tag-editor__summary');
        const summaryMain = summary.createDiv('manager-tag-editor__summary-main');
        summaryMain.createDiv({ cls: 'manager-tag-editor__summary-title', text: t('分组编辑_选择标题') });
        summaryMain.createDiv({ cls: 'manager-tag-editor__summary-desc', text: t('分组编辑_选择说明', { id: this.managerPlugin.id, selected: selectedCount, total: this.settings.GROUPS.length }) });
        const summaryStats = summary.createDiv('manager-tag-editor__summary-stats');
        summaryStats.createSpan({ cls: 'manager-tag-editor__summary-stat', text: t('设置_分类_统计', { label: t('通用_全部_文本'), count: this.settings.GROUPS.length }) });
        summaryStats.createSpan({ cls: 'manager-tag-editor__summary-stat', text: t('设置_分类_统计', { label: t('通用_已选择_文本'), count: selectedCount }) });

        const list = page.createDiv('manager-tag-editor__list');
        for (const group of this.settings.GROUPS) {
            const selected = group.id === this.managerPlugin.group;
            const usageCount = this.getGroupUsageCount(group.id);
            const isEditing = this.selected == group.id;
            const itemEl = new Setting(list)
            itemEl.setClass('manager-editor__item')
            itemEl.settingEl.addClass('manager-tag-editor__item');
            itemEl.settingEl.toggleClass('is-assigned', selected);
            itemEl.settingEl.toggleClass('is-editing', isEditing);
            itemEl.nameEl.empty();
            itemEl.descEl.empty();
            itemEl.controlEl.addClass('manager-tag-editor__item-actions');

            const previewLine = itemEl.nameEl.createDiv('manager-tag-editor__preview-line');
            const tag = this.manager.createTag(group.name || group.id, group.color, this.settings.GROUP_STYLE);
            tag.addClass('manager-tag-editor__chip');
            previewLine.appendChild(tag);
            previewLine.createSpan({ cls: 'manager-tag-editor__id', text: group.id });
            if (selected) previewLine.createSpan({ cls: 'manager-tag-editor__badge is-assigned', text: t('通用_已选择_文本') });

            const meta = itemEl.descEl.createDiv('manager-tag-editor__meta');
            meta.createSpan({ text: t('设置_分类_插件使用数量', { count: usageCount }) });

            if (!isEditing) {
                itemEl.addExtraButton((cb) => {
                    cb.setIcon('pencil');
                    this.prepareIconButton(cb, t('通用_编辑项目_标签', { name: group.name || group.id }), 'manager-tag-editor__edit-button');
                    cb.onClick(() => {
                        this.selected = group.id;
                        this.reloadShowData();
                    });
                })
                itemEl.addToggle(toggle => {
                    toggle
                    .setValue(selected)
                    .onChange(async () => {
                        this.managerPlugin.group = this.managerPlugin.group === group.id ? '' : group.id;
                        await this.manager.savePluginAndExport(this.managerPlugin.id);
                        this.managerModal.reloadShowData();
                        this.reloadShowData();
                    });
                    toggle.toggleEl.addClass('manager-tag-editor__toggle');
                    toggle.toggleEl.setAttribute('aria-label', t(selected ? '通用_移除项目_标签' : '通用_选择项目_标签', { name: group.name || group.id }));
                })
            }
            if (isEditing) {
                itemEl.addColorPicker(cb => cb
                    .setValue(group.color)
                    .onChange((value) => {
                        group.color = value;
                        this.manager.saveSettings();
                        tag.setAttribute('style', this.manager.generateTagStyle(value, this.settings.GROUP_STYLE));
                    })
                )
                itemEl.addText(text => {
                    text
                    .setValue(group.name)
                    .onChange((value) => {
                        group.name = value;
                        tag.textContent = value || group.id;
                        this.manager.saveSettings();
                    });
                    text.inputEl.addClass('manager-editor__item-input');
                    text.inputEl.addClass('manager-tag-editor__name-input');
                    text.inputEl.setAttribute('aria-label', t('分组编辑_分组名称_标签'));
                })
                itemEl.addExtraButton((cb) => {
                    cb.setIcon('trash-2');
                    this.prepareIconButton(cb, usageCount > 0 ? t('设置_分类_仍有插件使用不可删除') : t('设置_分组设置_删除分组'), 'manager-tag-editor__delete-button');
                    cb.onClick(() => {
                        const hasTestGroup = this.settings.Plugins.some(plugin => plugin.group === group.id);
                        if (!hasTestGroup) {
                            this.manager.settings.GROUPS = this.manager.settings.GROUPS.filter(t => t.id !== group.id);
                            this.manager.saveSettings();
                            this.reloadShowData();
                            Commands(this.app, this.manager);
                            new Notice(this.manager.translator.t('设置_分组设置_通知_三'));
                        } else {
                            new Notice(this.manager.translator.t('设置_分组设置_通知_四'));
                        }
                    });
                })
                itemEl.addExtraButton((cb) => {
                    cb.setIcon('check');
                    this.prepareIconButton(cb, t('通用_完成编辑_文本'), 'manager-tag-editor__save-button');
                    cb.onClick(() => {
                        this.selected = '';
                        this.reloadShowData();
                        this.managerModal.reloadShowData();
                    });
                })
            }
        }
        if (this.add) {
            let id = '';
            let name = '';
            let color = this.pickDistinctColor(this.settings.GROUPS.map(g => g.color));
            const foodBar = new Setting(page).setClass('manager-bar__title');
            foodBar.settingEl.addClass('manager-tag-editor__add-panel');
            foodBar.nameEl.empty();
            foodBar.descEl.empty();
            const addTitle = foodBar.nameEl.createDiv('manager-tag-editor__add-title');
            const addIcon = addTitle.createSpan({ cls: 'manager-tag-editor__add-title-icon' });
            setIcon(addIcon, 'plus');
            addTitle.createSpan({ text: t('设置_分组设置_新增分组') });
            foodBar.descEl.setText(t('设置_分类_ID说明'));
            foodBar.addColorPicker(cb => cb
                .setValue(color)
                .onChange((value) => {
                    color = value;
                })
            )
            foodBar.addText(cb => cb
                .setPlaceholder('ID')
                .onChange((value) => { id = value; })
                .inputEl.addClass('manager-editor__item-input')
            )
            foodBar.addText(cb => cb
                .setPlaceholder(this.manager.translator.t('通用_名称_文本'))
                .onChange((value) => { name = value; })
                .inputEl.addClass('manager-editor__item-input')
            )
            foodBar.addExtraButton((cb) => {
                cb.setIcon('plus');
                this.prepareIconButton(cb, t('分组编辑_创建分组'), 'manager-tag-editor__save-button');
                cb.onClick(() => {
                    const nextId = id.trim();
                    const nextName = name.trim() || nextId;
                    const containsId = this.manager.settings.GROUPS.some(tag => tag.id === nextId);
                    if (!containsId && nextId !== '') {
                        if (color === '') color = this.pickDistinctColor(this.settings.GROUPS.map(g => g.color));
                        this.manager.settings.GROUPS.push({ id: nextId, name: nextName, color });
                        this.manager.saveSettings();
                        this.add = false;
                        this.reloadShowData();
                        Commands(this.app, this.manager);
                        new Notice(this.manager.translator.t('设置_分组设置_通知_一'));
                    } else {
                        new Notice(this.manager.translator.t('设置_分组设置_通知_二'));
                    }
                });
            })
        } else {
            // [底部行] 新增
            const foodBar = new Setting(page).setClass('manager-bar__title').setName(this.manager.translator.t('通用_新增_文本'));
            foodBar.settingEl.addClass('manager-tag-editor__add-trigger');
            foodBar.descEl.setText(t('分组编辑_创建全局分组'));
            const addButton = new ExtraButtonComponent(foodBar.controlEl)
            addButton.setIcon('circle-plus')
            this.prepareIconButton(addButton, t('设置_分组设置_新增分组'), 'manager-tag-editor__save-button');
            addButton.onClick(() => {
                this.add = true;
                this.reloadShowData();
            });
        }
    }

    private async reloadShowData() {
        let scrollTop = 0;
        const modalElement: HTMLElement = this.contentEl;
        scrollTop = modalElement.scrollTop;
        modalElement.empty();
        await this.showData();
        modalElement.scrollTo(0, scrollTop);
    }

    async onOpen() {
        await this.showHead();
        await this.showData();
    }

    async onClose() {
        this.contentEl.empty();
    }

    private pickDistinctColor(existing: string[]): string {
        const palette = ['#FF6B6B', '#4ECDC4', '#FFD166', '#A78BFA', '#48BB78', '#F472B6', '#38BDF8', '#F59E0B', '#22D3EE', '#F97316', '#10B981', '#E11D48', '#6366F1', '#14B8A6'];
        const toRgb = (hex: string) => {
            const clean = hex.replace('#', '');
            const num = parseInt(clean, 16);
            return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
        };
        const dist = (a: string, b: string) => {
            const [ar, ag, ab] = toRgb(a);
            const [br, bg, bb] = toRgb(b);
            return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
        };
        const MIN_DIST = 80;
        for (const c of palette) {
            const min = existing.length ? Math.min(...existing.map((ex) => dist(ex, c))) : Infinity;
            if (min === Infinity || min > MIN_DIST) return c;
        }
        return palette[0];
    }
}
