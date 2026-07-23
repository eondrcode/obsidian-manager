---
title: 管理器界面
status: active
hue: 145
desc: BPM 主界面弹窗（插件视图、筛选、分组、标签、外观总览）及其辅助弹窗
code: src/modal/manager-modal.ts
related:
  - src/utils.ts
  - src/modal/bulk-status-confirm-modal.ts
  - src/modal/delete-modal.ts
  - src/modal/disable-modal.ts
  - src/modal/group-modal.ts
  - src/modal/hide-modal.ts
  - src/modal/note-modal.ts
  - src/modal/tags-modal.ts
  - src/modal/update-check-modal.ts
  - src/modal/update-modal.ts
---
# 管理器界面

管理 BPM 主弹窗（`ManagerModal`）及其辅助弹窗的 UI 行为。

## 保证

- **多标签页结构**：主界面提供以下标签页，每个标签页负责一个独立的工作流：Plugin View（插件列表）、Themes（主题）、Install Hub（安装）、Sources（来源）、Transfer Pack（配置包）、Ribbon Order（侧边栏排序）、Conflict Diagnosis（冲突排查）。
- **插件视图**：以紧凑卡片形式展示已安装社区插件，支持搜索、状态筛选（启用/禁用/已分组/有更新等）、分组筛选、标签筛选、延迟配置筛选。筛选器支持包含/排除两种操作模式。筛选状态可选择持久化到设置中。
- **插件卡片**：显示插件名称、描述、标签、分组、延迟状态。提供单机按钮和右键菜单，操作包括：切换启用/禁用、检查更新、下载更新、单次启动、重启、隐藏、添加备注、复制 ID、打开仓库、打开设置、打开文件夹、清除配置、删除。操作按钮的显示位置（卡片上或右键菜单）可由用户在设置中配置。
- **右键菜单**：在插件卡片上右键可弹出完整操作菜单。
- **分组/标签/备注管理**：通过独立弹窗创建、编辑、重命名、改色和删除分组和标签。备注弹窗支持编辑插件备注文本。
- **更新检查**：提供更新检查弹窗，可配置检查模式（按 GitHub Release 或按版本号）、兼容模式（仅兼容版本或全部版本）、更新延迟天数。
- **移动端适配**：桌面端和移动端采用不同的筛选面板布局。移动端筛选面板默认折叠，可手动展开。
- **全局确认弹窗**：`confirmWithModal` 提供统一的确认对话框组件，用于删除等危险操作。
- **文件夹打开**：`managerOpen` 在桌面端调用 Electron shell 打开系统文件管理器；移动端提示不支持。

## 边界

- 主弹窗不直接管理 Obsidian 原生设置面板中的插件启停设置页。
- 弹窗关闭后不持有对 DOM 的引用；`onClose` 清理所有内容元素。
