import BaseSetting from "../base-setting";
import { DropdownComponent, Setting, ToggleComponent, TextComponent, TFolder } from "obsidian";
import Commands from "src/command";
// import { GROUP_STYLE, ITEM_STYLE, TAG_STYLE } from "src/data/data";

export default class ManagerBasis extends BaseSetting {

    main(): void {
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

        const persistenceBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_筛选持久化_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_筛选持久化_描述'));
        const persistenceToggle = new ToggleComponent(persistenceBar.controlEl);
        persistenceToggle.setValue(this.settings.PERSISTENCE);
        persistenceToggle.onChange((value) => {
            this.settings.PERSISTENCE = value;
            this.manager.saveSettings();
        });

        const debugBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_调试模式_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_调试模式_描述'));
        const debugToggle = new ToggleComponent(debugBar.controlEl);
        debugToggle.setValue(this.settings.DEBUG);
        debugToggle.onChange((value) => {
            this.settings.DEBUG = value;
            this.manager.saveSettings();
        });

        const startupCheckBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_启动检查更新_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_启动检查更新_描述'));
        const startupCheckToggle = new ToggleComponent(startupCheckBar.controlEl);
        startupCheckToggle.setValue(this.settings.STARTUP_CHECK_UPDATES);
        startupCheckToggle.onChange((value) => {
            this.settings.STARTUP_CHECK_UPDATES = value;
            this.manager.saveSettings();
        });

        const autoTakeoverBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_自动接管_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_自动接管_描述'));
        const autoTakeoverToggle = new ToggleComponent(autoTakeoverBar.controlEl);
        autoTakeoverToggle.setValue(this.settings.AUTO_TAKEOVER);
        autoTakeoverToggle.onChange((value) => {
            this.settings.AUTO_TAKEOVER = value;
            this.manager.saveSettings();
        });

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

        // 导出目录与前置提示
        const exportDirBar = new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_导出目录_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_导出目录_描述'));
        const exportDirInput = new TextComponent(exportDirBar.controlEl);
        exportDirInput.setPlaceholder(this.manager.translator.t('设置_基础设置_导出目录_示例'));
        exportDirInput.setValue(this.settings.EXPORT_DIR || "");

        exportDirInput.inputEl.addEventListener("blur", () => {
            exportDirInput.setValue(exportDirInput.getValue().trim());
        });

        exportDirBar.addButton((btn) => {
            btn.setButtonText(this.manager.translator.t('通用_保存_文本')).setCta();
            btn.onClick(() => {
                this.settings.EXPORT_DIR = exportDirInput.getValue().trim();
                this.manager.saveSettings();
                this.manager.setupExportWatcher();
                this.manager.exportAllPluginNotes();
            });
        });

        new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_基础设置_导出提示_标题'))
            .setDesc(this.manager.translator.t('设置_基础设置_导出提示_描述'));

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
