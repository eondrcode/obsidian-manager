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
            .setName("隐藏“bpm安装”标签")
            .setDesc("开启后列表不显示自动添加的 bpm 安装标签，仅隐藏展示。");
        const hideBpmTagToggle = new ToggleComponent(hideBpmTagBar.controlEl);
        hideBpmTagToggle.setValue(this.settings.HIDE_BPM_TAG);
        hideBpmTagToggle.onChange((value) => {
            this.settings.HIDE_BPM_TAG = value;
            this.manager.saveSettings();
            this.manager.managerModal?.reloadShowData();
        });

        // 导出目录与前置提示
        const exportDirBar = new Setting(this.containerEl)
            .setName("插件信息导出目录")
            .setDesc("相对库路径的文件夹，用于导出 BPM 插件信息（支持 Base）。不会在输入时立刻写入，需点击“保存设置”。");
        const exportDirInput = new TextComponent(exportDirBar.controlEl);
        exportDirInput.setPlaceholder("例如: BPM-Export");
        exportDirInput.setValue(this.settings.EXPORT_DIR || "");

        exportDirInput.inputEl.addEventListener("blur", () => {
            exportDirInput.setValue(exportDirInput.getValue().trim());
        });

        exportDirBar.addButton((btn) => {
            btn.setButtonText("保存设置").setCta();
            btn.onClick(() => {
                this.settings.EXPORT_DIR = exportDirInput.getValue().trim();
                this.manager.saveSettings();
                this.manager.setupExportWatcher();
                this.manager.exportAllPluginNotes();
            });
        });

        new Setting(this.containerEl)
            .setName("前置约定（frontmatter 键名）")
            .setDesc("只读: bpm_ro_id/group/tags/delay/installed_via_bpm/updated；可写: bpm_rw_name/desc/note/enabled；条件可写: bpm_rwc_repo（仅官方未匹配且非 BPM 安装时）。");

        const tokenBar = new Setting(this.containerEl)
            .setName("GitHub API Token")
            .setDesc("用于从 GitHub 下载插件/主题，避免频繁的 API 限流。可留空。");
        const tokenInput = new TextComponent(tokenBar.controlEl);
        tokenInput.setPlaceholder("ghp_xxx");
        tokenInput.setValue(this.settings.GITHUB_TOKEN || "");
        tokenInput.onChange((value) => {
            this.settings.GITHUB_TOKEN = value.trim();
            this.manager.saveSettings();
        });

        new Setting(this.containerEl)
            .setName(this.manager.translator.t('设置_提示_一_标题'))
            .setDesc(this.manager.translator.t('设置_提示_一_描述'));
    }
}
