import BaseSetting from "../base-setting";
import { Notice, Setting } from "obsidian";
import Commands from "src/command";

export default class ManagerGroup extends BaseSetting {
    main(): void {
        let id = '';
        let name = '';
        let color = this.manager.generateAutoColor(this.manager.settings.GROUPS.map(g => g.color));
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
                    const containsId = this.manager.settings.GROUPS.some(tag => tag.id === id);
                    if (!containsId && id !== '') {
                        if (color === '') color = this.manager.generateAutoColor(this.manager.settings.GROUPS.map(g => g.color));
                        this.manager.settings.GROUPS.push({ id, name, color });
                        this.manager.saveSettings();
                        this.settingTab.groupDisplay();
                        Commands(this.app, this.manager);
                        new Notice(this.manager.translator.t('设置_分组设置_通知_一'));
                    } else {
                        new Notice(this.manager.translator.t('设置_分组设置_通知_二'));
                    }
                })
            )

        this.manager.settings.GROUPS.forEach((group, index) => {
            const item = new Setting(this.containerEl)
            item.settingEl.addClass('manager-setting-group__item')
            // item.setName(`${index + 1}. `)
            item.addColorPicker(cb => cb
                .setValue(group.color)
                .onChange((value) => {
                    group.color = value;
                    this.manager.saveSettings();
                    this.settingTab.groupDisplay();
                })
            )
            item.addText(cb => cb
                .setValue(group.name)
                .onChange((value) => {
                    group.name = value;
                    this.manager.saveSettings();
                }).inputEl.addEventListener('blur', () => {
                    this.settingTab.groupDisplay();
                })
            )
            item.addExtraButton(cb => cb
                .setIcon('trash-2')
                .onClick(() => {
                    const hasTestGroup = this.settings.Plugins.some(plugin => plugin.group === group.id);
                    if (!hasTestGroup) {
                        this.manager.settings.GROUPS = this.manager.settings.GROUPS.filter(t => t.id !== group.id);
                        this.manager.saveSettings();
                        this.settingTab.groupDisplay();
                        Commands(this.app, this.manager);
                        new Notice(this.manager.translator.t('设置_分组设置_通知_三'));
                    } else {
                        new Notice(this.manager.translator.t('设置_分组设置_通知_四'));
                    }
                })
            )
            const tagEl = this.manager.createTag(group.name, group.color, this.settings.GROUP_STYLE);
            item.nameEl.appendChild(tagEl);
            item.nameEl.appendText(` [${group.id}]`);
        });
    }
}
