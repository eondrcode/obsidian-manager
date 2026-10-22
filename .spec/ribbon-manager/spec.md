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

- **排序与显隐**：Ribbon Order 标签页列出所有 ribbon 图标，支持拖拽重排和切换显隐。顺序和显隐状态保存在 `settings.RIBBON_SETTINGS` 中。
- **原生状态驱动**：应用层把设置写进 Obsidian 自己的 ribbon 状态 —— `leftRibbon.items[].hidden` 与 `items` 数组顺序，再调用 `leftRibbon.onChange(false)` 交由 Obsidian 重绘。BPM 不再对元素写任何 inline 样式、不再打 `data-bpm-*` 标记、不再维护 DOM 观察器。
- **条目创建钩子（同步新条目）**：启动时包装原生 `leftRibbon.addRibbonItemButton`，任何图标注册后 200ms 内补一次应用；卸载/关闭接管时把原生方法原样还原。这是替代 DOM 观察器的结构性钩子 —— 只在条目创建时触发，不随容器重建失效，也不受无关 DOM 变动干扰。**为什么必须有它**：新条目出生时 `hidden` 默认为 `false`，而 Obsidian 只在启动时按配置 `load()` 一次（实测会话中 `load`/`onChange` 均 0 次），此后再无人复述配置，条目就会以显示状态留在侧边栏。
- **持久化直写配置**：`persistRibbonConfigFile()` 把当前状态（`serialize()` 的结果）直写进 `workspace(-mobile).json` 的 `left-ribbon` 段。原生持久化依赖 `requestSaveLayout()` 的防抖与退出时机，一旦没落地，下次启动会按过期的 `hiddenItems` 复述，表现为「启动后设置不生效」；直写让期望状态成为磁盘事实，启动时由 Obsidian 自己的 `load()` 应用。仅在与现有内容不一致时写入，且只替换 `left-ribbon` 一个键（不制造整文件 diff）。
- **插件开关后生效**：`removeRibbonAction()` 只删除 `buttonEl`、保留条目本身，插件停用时其 `hidden` 与位置不受影响；插件启用时若条目已被丢弃，则由条目创建钩子在 200ms 内补回设置。
- **唯一应用入口**：`Manager.applyRibbonSettings()` 是唯一应用管线（命令面板「立即应用 Ribbon 设置」、条目创建钩子、各插件状态变更收尾共用），仅确有变化时重绘。启动后另有 3s/8s/15s 三次固定兜底应用，覆盖延时启动分批到位的插件。
- **爆发收口（共用防抖）**：启动期有三条路径会连发应用请求 —— 每个延时插件 `enablePlugin()` 完成后各一次（实测 41 次）、`layout-change` 事件、条目创建钩子。三者统一走 `Manager.scheduleRibbonApply(reason)`（200ms 防抖）合并成一次 `applyRibbonSettings()`，避免把 ribbon 重绘与 `persistRibbonConfigFile()` 的 workspace.json I/O 叠在插件 JS 求值高峰上。**用户显式动作仍走同步的 `applyRibbonSettings()`**（命令面板、面板按钮、拖拽隐藏、3s/8s/15s 兜底、延时开关切换收尾）。
- **身份匹配**（`SystemRibbonManager.resolve()`，纯内存、不读 DOM）：`ribbonIdMap` → 插件id+图标名（需唯一） → 插件id+序号 → 名称 → 孤儿认领 → 新铸身份。孤儿认领只认领「同插件前缀 + id/name 精确相等 + 候选唯一」的、内存中已无归属的旧条目。
- **标识字段同步**：已登记条目的 `name` / `ribbonIdMap` 与当前内存项不一致时回写这两个字段（**绝不改动 `visible` / `order`**），使插件改标题或换 id 后仍能重新匹配。
- **拖拽隐藏（桌面端）**：将 ribbon 图标拖出侧边栏区域时自动隐藏该图标，并显示通知。移动端不启用拖拽隐藏；移动端菜单同样源自原生 `items`，无需单独排序。
- **未定义项清理**：应用前清理 Obsidian 内部 `leftRibbon.items` 数组中的 undefined/null 项，防止原生方法遍历时崩溃。
- **旧覆盖清理**：`clearLegacyRibbonOverrides()` 在启动与关闭接管时剥掉旧版本遗留的 `data-bpm-*` 属性并还原 inline `display` / `order`，避免在线升级后两套机制互相打架。

## 边界

- Ribbon 管理功能可通过设置中的 `RIBBON_MANAGER_ENABLED` 开关禁用。**禁用 = 停止写入**：原生状态无法与用户自己的改动区分，因此不做回滚，边栏保持当前状态，可自行调整。
- 顺序权威属于 BPM 面板：在侧边栏直接用 Obsidian 原生拖拽排序，会被下一次应用覆盖。
- 原生接口（`leftRibbon.items` / `onChange`）缺失时（Obsidian 大版本变更）降级为只读：不写入、不猜测 DOM，并输出错误日志；`addRibbonItemButton` 缺失时仅失去「新条目即时同步」，仍有启动兜底与各开关路径的应用。
- 直写配置只改 `left-ribbon` 段，且按平台选择 `workspace-mobile.json`（移动端）或 `workspace.json`。
- 排序和显隐状态仅影响 BPM 管理范围内的图标；非 BPM 创建或加载的图标不会被登记，因而不可排序。
