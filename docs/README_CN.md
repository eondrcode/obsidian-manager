<div align="center">

# Better Plugins Manager

**更强大的 Obsidian 插件管理器。**

让插件数量较多的 Obsidian 库依然保持清晰可控：延迟启动、批量管理、分组标签、GitHub 安装和冲突诊断都集中在一个管理器中。

<p>
  <a href="../README.md">English</a>
  ·
  <a href="README_JA.md">日本語</a>
  ·
  <a href="README_KO.md">한국어</a>
  ·
  <a href="README_ES.md">Español</a>
  ·
  <a href="README_FR.md">Français</a>
  ·
  <a href="README_RU.md">Русский</a>
  ·
  <a href="https://github.com/zenozero-dev/obsidian-manager/releases">Releases</a>
  ·
  <a href="https://ifdian.net/a/eondr">支持作者</a>
</p>

<p>
  <a href="https://github.com/zenozero-dev/obsidian-manager/releases">
    <img alt="Latest Release" src="https://img.shields.io/github/v/release/zenozero-dev/obsidian-manager?style=flat-square&label=release">
  </a>
  <img alt="GitHub Downloads" src="https://img.shields.io/github/downloads/zenozero-dev/obsidian-manager/total?style=flat-square&label=downloads">
  <img alt="Last Commit" src="https://img.shields.io/github/last-commit/zenozero-dev/obsidian-manager?style=flat-square&label=last%20commit">
  <img alt="Issues" src="https://img.shields.io/github/issues/zenozero-dev/obsidian-manager?style=flat-square&label=issues">
  <img alt="Stars" src="https://img.shields.io/github/stars/zenozero-dev/obsidian-manager?style=flat-square&label=stars">
  <img alt="License" src="https://img.shields.io/github/license/zenozero-dev/obsidian-manager?style=flat-square&label=license">
</p>

<p>
  <img alt="Obsidian Plugin" src="https://img.shields.io/badge/Obsidian-plugin-7C3AED?style=flat-square&logo=obsidian&logoColor=white">
  <img alt="Minimum Obsidian Version" src="https://img.shields.io/badge/Obsidian-%E2%89%A5%201.5.8-7C3AED?style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-ready-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Platform" src="https://img.shields.io/badge/platform-desktop%20%7C%20mobile-4B5563?style=flat-square">
  <img alt="i18n" src="https://img.shields.io/badge/i18n-7%20languages-0F766E?style=flat-square">
  <img alt="GitHub Source Tracking" src="https://img.shields.io/badge/GitHub-source%20tracking-181717?style=flat-square&logo=github&logoColor=white">
  <a href="https://ifdian.net/a/eondr">
    <img alt="Sponsor on Afdian" src="https://img.shields.io/badge/Afdian-sponsor-946ce6?style=flat-square">
  </a>
</p>

</div>

![Screenshot](img/index.png)

---

## 🎯 BPM 是什么？

**Better Plugins Manager (BPM)** 是 Obsidian 社区插件的控制中心，适合依赖大量插件、需要比简单启用/禁用更完整管理能力的库。

它可以帮助你保持启动响应速度，按工作流整理插件，从 GitHub Release 安装插件，并在出现问题时定位冲突来源。

| 🚀 启动 | 📦 管理 | 🏷️ 整理 | 📥 安装 | 🔍 诊断 |
|--------|--------|----------|---------|---------|
| 插件延迟启动和启动自检 | 批量启用/禁用、快速搜索和状态筛选 | 分组、标签、备注、描述和自定义名称 | 从 GitHub 仓库和 Release 安装 | 引导式冲突排查和报告生成 |

---

## ✨ 核心功能

BPM 围绕五个清晰的 tab 组织。每个 tab 负责一个工作流，让相关控制集中在一起，桌面端和移动端都更容易浏览。

| Tab | 工作流 |
|-----|--------|
| 🧩 Plugin View | 管理已安装插件、插件信息、筛选、启动行为和单插件操作 |
| 📥 Install Hub | 从 GitHub 安装插件或主题，并管理已跟踪来源 |
| 📦 Transfer Pack | 在不同库之间导出、导入和恢复插件/主题包 |
| 🎛️ Ribbon Order | 控制 Obsidian 左侧 Ribbon 图标的顺序和显隐 |
| 🔍 Conflict Diagnosis | 定位插件问题并生成排查报告 |

### 🧩 Plugin View

日常插件管理的主页面。

![Plugin View](img/PluginView.png)

| 区域 | 功能 |
|------|------|
| **插件列表** | 以紧凑、可搜索的管理视图浏览已安装社区插件 |
| **批量操作** | 批量启用或禁用插件，包括按分组处理 |
| **筛选** | 按启用状态、分组、标签、延迟设置和关键词筛选 |
| **整理信息** | 添加自定义名称、描述、备注、分组和标签 |
| **启动控制** | 分配延迟启动预设，并在列表中查看启动状态 |
| **插件操作** | 检查更新、下载更新、重启插件、单次启动、打开设置、打开目录、复制 ID、打开仓库、清空配置、隐藏或删除 |
| **BPM 标签** | BPM 安装的插件会自动标记 `bpm-install`，也支持通过 `bpm-ignore` 忽略管理 |

### 📥 Install Hub

Install Hub 负责从 GitHub 安装插件/主题，并管理安装后可跟踪的来源。

![Install Hub](img/installHub.png)

| 区域 | 功能 |
|------|------|
| **安装类型** | 在插件和主题安装之间切换 |
| **仓库输入** | 支持 `user/repo` 或完整 GitHub 仓库 URL |
| **版本选择** | 获取 GitHub Release，可安装最新版或指定版本 |
| **更新说明** | 可用时在安装前显示 Release 信息 |
| **最近安装** | 保存最近使用的仓库，便于重复安装 |
| **来源跟踪** | 可选择跟踪已安装仓库，用于后续检查更新、更新和重装 |
| **来源管理** | 查看已跟踪的插件/主题来源、更新目标、重装项目，并保持来源元数据最新 |

### 📦 Transfer Pack

Transfer Pack 用于在不同 Obsidian 库之间迁移插件配置，不需要手动整理清单。

![Transfer Pack](img/transferPack.png)

| 区域 | 功能 |
|------|------|
| **导出列表** | 选择本地插件和主题，生成 JSON 迁移包 |
| **插件配置** | 按需导出选中的插件配置文件 |
| **分类数据** | 导出 BPM 分组、标签和延迟预设 |
| **布局数据** | 导出管理器排序、隐藏项目和 Ribbon 布局 |
| **来源数据** | 导出 GitHub 仓库映射、来源订阅和安装历史 |
| **工作区偏好** | 导出样式、延迟模式、标签显示和启动检查偏好 |
| **导入预览** | 导入前预览包内插件、主题、来源、配置和布局数据 |
| **恢复选项** | 安装缺失插件/主题、合并插件配置、恢复启用状态、应用布局、合并来源和导入主题 |

### 🎛️ Ribbon Order

Ribbon Order 保持 Obsidian 左侧 Ribbon 顺序稳定，尤其适合延迟启动插件在启动后才注册图标的情况。

![Ribbon Order](img/ribbonOrder.png)

| 区域 | 功能 |
|------|------|
| **图标排序** | 拖动 Ribbon 项目并固定顺序 |
| **显隐控制** | 显示或隐藏单个 Ribbon 图标 |
| **原生同步模式** | 将 Ribbon 布局保存在 BPM 数据中，不依赖 Obsidian workspace 配置 |
| **重置操作** | 显示所有 Ribbon 项目并按名称排序 |
| **重载提示** | 当启动时隐藏的图标需要 Obsidian 刷新时给出提示 |

### 🔍 Conflict Diagnosis

Conflict Diagnosis 通过步骤引导插件冲突测试，并把测试状态和结果保存在一个页面中。

![Conflict Diagnosis](img/conflictScan.png)

| 区域 | 功能 |
|------|------|
| **预检查** | 确认禁用其他插件后问题是否仍然存在 |
| **二分缩小范围** | 通过分组测试缩小嫌疑插件范围 |
| **冲突对查找** | 帮助定位两个插件之间的冲突，包括跨分组情况 |
| **人工反馈循环** | 每一步测试后由你确认问题是否仍然存在 |
| **状态控制** | 撤销上一步、重启 Obsidian、退出排查、恢复原始状态或保留当前状态 |
| **结果报告** | 生成包含检测结果和建议操作的 Markdown 冲突报告 |

---

## 📦 安装

### 社区插件市场

推荐大多数用户使用。

1. 打开 **Obsidian 设置 → 第三方插件**。
2. 搜索 **Better Plugins Manager**。
3. 安装并启用插件。

### 手动安装

适合直接安装 GitHub Release。

1. 下载 [latest release](https://github.com/zenozero-dev/obsidian-manager/releases)。
2. 将 `main.js`、`manifest.json` 和 `styles.css` 复制到 `.obsidian/plugins/better-plugins-manager/`。
3. 重启 Obsidian。
4. 在 **设置 → 第三方插件** 中启用 **Better Plugins Manager**。

---

## 🚦 快速开始

### 打开 BPM

启用插件后，可以通过以下方式打开 BPM：

- 点击左侧 Ribbon 中的 BPM 图标。
- 在命令面板中运行 **Open the plugin manager**。

### 首次使用建议

1. 从 **Plugin View** 开始，查看已安装插件、筛选、分组、标签和延迟设置。
2. 安装 GitHub 插件或主题时使用 **Install Hub**。
3. 在不同库之间迁移插件配置时使用 **Transfer Pack**。
4. 需要定位插件问题时使用 **Conflict Diagnosis**。

### 交互提示

- **左键** 点击主要控件进行切换、编辑、安装、导入或执行操作。
- **右键** 插件项目打开上下文菜单。
- **悬停** 工具栏按钮查看提示；触屏设备可使用长按提示。

---

## 🔍 冲突诊断教程

当启用社区插件后出现问题，并且需要结构化缩小原因范围时，使用 **Conflict Diagnosis**。

### 流程

1. 打开 **Conflict Diagnosis** tab，或从命令面板运行 **Troubleshoot plugin conflicts**。
2. 开始诊断会话。BPM 会先记录当前插件状态。
3. 每一步测试你的库，然后选择 **Problem Still Exists** 或 **Problem Gone**。
4. 继续引导式分组测试，直到 BPM 将结果缩小到某个插件或插件组合。
5. 查看结果，恢复原始插件状态或保留当前状态，必要时生成 Markdown 报告。

### 注意

- 诊断依赖你在每一步的反馈；每次请使用同样的测试动作。
- 间歇性问题、加载顺序问题、配置相关问题或三插件以上链式冲突仍可能需要人工确认。
- 排查过程中可以撤销上一步、重启 Obsidian、退出会话、恢复原始状态或保留当前状态。

---

## 🛡️ 启动接管

启用 **Delayed Startup** 后，BPM 会检查 `.obsidian/community-plugins.json`，确保 Obsidian 和 BPM 不会同时控制同一批插件的启动状态。

| 情况 | BPM 行为 |
|------|----------|
| 没有未接管插件 | 正常启动 |
| 检测到未接管插件 | 显示接管提示 |
| 启用 Auto Takeover | 自动将检测到的插件纳入 BPM 管理 |
| 插件标记为 `bpm-ignore` | 保留在 Obsidian 原生启动列表中 |

接管可以保持延迟启动、启用状态和 BPM 插件记录一致。接管成功后，请重启 Obsidian 让启动列表干净生效。

---

## 📦 迁移与旧版导出

当前版本建议使用 **Transfer Pack** 在不同库之间迁移配置。它可以导出和导入插件列表、主题、选中的插件配置、分组、标签、延迟预设、布局数据、Ribbon 顺序、来源订阅、安装历史和工作区偏好。

旧版 Markdown/frontmatter 的 Obsidian Base 导出仅保留用于兼容旧数据。新配置建议使用 **Transfer Pack**，不要再配置 Base 导出目录。

---

## ⚙️ 设置

BPM 设置按功能拆分为多个页面：

| 页面 | 可配置内容 |
|------|------------|
| **Basic** | 语言、筛选持久化、延迟启动、自动接管、启动检查更新、来源检查更新、来源自动更新、BPM 标签显示、Ribbon 编排、命令、调试模式和 GitHub Token |
| **Main Page Actions** | 选择哪些插件操作直接显示在插件卡片上，哪些收纳到右键菜单 |
| **Style** | 插件列表布局、项目显示样式、分组/标签样式和禁用插件淡化 |
| **Groups** | 创建、重命名、重新着色和删除插件分组 |
| **Tags** | 创建、重命名、重新着色和删除插件标签 |
| **Delay** | 创建和维护延迟启动配置；仅在启用延迟启动时显示 |

---

## ⌨️ 命令

| 命令 | 可用性 | 说明 |
|------|--------|------|
| **Open the plugin manager** | 始终可用 | 打开 BPM 主界面 |
| **Troubleshoot plugin conflicts** | 始终可用 | 启动冲突诊断流程 |
| **Enable/Disable [Plugin Name]** | 可选设置 | 为每个插件注册独立启用/禁用命令 |
| **One-click Enable/Disable [Group Name]** | 可选设置 | 为分组注册批量切换命令 |

---

## 📱 兼容性

| 平台 | 支持 |
|------|------|
| Windows / macOS / Linux | ✅ |
| Android | ✅ |
| iOS / iPadOS | ✅ |

插件会根据平台自动切换桌面/移动端布局。

---

## 🤝 贡献

欢迎提交 Issue 和 PR。

- **Bug 报告**：请包含日志和复现步骤。
- **功能建议**：建议先创建 discussion 或 issue。

## 🙏 致谢

- Ribbon 排序功能受到 [Obsidian-ribbon-sort](https://github.com/yunrr/Obsidian-app-ribbon-sorting) 启发。

---

## 📄 License

[MIT](../LICENSE)
