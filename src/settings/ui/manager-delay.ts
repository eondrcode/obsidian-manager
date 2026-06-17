import BaseSetting from "../base-setting";
import { Notice, setIcon, Setting } from "obsidian";

export default class ManagerDelay extends BaseSetting {
    private getDelayUsageCount(delayId: string): number {
        return this.settings.Plugins.reduce((count, plugin) => count + (plugin.delay === delayId ? 1 : 0), 0);
    }

    main(): void {
        const t = (k: string, vars?: Record<string, string | number | boolean | null | undefined>) => this.manager.translator.t(k, vars);
        let id = '';
        let name = '';
        let time = 0;

        const page = this.containerEl.createDiv('manager-setting-delay__container manager-taxonomy-setting');
        const usedCount = this.manager.settings.DELAYS.filter((delay) => this.getDelayUsageCount(delay.id) > 0).length;
        const header = page.createDiv('manager-setting-delay__header manager-taxonomy-setting__header');
        const headerMain = header.createDiv('manager-setting-delay__header-main manager-taxonomy-setting__header-main');
        const headerIcon = headerMain.createSpan({ cls: 'manager-setting-delay__header-icon manager-taxonomy-setting__header-icon' });
        setIcon(headerIcon, 'timer');
        const headerText = headerMain.createDiv('manager-setting-delay__header-text manager-taxonomy-setting__header-text');
        headerText.createDiv({ cls: 'manager-setting-delay__title manager-taxonomy-setting__title', text: t('设置_延迟设置_标题') });
        headerText.createDiv({ cls: 'manager-setting-delay__desc manager-taxonomy-setting__desc', text: t('设置_延迟设置_描述') });
        const stats = header.createDiv('manager-setting-delay__stats manager-taxonomy-setting__stats');
        const createStat = (label: string, value: number, icon: string) => {
            const stat = stats.createSpan({ cls: 'manager-setting-delay__stat manager-taxonomy-setting__stat' });
            const statIcon = stat.createSpan({ cls: 'manager-setting-delay__stat-icon manager-taxonomy-setting__stat-icon' });
            setIcon(statIcon, icon);
            stat.createSpan({ cls: 'manager-setting-delay__stat-label manager-taxonomy-setting__stat-label', text: label });
            stat.createSpan({ cls: 'manager-setting-delay__stat-value manager-taxonomy-setting__stat-value', text: `${value}` });
        };
        createStat(t('通用_全部_文本'), this.manager.settings.DELAYS.length, 'timer');
        createStat(t('通用_使用中_文本'), usedCount, 'check');

        const createItem = new Setting(page)
            .setName(t('通用_新增_文本'))
            .setDesc(t('设置_延迟设置_新增描述'));
        createItem.settingEl.addClass('manager-setting-delay__item');
        createItem.settingEl.addClass('manager-setting-delay__item--create');
        createItem.settingEl.addClass('manager-taxonomy-setting__row');
        createItem.settingEl.addClass('manager-taxonomy-setting__row--create');
        createItem.controlEl.addClass('manager-setting-delay__controls');
        createItem.controlEl.addClass('manager-taxonomy-setting__controls');
        createItem.addSlider(cb => cb
                .setLimits(0, 100, 1)
                .setValue(time)
                .onChange((value) => {
                    time = value;
                })
                .sliderEl.addClass('manager-setting-delay__slider')
            )
            .addText(cb => cb
                .setPlaceholder('ID')
                .onChange((value) => {
                    id = value;
                })
                .inputEl.addClass('manager-taxonomy-setting__input')
            )
            .addText(cb => cb
                .setPlaceholder(this.manager.translator.t('通用_名称_文本'))
                .onChange((value) => {
                    name = value;
                })
                .inputEl.addClass('manager-taxonomy-setting__input')
            )
            .addExtraButton(cb => cb
                .setIcon('plus')
                .setTooltip(t('设置_延迟设置_新增延迟'))
                .onClick(() => {
                    const nextId = id.trim();
                    const nextName = name.trim() || nextId;
                    const containsId = this.manager.settings.DELAYS.some(delay => delay.id === nextId);
                    if (!containsId && nextId !== '') {
                        this.manager.settings.DELAYS.push({ id: nextId, name: nextName, time });
                        void this.manager.saveSettings();
                        this.settingTab.delayDisplay();
                        new Notice(this.manager.translator.t('设置_延迟设置_通知_一'));
                    } else {
                        new Notice(this.manager.translator.t('设置_延迟设置_通知_二'));
                    }
                })
            )

        const list = page.createDiv('manager-setting-delay__list manager-taxonomy-setting__list');
        this.manager.settings.DELAYS.forEach((delay, index) => {
            const item = new Setting(list)
            const usageCount = this.getDelayUsageCount(delay.id);
            item.settingEl.addClass('manager-setting-delay__item')
            item.settingEl.addClass('manager-taxonomy-setting__row');
            item.settingEl.toggleClass('is-used', usageCount > 0);
            item.controlEl.addClass('manager-setting-delay__controls');
            item.controlEl.addClass('manager-taxonomy-setting__controls');
            item.nameEl.empty();
            item.descEl.empty();
            const titleRow = item.nameEl.createDiv('manager-setting-delay__item-title manager-taxonomy-setting__item-title');
            titleRow.createSpan({ cls: 'manager-setting-delay__preview manager-taxonomy-setting__preview', text: `${delay.time}s` });
            titleRow.createSpan({ cls: 'manager-setting-delay__name', text: delay.name || delay.id });
            titleRow.createSpan({ cls: 'manager-setting-delay__id manager-taxonomy-setting__id', text: delay.id });
            const meta = item.descEl.createDiv('manager-setting-delay__meta manager-taxonomy-setting__meta');
            meta.createSpan({ text: t('设置_分类_插件使用数量', { count: usageCount }) });
            meta.createSpan({ text: `#${index + 1}` });
            item.addSlider(cb => cb
                .setLimits(0, 100, 1)
                .setValue(delay.time)
                .onChange((value) => {
                    delay.time = value
                    void this.manager.saveSettings();
                    const preview = item.settingEl.querySelector('.manager-setting-delay__preview');
                    if (preview) preview.textContent = `${value}s`;
                })
                .sliderEl.addClass('manager-setting-delay__slider')
            )
            item.addText(cb => cb
                .setValue(delay.name)
                .onChange((value) => {
                    delay.name = value;
                    void this.manager.saveSettings();
                    const nameEl = item.settingEl.querySelector('.manager-setting-delay__name');
                    if (nameEl) nameEl.textContent = value || delay.id;
                })
                .inputEl.addClass('manager-taxonomy-setting__input')
            )
            item.addExtraButton(cb => cb
                .setIcon('trash-2')
                .setTooltip(usageCount > 0 ? t('设置_分类_仍有插件使用不可删除') : t('设置_延迟设置_删除延迟'))
                .onClick(() => {
                    const hasTestGroup = this.settings.Plugins.some(plugin => plugin.delay === delay.id);
                    if (!hasTestGroup) {
                        this.manager.settings.DELAYS = this.manager.settings.DELAYS.filter(t => t.id !== delay.id);
                        void this.manager.saveSettings();
                        this.settingTab.delayDisplay();
                        new Notice(this.manager.translator.t('设置_延迟设置_通知_三'));
                    } else {
                        new Notice(this.manager.translator.t('设置_延迟设置_通知_四'));
                    }
                })
            )
        });
    }
}
