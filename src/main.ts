import { ObsidianProtocolData, Plugin, PluginManifest, Workspace } from 'obsidian';
import { DEFAULT_SETTINGS, ManagerSettings } from './settings/data';
import { ManagerSettingTab } from './settings';
import { Translator } from './lang/inxdex';
import { ManagerModal } from './modal/manager-modal';
import Commands from './command';
import Agreement from 'src/agreement';
import { RepoResolver, ensureBpmTagExists, BPM_TAG_ID } from './repo-resolver';

export default class Manager extends Plugin {
    public settings: ManagerSettings;
    public managerModal: ManagerModal;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public appPlugins: any;
    public appWorkspace: Workspace;
    public translator: Translator;

    public agreement: Agreement;
    public repoResolver: RepoResolver;

    public async onload() {
        // @ts-ignore
        this.appPlugins = this.app.plugins;
        this.appWorkspace = this.app.workspace;

        console.log(`%c ${this.manifest.name} %c v${this.manifest.version} `, `padding: 2px; border-radius: 2px 0 0 2px; color: #fff; background: #5B5B5B;`, `padding: 2px; border-radius: 0 2px 2px 0; color: #fff; background: #409EFF;`);
        await this.loadSettings();
        ensureBpmTagExists(this);
        this.ensureBpmTagAndRecords();
        this.repoResolver = new RepoResolver(this);
        // 初始化语言系统
        this.translator = new Translator(this);
        // 初始化侧边栏图标
        this.addRibbonIcon('folder-cog', this.translator.t('通用_管理器_文本'), () => { this.managerModal = new ManagerModal(this.app, this); this.managerModal.open(); });
        // 初始化设置界面
        this.addSettingTab(new ManagerSettingTab(this.app, this));
        this.settings.DELAY ? this.enableDelay() : this.disableDelay();
        Commands(this.app, this);

        this.agreement = new Agreement(this);

        this.registerObsidianProtocolHandler("BPM-plugin-install", async (params: ObsidianProtocolData) => {
            await this.agreement.parsePluginInstall(params);
        });
        this.registerObsidianProtocolHandler("BPM-plugin-github", async (params: ObsidianProtocolData) => {
            await this.agreement.parsePluginGithub(params);
        });
    }

    public async onunload() {
        if (this.settings.DELAY) this.disableDelaysForAllPlugins();
    }

    public async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    public async saveSettings() { await this.saveData(this.settings); }

    public ensureBpmTagAndRecords() {
        ensureBpmTagExists(this);
        // 确保 BPM 安装的插件拥有标签
        this.settings.BPM_INSTALLED.forEach((id) => {
            const mp = this.settings.Plugins.find(p => p.id === id);
            if (mp && !mp.tags.includes(BPM_TAG_ID)) mp.tags.push(BPM_TAG_ID);
        });
    }

    // 关闭延时 调用
    public disableDelay() {
        const plugins = Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manifest.id) as PluginManifest[];
        this.synchronizePlugins(plugins);
    }

    // 开启延时 调用
    public enableDelay() {
        const plugins = Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manifest.id) as PluginManifest[];
        // 同步插件
        this.synchronizePlugins(plugins);
        // 开始延时启动插件
        plugins.forEach((plugin: PluginManifest) => this.startPluginWithDelay(plugin.id));
    }

    // 为所有插件启动延迟
    public enableDelaysForAllPlugins() {
        // 获取所有插件
        const plugins = Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manifest.id) as PluginManifest[];
        // 同步插件
        this.synchronizePlugins(plugins);

        plugins.forEach(async (plugin: PluginManifest) => {
            // 插件状态
            const isEnabled = this.appPlugins.enabledPlugins.has(plugin.id);
            if (isEnabled) {
                // 1. 关闭插件
                await this.appPlugins.disablePluginAndSave(plugin.id);
                // 2. 开启插件
                await this.appPlugins.enablePlugin(plugin.id);
                // 3. 切换配置状态
                const mp = this.settings.Plugins.find(p => p.id === plugin.id);
                if (mp) mp.enabled = true;
                // 4. 保存状态
                this.saveSettings();
            } else {
                // 1. 切换配置文件
                const mp = this.settings.Plugins.find(p => p.id === plugin.id);
                if (mp) mp.enabled = false;
                // 2. 保存状态
                this.saveSettings();
            }
        });
    }

    // 为所有插件关闭延迟
    public disableDelaysForAllPlugins() {
        const plugins = Object.values(this.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== this.manifest.id);
        plugins.forEach(async (pm: PluginManifest) => {
            const plugin = this.settings.Plugins.find(p => p.id === pm.id)
            if (plugin) {
                if (plugin.enabled) {
                    await this.appPlugins.disablePlugin(pm.id);
                    await this.appPlugins.enablePluginAndSave(pm.id);
                }
            }
        });
    }

    // 延时启动指定插件
    private startPluginWithDelay(id: string) {
        const plugin = this.settings.Plugins.find(p => p.id === id);
        if (plugin && plugin.enabled) {
            const delay = this.settings.DELAYS.find(item => item.id === plugin.delay);
            const time = delay ? delay.time : 0;
            setTimeout(() => { this.appPlugins.enablePlugin(id); }, time * 1000);
        }
    }

    // 同步插件到配置文件
    public synchronizePlugins(p1: PluginManifest[]) {
        const p2 = this.settings.Plugins;
        p2.forEach(p2Item => {
            if (!p1.some(p1Item => p1Item.id === p2Item.id)) {
                this.settings.Plugins = this.settings.Plugins.filter(pm => pm.id !== p2Item.id);
            }
        });
        p1.forEach(p1Item => {
            if (!p2.some(p2Item => p2Item.id === p1Item.id)) {
                const isEnabled = this.appPlugins.enabledPlugins.has(p1Item.id);
                this.settings.Plugins.push({
                    'id': p1Item.id,
                    'name': p1Item.name,
                    'desc': p1Item.description,
                    'group': '',
                    'tags': [],
                    'enabled': isEnabled,
                    'delay': '',
                    'note': ''
                });
            }
            const mp = this.settings.Plugins.find(pm => pm.id === p1Item.id);
            if (mp && this.settings.BPM_INSTALLED.includes(p1Item.id) && !mp.tags.includes(BPM_TAG_ID)) {
                mp.tags.push(BPM_TAG_ID);
            }
        });
        // 保存设置
        this.saveSettings();
    }

    // 工具函数
    public createTag(text: string, color: string, type: string) {
        const style = this.generateTagStyle(color, type);
        const tag = createEl('span', {
            text: text,
            cls: 'manager-tag',
            attr: { 'style': style }
        })
        return tag;
    }
    public generateTagStyle(color: string, type: string) {
        let style;
        const [r, g, b] = this.hexToRgbArray(color);
        switch (type) {
            case 'a':
                style = `color: #fff; background-color: ${color}; border-color: ${color};`;
                break;
            case 'b':
                style = `color: ${color}; background-color: transparent; border-color: ${color};`;
                break;
            case 'c':
                style = `color: ${color}; background-color: rgba(${r}, ${g}, ${b}, 0.3); border-color: ${color};`;
                break;
            case 'd':
                style = `color: ${color}; background-color: ${this.adjustColorBrightness(color, 50)}; border-color: ${this.adjustColorBrightness(color, 50)};`;
                break;
            default:
                style = `background-color: transparent;border-style: dashed;`;
        }
        return style;
    }
    public hexToRgbArray(hex: string) {
        const rgb = parseInt(hex.slice(1), 16);
        const r = (rgb >> 16);
        const g = ((rgb >> 8) & 0x00FF);
        const b = (rgb & 0x0000FF);
        return [r, g, b];
    }
    public adjustColorBrightness(hex: string, amount: number) {
        const rgb = parseInt(hex.slice(1), 16);
        const r = Math.min(255, Math.max(0, ((rgb >> 16) & 0xFF) + amount));
        const g = Math.min(255, Math.max(0, ((rgb >> 8) & 0xFF) + amount));
        const b = Math.min(255, Math.max(0, (rgb & 0xFF) + amount));
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
    }
}
