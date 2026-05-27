import BaseSetting from "../base-setting";
import { DropdownComponent, Setting, ToggleComponent } from "obsidian";
import Commands from "src/command";
import { PluginOverviewLayout } from "../data";
// import { GROUP_STYLE, ITEM_STYLE, TAG_STYLE } from "src/data/data";

export default class ManagerBasis extends BaseSetting {
    private PLUGIN_OVERVIEW_LAYOUT = {
        'list': this.manager.translator.t('设置_样式设置_插件总览布局_选项_列表'),
        'two-column': this.manager.translator.t('设置_样式设置_插件总览布局_选项_双列'),
    }
    private ITEM_STYLE = {
        'alwaysExpand': this.manager.translator.t('设置_基础设置_目录样式_选项_一'),
        'neverExpand': this.manager.translator.t('设置_基础设置_目录样式_选项_二'),
        'hoverExpand': this.manager.translator.t('设置_基础设置_目录样式_选项_三'),
        'clickExpand': this.manager.translator.t('设置_基础设置_目录样式_选项_四'),
    }
    private GROUP_STYLE = {
        'a': this.manager.translator.t('设置_基础设置_分组样式_选项_一'),
        'b': this.manager.translator.t('设置_基础设置_分组样式_选项_二'),
        'c': this.manager.translator.t('设置_基础设置_分组样式_选项_三'),
        'd': this.manager.translator.t('设置_基础设置_分组样式_选项_四')
    }
    private TAG_STYLE = {
        'a': this.manager.translator.t('设置_基础设置_标签样式_选项_一'),
        'b': this.manager.translator.t('设置_基础设置_标签样式_选项_二'),
        'c': this.manager.translator.t('设置_基础设置_标签样式_选项_三'),
        'd': this.manager.translator.t('设置_基础设置_标签样式_选项_四')
    }


    main(): void {

        const overviewLayoutBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_样式设置_插件总览布局_标题'))
            .setDesc(this.manager.translator.t('设置_样式设置_插件总览布局_描述'));
        const overviewLayoutDropdown = new DropdownComponent(overviewLayoutBar.controlEl);
        overviewLayoutDropdown.addOptions(this.PLUGIN_OVERVIEW_LAYOUT);
        overviewLayoutDropdown.setValue(this.settings.PLUGIN_OVERVIEW_LAYOUT || 'list');
        overviewLayoutDropdown.onChange((value) => {
            this.settings.PLUGIN_OVERVIEW_LAYOUT = value as PluginOverviewLayout;
            this.manager.saveSettings();
        });

        const itemStyleBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_目录样式_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_目录样式_描述'));
        const itemStyleDropdown = new DropdownComponent(itemStyleBar.controlEl);
        itemStyleDropdown.addOptions(this.ITEM_STYLE);
        itemStyleDropdown.setValue(this.settings.ITEM_STYLE);
        itemStyleDropdown.onChange((value) => {
            this.settings.ITEM_STYLE = value;
            this.manager.saveSettings();
        });

        const groupStyleBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_分组样式_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_分组样式_描述'));
        const groupStyleDropdown = new DropdownComponent(groupStyleBar.controlEl);
        groupStyleDropdown.addOptions(this.GROUP_STYLE);
        groupStyleDropdown.setValue(this.settings.GROUP_STYLE);
        groupStyleDropdown.onChange((value) => {
            this.settings.GROUP_STYLE = value;
            this.manager.saveSettings();
        });

        const tagStyleBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_标签样式_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_标签样式_描述'));
        const tagStyleDropdown = new DropdownComponent(tagStyleBar.controlEl);
        tagStyleDropdown.addOptions(this.TAG_STYLE);
        tagStyleDropdown.setValue(this.settings.TAG_STYLE);
        tagStyleDropdown.onChange((value) => {
            this.settings.TAG_STYLE = value;
            this.manager.saveSettings();
        });

        const topBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_界面居中_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_界面居中_描述'));
        const topToggle = new ToggleComponent(topBar.controlEl);
        topToggle.setValue(this.settings.CENTER);
        topToggle.onChange((value) => {
            this.settings.CENTER = value;
            this.manager.saveSettings();
        });

        const fadeOutDisabledPluginsBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_淡化插件_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_淡化插件_描述'));
        const fadeOutDisabledPluginsToggle = new ToggleComponent(fadeOutDisabledPluginsBar.controlEl);
        fadeOutDisabledPluginsToggle.setValue(this.settings.FADE_OUT_DISABLED_PLUGINS);
        fadeOutDisabledPluginsToggle.onChange((value) => {
            this.settings.FADE_OUT_DISABLED_PLUGINS = value;
            this.manager.saveSettings();
        });

    }
}
