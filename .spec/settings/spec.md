---
title: 设置与数据
status: active
hue: 330
desc: 设置页面 UI、用户偏好持久化、数据模型定义
code: src/settings/data.ts
related:
  - src/settings/index.ts
  - src/settings/base-setting.ts
  - src/settings/ui/manager-basis.ts
  - src/settings/ui/manager-delay.ts
  - src/settings/ui/manager-group.ts
  - src/settings/ui/manager-main-page.ts
  - src/settings/ui/manager-style.ts
  - src/settings/ui/manager-tag.ts
  - src/data/data.ts
  - src/migrations.ts
---
# 设置与数据

管理 BPM 的设置面板 UI、用户偏好定义与数据持久化。

## 保证

- **设置面板**：在 Obsidian 设置中注册 `ManagerSettingTab`，包含多个标签页：基础设置、主页面功能、样式、分组、标签、延迟（仅在延迟启动启用时显示）。
- **设置页签内容**：
  - **基础设置**：语言、持久化筛选、居中显示、延迟启动、自动接管、更新检查（启动时/来源/自动）、BPM 标签可见性、Ribbon 管理、命令注册、调试模式、GitHub Token/Proxy。
  - **主页面功能**：配置插件卡片操作的显示位置（卡片按钮 vs 右键菜单）。
  - **样式**：布局（列表/双列）、排序方式、卡片展开样式、分组/标签视觉样式、禁用插件淡出。
  - **分组**：创建/重命名/改色/删除分组。
  - **标签**：创建/重命名/改色/删除标签。
  - **延迟**：创建和管理延迟启动配置（名称 + 延迟秒数）。
- **数据模型**：`ManagerSettings` 定义了完整的用户设置结构，包含 70+ 个配置字段。`DEFAULT_SETTINGS` 提供所有字段的合理默认值。
- **持久化**：通过 `loadSettings` / `saveSettings`（封装 `loadData` / `saveData`）与 Obsidian 插件数据系统集成。设置修改通过 `saveSettings` 落盘。
- **数据迁移**：`runMigrations` 维护 `MIGRATION_VERSION` 字段，按版本顺序执行增量迁移，确保旧版 `data.json` 与新格式兼容。

## 边界

- 设置面板不读取或修改 Obsidian 核心设置，仅管理 BPM 自身的配置项。
- 迁移只向前兼容；不支持降级恢复旧版本数据格式。
