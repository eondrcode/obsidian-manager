import { App, PluginManifest } from "obsidian";
import Manager from "./main";
import { ManagerModal } from "./modal/manager-modal";
import { TroubleshootModal } from "./troubleshoot/troubleshoot-modal";

const Commands = (app: App, manager: Manager) => {
    manager.addCommand({
        id: 'manager-view',
        name: manager.translator.t('命令_管理面板_描述'),
        hotkeys: [
            {
                modifiers: ['Ctrl'],
                key: 'M',
            }
        ],
        callback: () => { new ManagerModal(app, manager).open() }
    });

    // 排查冲突命令
    manager.addCommand({
        id: 'troubleshoot-conflicts',
        name: manager.translator.t('排查_按钮_描述'),
        callback: () => { new TroubleshootModal(app, manager).open() }
    });

    if (manager.settings.DELAY) {
        // 单行命令
        if (manager.settings.COMMAND_ITEM) {
            const plugins: PluginManifest[] = Object.values(manager.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== manager.manifest.id) as PluginManifest[];
            plugins.forEach(plugin => {
                const mp = manager.settings.Plugins.find(mp => mp.id === plugin.id);
                if (mp) {
                    manager.addCommand({
                        id: `manager-${mp.id}`,
                        name: `${mp.enabled ? manager.translator.t('通用_关闭_文本') : manager.translator.t('通用_开启_文本')} ${mp.name} `,
                        callback: async () => {
                            if (mp.enabled) {
                                mp.enabled = false;
                                await manager.savePluginAndExport(mp.id);
                                await manager.appPlugins.disablePlugin(plugin.id);
                                Commands(app, manager);
                            } else {
                                mp.enabled = true;
                                await manager.savePluginAndExport(mp.id);
                                await manager.appPlugins.enablePlugin(plugin.id);
                                Commands(app, manager);
                            }
                        }
                    });
                }
            });
        }
        // 分组命令
        if (manager.settings.COMMAND_GROUP) {
            manager.settings.GROUPS.forEach((group) => {
                manager.addCommand({
                    id: `manager-${group.id}-enabled`,
                    name: `${manager.translator.t('命令行_一键启用_文本')} ${group.name}`,
                    callback: async () => {
                        const filteredPlugins = manager.settings.Plugins.filter(plugin => plugin.group === group.id);
                        filteredPlugins.forEach(async plugin => {
                            if (plugin && !plugin.enabled) {
                                await manager.appPlugins.enablePlugin(plugin.id);
                                plugin.enabled = true;
                                await manager.savePluginAndExport(plugin.id);
                            }
                        });
                        Commands(app, manager);
                    }
                });
                manager.addCommand({
                    id: `manager-${group.id}-disable`,
                    name: `${manager.translator.t('命令行_一键禁用_文本')} ${group.name}`,
                    callback: async () => {
                        const filteredPlugins = manager.settings.Plugins.filter(plugin => plugin.group === group.id);
                        filteredPlugins.forEach(async plugin => {
                            if (plugin && plugin.enabled) {
                                await manager.appPlugins.disablePlugin(plugin.id);
                                plugin.enabled = false;
                                await manager.savePluginAndExport(plugin.id);
                            }
                        });
                        Commands(app, manager);
                    }
                });
            });
        }
    } else {
        // 单行命令
        if (manager.settings.COMMAND_ITEM) {
            const plugins: PluginManifest[] = Object.values(manager.appPlugins.manifests).filter((pm: PluginManifest) => pm.id !== manager.manifest.id) as PluginManifest[];
            plugins.forEach(plugin => {
                const enabled = manager.appPlugins.enabledPlugins.has(plugin.id);
                manager.addCommand({
                    id: `manager-${plugin.id}`,
                    name: `${enabled ? manager.translator.t('命令行_禁用_文本') : manager.translator.t('命令行_启用_文本')} ${plugin.name} `,
                    callback: async () => {
                        if (enabled) {
                            await manager.appPlugins.disablePluginAndSave(plugin.id);
                            const mp = manager.settings.Plugins.find(p => p.id === plugin.id);
                            if (mp) mp.enabled = false;
                            await manager.savePluginAndExport(plugin.id);
                            Commands(app, manager);
                        } else {
                            await manager.appPlugins.enablePluginAndSave(plugin.id);
                            const mp = manager.settings.Plugins.find(p => p.id === plugin.id);
                            if (mp) mp.enabled = true;
                            await manager.savePluginAndExport(plugin.id);
                            Commands(app, manager);
                        }
                    }
                });

            });
        }
        // 分组命令
        if (manager.settings.COMMAND_GROUP) {
            manager.settings.GROUPS.forEach((group) => {
                manager.addCommand({
                    id: `manager-${group.id}-enabled`,
                    name: `${manager.translator.t('命令行_一键启用_文本')} ${group.name} ${manager.translator.t('命令行_分组_文本')}`,
                    callback: async () => {
                        const filteredPlugins = manager.settings.Plugins.filter(plugin => plugin.group === group.id);
                        filteredPlugins.forEach(async plugin => {
                            await manager.appPlugins.enablePluginAndSave(plugin.id);
                            const mp = manager.settings.Plugins.find(p => p.id === plugin.id);
                            if (mp) mp.enabled = true;
                            await manager.savePluginAndExport(plugin.id);
                        });
                        Commands(app, manager);
                    }
                });
                manager.addCommand({
                    id: `manager-${group.id}-disable`,
                    name: `${manager.translator.t('命令行_一键禁用_文本')} ${group.name} ${manager.translator.t('命令行_分组_文本')}`,
                    callback: async () => {
                        const filteredPlugins = manager.settings.Plugins.filter(plugin => plugin.group === group.id);
                        filteredPlugins.forEach(async plugin => {
                            await manager.appPlugins.disablePluginAndSave(plugin.id);
                            const mp = manager.settings.Plugins.find(p => p.id === plugin.id);
                            if (mp) mp.enabled = false;
                            await manager.savePluginAndExport(plugin.id);
                        });
                        Commands(app, manager);
                    }
                });
            });
        }
    }
}

export default Commands
