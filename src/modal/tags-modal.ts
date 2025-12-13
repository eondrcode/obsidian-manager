import { App, ExtraButtonComponent, Modal, Notice, Setting } from 'obsidian';
import { ManagerSettings } from '../settings/data';
import Manager from 'main';
import { ManagerModal } from './manager-modal';
import { ManagerPlugin } from 'src/data/types';
import Commands from 'src/command';
import { BPM_TAG_ID } from 'src/repo-resolver';

export class TagsModal extends Modal {
    settings: ManagerSettings;
    manager: Manager;
    managerModal: ManagerModal;
    managerPlugin: ManagerPlugin;
    selected: string;
    add: boolean;
    private defaultTagColor = '';

    constructor(app: App, manager: Manager, managerModal: ManagerModal, managerPlugin: ManagerPlugin) {
        super(app);
        this.settings = manager.settings;
        this.manager = manager;
        this.managerModal = managerModal;
        this.managerPlugin = managerPlugin;
        this.selected = '';
        this.add = false;
    }

    private async showHead() {
        //@ts-ignore
        const modalEl: HTMLElement = this.contentEl.parentElement;
        modalEl.addClass('manager-editor__container');
        modalEl.removeChild(modalEl.getElementsByClassName('modal-close-button')[0]);
        this.titleEl.parentElement?.addClass('manager-container__header');
        this.contentEl.addClass('manager-item-container');
        // [标题行]
        const titleBar = new Setting(this.titleEl).setClass('manager-bar__title').setName(this.managerPlugin.name);
        // [标题行] 关闭按钮
        const closeButton = new ExtraButtonComponent(titleBar.controlEl)
        closeButton.setIcon('circle-x')
        closeButton.onClick(() => this.close());
    }

    private async showData() {
        // 预先生成缺省颜色，避免与现有标签颜色过近
        if (!this.defaultTagColor) {
            this.defaultTagColor = this.pickDistinctColor(this.settings.TAGS.map(t => t.color));
        }
        for (const tag of this.settings.TAGS) {
            const itemEl = new Setting(this.contentEl)
            itemEl.setClass('manager-editor__item')
            if (this.selected == '' || this.selected != tag.id) {
                itemEl.addExtraButton(cb => cb
                    .setIcon('settings')
                    .setDisabled(tag.id === BPM_TAG_ID)
                    .onClick(() => {
                        this.selected = tag.id;
                        this.reloadShowData();
                    })
                )
                itemEl.addToggle(cb => cb
                    .setValue(this.managerPlugin.tags.includes(tag.id))
                    .setDisabled(tag.id === BPM_TAG_ID)
                    .onChange(async (isChecked) => {
                        if (isChecked) {
                            // 添加开启的标签
                            if (!this.managerPlugin.tags.includes(tag.id)) {
                                this.managerPlugin.tags.push(tag.id);
                            }
                        } else {
                            // 移除关闭的标签
                            this.managerPlugin.tags = this.managerPlugin.tags.filter(t => t !== tag.id);
                        }
                        await this.manager.savePluginAndExport(this.managerPlugin.id);
                        this.managerModal.reloadShowData();
                    })
                );
                const tempEl = createSpan({ cls: 'manager-item__name-group' });
                itemEl.nameEl.appendChild(tempEl);
                const tagEl = this.manager.createTag(tag.name, tag.color, this.settings.TAG_STYLE);
                tempEl.appendChild(tagEl);
            }
            if (this.selected != '' && this.selected == tag.id) {
                if (tag.id === BPM_TAG_ID) {
                    this.selected = '';
                    continue;
                }
                itemEl.addColorPicker(cb => cb
                    .setValue(tag.color)
                    .onChange((value) => {
                        tag.color = value;
                        this.manager.saveSettings();
                        this.reloadShowData();
                    })
                )
                itemEl.addText(cb => cb
                    .setValue(tag.name)
                    .onChange((value) => {
                        tag.name = value;
                        this.manager.saveSettings();
                    })
                    .inputEl.addClass('manager-editor__item-input')
                )
                itemEl.addExtraButton(cb => cb
                    .setIcon('trash-2')
                    .setDisabled(tag.id === BPM_TAG_ID)
                    .onClick(() => {
                        const hasTestTag = this.settings.Plugins.some(plugin => plugin.tags && plugin.tags.includes(tag.id));
                        if (!hasTestTag) {
                            this.manager.settings.TAGS = this.manager.settings.TAGS.filter(t => t.id !== tag.id);
                            this.manager.saveSettings();
                            this.reloadShowData();
                            Commands(this.app, this.manager);
                            new Notice(this.manager.translator.t('设置_标签设置_通知_三'));
                        } else {
                            new Notice(this.manager.translator.t('设置_标签设置_通知_四'));
                        }
                    })
                )

                itemEl.addExtraButton(cb => cb
                    .setIcon('save')
                    .onClick(() => {
                        this.selected = '';
                        this.reloadShowData();
                        this.managerModal.reloadShowData();
                    })
                )
                const groupEl = createSpan({ cls: 'manager-item__name-group' });
                itemEl.nameEl.appendChild(groupEl);
                const tagEl = this.manager.createTag(tag.name, tag.color, this.settings.TAG_STYLE);
                groupEl.appendChild(tagEl);
            }
        }
        if (this.add) {
            let id = '';
            let name = '';
            let color = this.pickDistinctColor(this.settings.TAGS.map(t => t.color));
            const foodBar = new Setting(this.contentEl).setClass('manager-bar__title');
            foodBar.infoEl.remove();
            foodBar.addColorPicker(cb => cb
                .setValue(color)
                .onChange((value) => { color = value; })
            )
            foodBar.addText(cb => cb
                .setPlaceholder('ID')
                .onChange((value) => { id = value; this.manager.saveSettings(); })
                .inputEl.addClass('manager-editor__item-input')
            )
            foodBar.addText(cb => cb
                .setPlaceholder(this.manager.translator.t('通用_名称_文本'))
                .onChange((value) => { name = value; })
                .inputEl.addClass('manager-editor__item-input')
            )
            foodBar.addExtraButton(cb => cb
                .setIcon('plus')
                .onClick(() => {
                    const containsId = this.manager.settings.TAGS.some(tag => tag.id === id);
                    if (!containsId && id !== '' && id !== BPM_TAG_ID) {
                        if (color === '') color = this.pickDistinctColor(this.settings.TAGS.map(t => t.color));
                        this.manager.settings.TAGS.push({ id, name, color });
                        this.manager.saveSettings();
                        this.add = false;
                        this.reloadShowData();
                        Commands(this.app, this.manager);
                        new Notice(this.manager.translator.t('设置_标签设置_通知_一'));
                    } else {
                        new Notice(this.manager.translator.t('设置_标签设置_通知_二'));
                    }
                })
            )
        } else {
            // [底部行] 新增
            const foodBar = new Setting(this.contentEl).setClass('manager-bar__title').setName(this.manager.translator.t('通用_新增_文本'));
            const addButton = new ExtraButtonComponent(foodBar.controlEl)
            addButton.setIcon('circle-plus')
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
