---
title: 配置包传输
status: active
hue: 30
desc: 插件配置包的导出、导入、预览与应用
code: src/import-export.ts
---
# 配置包传输

管理 BPM 配置包（Transfer Pack）的导出、导入、预览和应用流程，用于在 Obsidian 库之间迁移插件设置。

## 保证

- **配置包格式**：基于 JSON 的结构化包文件，schema 标识为 `better-plugins-manager.transfer/v1`。包含插件列表、主题列表、插件配置文件（JSON）、分组/标签/延迟配置、仓库映射、来源订阅、安装历史、布局数据（排序与隐藏）、Ribbon 设置、工作区偏好。
- **导出**：`buildManagerTransferPackage` 支持选择性导出可配置的项目（插件/主题/插件配置/分组标签/布局/来源/工作区设置）。导出时按用户选择范围收集数据，并支持进度回调。
- **导入预览**：`parseManagerTransferPackage` 解析包文件，`createManagerTransferPreview` 生成预览信息（已安装/缺失/可安装数量、配置项统计）。
- **导入应用**：`applyManagerTransferPackage` 按导入选项执行：安装缺失插件（从包内文件或 GitHub）、更新已有插件、合并插件元数据、应用启用状态、合并分组/标签/延迟、合并布局和来源、导入插件配置、应用主题。支持进度回调并返回详细导入结果（成功/跳过/失败统计）。
- **文件打包**：插件和主题的完整文件目录可打包为 base64 编码的 `ManagerTransferPluginFile` 数组，支持迁移到没有 GitHub 访问的离线环境。
- **安全校验**：导入前校验插件 ID 一致性、文件路径安全性（防止路径穿越）、支持 `getSafePluginId` 和 `normalizePackageRelativePath` 等安全函数。

## 边界

- 配置包不包含用户的笔记或 Obsidian 核心设置。
- 导入插件配置时，先禁用目标插件、写入配置、再启用插件，确保配置改变被插件运行时识别。
- 插件/主题文件的打包（base64）和导入（atob）使用运行时 API，不依赖 Node.js Buffer。
