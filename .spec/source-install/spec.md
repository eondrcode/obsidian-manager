---
title: 安装源
status: active
hue: 170
desc: GitHub 安装、仓库解析、来源订阅、版本检查与自动更新
code: src/github-install.ts
related:
  - src/repo-resolver.ts
  - src/source-release.ts
  - src/github-url.ts
  - src/agreement.ts
---
# 安装源

管理从 GitHub 安装插件/主题、解析插件仓库映射、跟踪来源订阅、检查版本更新与自动更新。

## 保证

- **GitHub 安装（插件）**：`installPluginFromGithub` 从指定 GitHub 仓库的 release 下载并安装 Obsidian 插件。优先使用 release asset（manifest.json + main.js + styles.css），asset 不完整时回退到 tag 对应的 raw 文件。安装后更新 BPM 插件记录、添加 `bpm-install` 标签（可选）、登记仓库映射、启用插件。
- **GitHub 安装（主题）**：`installThemeFromGithub` 从 GitHub release 安装主题（theme.css + manifest.json），安装后可选激活主题。
- **仓库解析**：`RepoResolver` 提供 `pluginId → GitHub 仓库地址` 的解析，优先级：settings.REPO_MAP → 本地缓存文件 → 官方社区插件列表（网络请求）。解析成功后将结果写入 `settings.REPO_MAP`。
- **来源订阅**：`BetaSource` 记录插件/主题的 GitHub 仓库、更新模式（latest/frozen）、版本检查配置、自动更新开关。来源列表在安装 Hub 和 Sources 标签页中展示和管理。
- **版本检查**：`syncSourceReleaseCheck` 拉取仓库的 release 列表，按配置（更新模式、兼容性、延迟天数）确定目标版本，更新 source 记录的版本字段。`sourceHasUpdate` 判断来源是否有可更新的版本。
- **自动更新**：启动时可选按来源订阅自动安装新版本，尊重每个来源的 `autoUpdate` 开关。
- **GitHub 代理**：`github-url.ts` 支持通过配置的代理 URL 重写所有 GitHub 请求（`resolveGithubUrl`），代理模板支持 `{url}` 和 `{encodedUrl}` 占位符。
- **社区插件列表**：`Agreement` 类负责缓存 Obsidian 官方社区插件列表，用于仓库解析和协议处理。
- **安装历史**：记录最近安装的仓库，便于在安装 Hub 中快速复用。

## 边界

- 安装操作仅写入 `.obsidian/plugins/<id>/` 或 `.obsidian/themes/<name>/` 目录，不修改 vault 中的用户数据。
- 安装失败时（如仓库不存在、release asset 不完整），向用户显示错误提示且不破坏已有插件状态。
- 仅支持 GitHub 作为安装来源；不支持其他 Git 托管平台。
