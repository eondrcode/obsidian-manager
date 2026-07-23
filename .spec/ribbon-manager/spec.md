---
title: 侧边栏编排
status: active
hue: 200
desc: Ribbon 图标排序、显隐控制、拖拽隐藏
code: src/manager/system-ribbon-manager.ts
related:
  - src/modal/ribbon-modal.ts
---
# 侧边栏编排

管理 Obsidian 左侧 Ribbon 图标的排序和显隐控制，以及拖拽隐藏功能。

## 保证

- **排序与显隐**：Ribbon Order 标签页列出所有 ribbon 图标，支持拖拽重排和切换显隐。顺序和显隐状态保存在 `settings.RIBBON_SETTINGS` 中，不依赖 Obsidian 的 workspace 配置文件。
- **CSS 驱动**：通过动态 `style` 标签应用 `data-bpm-ribbon-managed` 标记的元素上的 `display` 和 `order` 属性来控制显隐和排序。管理器关闭时恢复原始样式。
- **拖拽隐藏（桌面端）**：将 ribbon 图标拖出侧边栏区域时自动隐藏该图标，并显示通知。移动端不启用拖拽隐藏，而是通过 MutationObserver 监听菜单变更。
- **启动同步**：插件启动时加载 `RIBBON_SETTINGS` 并应用到运行时。每次保存设置后自动刷新样式。
- **样式持久化**：管理器的 `data-bpm-original-display` 和 `data-bpm-original-order` 属性记录元素的原始样式，在管理器关闭或功能禁用时精确恢复。
- **未定义项清理**：启动后（以及运行时）清理 Obsidian 内部 `leftRibbon.items` 数组中的 undefined/null 项，防止原生方法遍历时崩溃。
- **菜单管理器**：`SystemRibbonManager` 监听 Obsidian workspace 配置文件变更。save 方法保留签名但不实际写入 workspace 配置——Ribbon 状态完全存在 BPM 数据中。

## 边界

- Ribbon 管理功能可通过设置中的 `RIBBON_MANAGER_ENABLED` 开关完全禁用。禁用后清理所有样式覆盖并停止运行时监听。
- 排序和显隐状态仅影响 BPM 管理范围内的图标；非 BPM 创建或加载的图标不可排序。
