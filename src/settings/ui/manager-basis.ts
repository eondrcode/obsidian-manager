import BaseSetting from "../base-setting";
import { DropdownComponent, Setting, ToggleComponent, TextComponent } from "obsidian";
import Commands from "src/command";
// import { GROUP_STYLE, ITEM_STYLE, TAG_STYLE } from "src/data/data";

export default class ManagerBasis extends BaseSetting {

    main(): void {
        const heading = (key: string) => {
            new Setting(this.containerEl)
                .setHeading()
                .setName(this.manager.translator.t(key));
        };

        heading('设置_基础设置_分组_常规');

        const languageBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_语言_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_语言_描述'));
        const languageDropdown = new DropdownComponent(languageBar.controlEl);
        languageDropdown.addOptions(this.manager.translator.language);
        languageDropdown.setValue(this.settings.LANGUAGE);
        languageDropdown.onChange((value) => {
            this.settings.LANGUAGE = value;
            this.manager.saveSettings();
            this.settingTab.basisDisplay();
            Commands(this.app, this.manager);
            this.settingTab.display(); // 重新渲染整个设置界面
            this.display(); // 保持当前内容区的刷新
        });

        const persistenceBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_筛选持久化_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_筛选持久化_描述'));
        const persistenceToggle = new ToggleComponent(persistenceBar.controlEl);
        persistenceToggle.setValue(this.settings.PERSISTENCE);
        persistenceToggle.onChange((value) => {
            const managerModal = this.manager.managerModal;
            if (value) {
                managerModal?.persistCurrentFilters();
            }
            this.settings.PERSISTENCE = value;
            if (!value && managerModal) {
                managerModal.usePersistedFiltersAsSessionFilters();
            }
            this.manager.saveSettings();
        });

        heading('设置_基础设置_分组_启动接管');

        const DelayBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_延时启动_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_延时启动_描述'));
        const DelayToggle = new ToggleComponent(DelayBar.controlEl);
        DelayToggle.setValue(this.settings.DELAY);
        DelayToggle.onChange((value) => {
            this.settings.DELAY = value;
            this.manager.saveSettings();
            value ? this.manager.enableDelaysForAllPlugins() : this.manager.disableDelaysForAllPlugins();
            this.settingTab.display(); // 重新渲染整个设置界面
            this.display(); // 保持当前内容区的刷新
        });

        const autoTakeoverBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_自动接管_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_自动接管_描述'));
        const autoTakeoverToggle = new ToggleComponent(autoTakeoverBar.controlEl);
        autoTakeoverToggle.setValue(this.settings.AUTO_TAKEOVER);
        autoTakeoverToggle.setDisabled(!this.settings.DELAY);
        autoTakeoverToggle.onChange((value) => {
            if (!this.settings.DELAY) return;
            this.settings.AUTO_TAKEOVER = value;
            this.manager.saveSettings();
        });

        heading('设置_基础设置_分组_更新来源');

        const startupCheckBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_启动检查更新_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_启动检查更新_描述'));
        const startupCheckToggle = new ToggleComponent(startupCheckBar.controlEl);
        startupCheckToggle.setValue(this.settings.STARTUP_CHECK_UPDATES);
        startupCheckToggle.onChange((value) => {
            this.settings.STARTUP_CHECK_UPDATES = value;
            this.manager.saveSettings();
        });

        const sourceStartupCheckBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_来源启动检查更新_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_来源启动检查更新_描述'));
        const sourceStartupCheckToggle = new ToggleComponent(sourceStartupCheckBar.controlEl);
        sourceStartupCheckToggle.setValue(this.settings.SOURCE_STARTUP_CHECK_UPDATES);
        sourceStartupCheckToggle.onChange((value) => {
            this.settings.SOURCE_STARTUP_CHECK_UPDATES = value;
            this.manager.saveSettings();
        });

        const sourceAutoUpdateBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_来源自动更新_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_来源自动更新_描述'));
        const sourceAutoUpdateToggle = new ToggleComponent(sourceAutoUpdateBar.controlEl);
        sourceAutoUpdateToggle.setValue(this.settings.SOURCE_AUTO_UPDATE);
        sourceAutoUpdateToggle.onChange((value) => {
            this.settings.SOURCE_AUTO_UPDATE = value;
            this.manager.saveSettings();
        });

        heading('设置_基础设置_分组_界面展示');

        const hideBpmTagBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_隐藏BPM标签_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_隐藏BPM标签_描述'));
        const hideBpmTagToggle = new ToggleComponent(hideBpmTagBar.controlEl);
        hideBpmTagToggle.setValue(this.settings.HIDE_BPM_TAG);
        hideBpmTagToggle.onChange((value) => {
            this.settings.HIDE_BPM_TAG = value;
            this.manager.saveSettings();
            this.manager.managerModal?.reloadShowData();
        });

        const ribbonManagerBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_边栏编排_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_边栏编排_描述'));
        const ribbonManagerToggle = new ToggleComponent(ribbonManagerBar.controlEl);
        ribbonManagerToggle.setValue(this.settings.RIBBON_MANAGER_ENABLED !== false);
        ribbonManagerToggle.onChange(async (value) => {
            this.settings.RIBBON_MANAGER_ENABLED = value;
            await this.manager.saveSettings();
            await this.manager.refreshRibbonManagerFeature();
        });

        heading('设置_基础设置_分组_命令');

        const CommandItemBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_单独命令_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_单独命令_描述'));
        const CommandItemToggle = new ToggleComponent(CommandItemBar.controlEl);
        CommandItemToggle.setValue(this.settings.COMMAND_ITEM);
        CommandItemToggle.onChange((value) => {
            this.settings.COMMAND_ITEM = value;
            this.manager.saveSettings();
            Commands(this.app, this.manager);
        });

        const CommandGroupBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_分组命令_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_分组命令_描述'));
        const CommandGroupToggle = new ToggleComponent(CommandGroupBar.controlEl);
        CommandGroupToggle.setValue(this.settings.COMMAND_GROUP);
        CommandGroupToggle.onChange((value) => {
            this.settings.COMMAND_GROUP = value;
            this.manager.saveSettings();
            Commands(this.app, this.manager);
        });

        heading('设置_基础设置_分组_开发网络');

        const debugBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_调试模式_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_调试模式_描述'));
        const debugToggle = new ToggleComponent(debugBar.controlEl);
        debugToggle.setValue(this.settings.DEBUG);
        debugToggle.onChange((value) => {
            this.settings.DEBUG = value;
            this.manager.saveSettings();
        });

        const tokenBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_GITHUB_TOKEN_标题'))
            .setDesc(`${this.manager.translator.t('设置_基础设置_GITHUB_TOKEN_描述')} (${this.manager.translator.t('设置_基础设置_GITHUB_TOKEN_权限')})`);
        const tokenInput = new TextComponent(tokenBar.controlEl);
        tokenInput.setPlaceholder("ghp_xxx");
        tokenInput.setValue(this.settings.GITHUB_TOKEN || "");
        tokenInput.onChange((value) => {
            this.settings.GITHUB_TOKEN = value.trim();
            this.manager.saveSettings();
        });

    }
}
