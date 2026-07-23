---
title: project
status: active
hue: 45
desc: Better Add-on Manager (BPM) — 增强的 Obsidian 插件管理器
code: main.ts
related:
  - src/main.ts
  - src/obsidian-internals.ts
  - src/vault-share.ts
  - src/electron.d.ts
  - manifest.json
---
# project — Better Add-on Manager (BPM)

本项目是一个 Obsidian 社区插件（id: `better-plugins-manager`），为重度依赖插件的 Obsidian 库提供超越原生启/停开关的管理能力。

## 边界与保证

- BPM 作为 Obsidian 插件运行，遵循 Obsidian 插件 API 的完整生命周期（`onload` / `onunload`）。它不修改 Obsidian 核心文件，不注入原生代码。
- BPM 的持久化数据仅保存在 Obsidian 的 `data.json` 插件数据目录中，以及辅助缓存文件 `better-plugins-manager-community-plugins-cache.json`。BPM 不会读取或修改用户笔记内容。
- 所有对 GitHub 的外部网络请求都用于用户可见的功能：获取社区插件列表、检查更新、下载安装包。BPM 不会在用户不知情的情况下发送数据。
- BPM 没有远程后端、没有用户账户体系、没有遥测收集。
- 平台支持：桌面端（Windows / macOS / Linux）和移动端（Android / iOS / iPadOS）。布局自动适配平台。

## 业务功能（子节点）

BPM 的功能划分为以下业务领域，每个领域由一个独立的 spec 节点管辖：

| 节点 | 职责 |
|------|------|
| [[lifecycle]] | 插件启动、自检、迁移、延迟启动、自动接管、卸载清理 |
| [[manager-ui]] | BPM 主界面弹窗（插件视图、筛选、分组、标签、外观总览）及其辅助弹窗 |
| [[plugin-operations]] | 插件启停命令、状态快照、方案管理、命令面板集成 |
| [[settings]] | 设置页面 UI、用户偏好持久化、数据模型定义 |
| [[source-install]] | GitHub 安装流程、仓库解析、来源订阅、版本检查与自动更新 |
| [[transfer-pack]] | 配置包的导出、导入、预览与应用 |
| [[conflict-diagnosis]] | 插件冲突二分排查算法、排查会话状态管理、报告生成 |
| [[ribbon-manager]] | 侧边栏图标排序、显隐控制、拖拽隐藏 |
| [[localization]] | 多语言翻译系统与语言文件 |
