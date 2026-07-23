---
title: 插件操作
status: active
hue: 260
desc: 插件启停命令、状态快照、方案管理、命令面板集成
code: src/command.ts
related:
  - src/data/types.ts
---
# 插件操作

管理 Obsidian 命令面板中 BPM 注册的命令，以及通过命令执行的插件启停操作。

## 保证

- **静态命令**：注册以下固定命令：打开管理器（`manager-view`）、控制插件（`control-plugin`）、保存当前状态为方案（`save-command-profile`）、恢复上一状态（`restore-previous-command-state`）、排查冲突（`troubleshoot-conflicts`）。
- **动态命令**：根据用户设置可选注册以下命令：为每个插件注册启用/禁用开关命令（`COMMAND_ITEM`），为每个分组注册一键启用/禁用命令（`COMMAND_GROUP`），为每个标签注册一键启用/禁用命令（`COMMAND_TAG`），为已保存的方案注册应用命令（`COMMAND_PROFILE`）。
- **插件控制弹窗**：`PluginControlModal` 提供搜索插件 → 选择操作的两步式 SuggestModal 流程。支持的操作：切换、启用、禁用、单次启动、重启、打开设置、打开文件夹、打开仓库、复制 ID。
- **状态快照**：执行批量操作前自动保存当前启用状态快照，支持通过 `restore-previous-command-state` 命令一键恢复。快照包含操作标签以提示用户当时的操作上下文。
- **状态方案**：`save-command-profile` 命令可将当前所有插件的启用状态保存为命名方案。方案在设置中持久化，可通过命令一键应用。
- **分组/标签批量操作**：按分组或标签批量切换插件启用状态，操作自动快照以支持撤销。

## 边界

- 命令系统只控制插件的启用/禁用状态，不涉及插件的安装、卸载或配置修改。
- 延迟启动模式下，插件的启用状态由 `ManagerPlugin.enabled` 记录驱动，而非直接操作 `community-plugins.json`。
- `bpm-ignore` 标签的插件在命令系统中不可操作（`isActionablePlugin` 返回 false）。
