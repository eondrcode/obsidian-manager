import BaseSetting from "../base-setting";
import { Notice, Setting } from "obsidian";

export default class ManagerTag extends BaseSetting {
    main(): void {
        let id = '';
        let name = '';
        let color = this.manager.generateAutoColor(this.manager.settings.TAGS.map(t => t.color));
        new Setting(this.containerEl)
            .setHeading()
            .setName(this.manager.translator.t('通用_新增_文本'))
            .addColorPicker(cb => cb
                .setValue(color)
                .onChange((value) => {
                    color = value;
                })
            )
            .addText(cb => cb
                .setPlaceholder('ID')
                .onChange((value) => {
                    id = value;
                    this.manager.saveSettings();
                })
            )
            .addText(cb => cb
                .setPlaceholder(this.manager.translator.t('通用_名称_文本'))
                .onChange((value) => {
                    name = value;
                })
            )
            .addExtraButton(cb => cb
                .setIcon('plus')
                .onClick(() => {
                    const containsId = this.manager.settings.TAGS.some(tag => tag.id === id);
                    if (!containsId && id !== '') {
                        if (color === '') color = this.manager.generateAutoColor(this.manager.settings.TAGS.map(t => t.color));
                        this.manager.settings.TAGS.push({ id, name, color });
                        this.manager.saveSettings();
                        this.settingTab.tagDisplay();
                        new Notice(this.manager.translator.t('设置_标签设置_通知_一'));
                    } else {
                        new Notice(this.manager.translator.t('设置_标签设置_通知_二'));
                    }
                })
            )
        this.manager.settings.TAGS.forEach((tag, index) => {
            const item = new Setting(this.containerEl)
            item.setClass('manager-setting-tag__item')
            // item.setName(`${index + 1}. `)
            item.addColorPicker(cb => cb
                .setValue(tag.color)
                .onChange((value) => {
                    tag.color = value;
                    this.manager.saveSettings();
                    this.settingTab.tagDisplay();
                })
            )
            item.addText(cb => cb
                .setValue(tag.name)
                .onChange((value) => {
                    tag.name = value;
                    this.manager.saveSettings();
                }).inputEl.addEventListener('blur', () => {
                    this.settingTab.tagDisplay();
                })
            )
            item.addExtraButton(cb => cb
                .setIcon('trash-2')
                .onClick(() => {
                    const hasTestTag = this.settings.Plugins.some(plugin => plugin.tags && plugin.tags.includes(tag.id));
                    if (!hasTestTag) {
                        this.manager.settings.TAGS = this.manager.settings.TAGS.filter(t => t.id !== tag.id);
                        this.manager.saveSettings();
                        this.settingTab.tagDisplay();
                        new Notice(this.manager.translator.t('设置_标签设置_通知_三'));
                    } else {
                        new Notice(this.manager.translator.t('设置_标签设置_通知_四'));
                    }
                })
            )
            const tagEl = this.manager.createTag(tag.name, tag.color, this.settings.TAG_STYLE);
            item.nameEl.appendChild(tagEl);
            item.nameEl.appendText(` [${tag.id}]`);
        });

    }
}
