# Better Plugins Manager

[简体中文](docs/README_CN.md)

![GitHub Downloads](https://img.shields.io/github/downloads/zenozero-dev/obsidian-manager/total)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/zenozero-dev/obsidian-manager)
![Last commit](https://img.shields.io/github/last-commit/zenozero-dev/obsidian-manager)
![Issues](https://img.shields.io/github/issues/zenozero-dev/obsidian-manager)
![Stars](https://img.shields.io/github/stars/zenozero-dev/obsidian-manager?style=social)

![Screenshot](docs/img/index.png)

---

## 🎯 What is BPM?

**Better Plugins Manager** is a powerful Obsidian plugin manager that provides a richer management experience than the native one.

> Delay Start • Batch Operations • Groups & Tags • GitHub Install • Conflict Troubleshooter • Mobile Friendly

---

## ✨ Core Features

### 🚀 Performance Optimization
| Feature | Description |
|---------|-------------|
| **Delay Start** | Start plugins with preset delays to reduce startup lag |
| **Startup Self-Check** | 🆕 Detect plugin management conflicts, prevent Obsidian and BPM from controlling plugins simultaneously |

This feature needs to be enabled in settings, disabled by default.
![Delay start needs to be enabled manually](docs/img/PixPin_2026-01-14_23-56-04.png)

### 📦 Batch Management
| Feature | Description |
|---------|-------------|
| **Toggle All** | Quickly enable/disable all plugins |
| **Group Operations** | Batch enable/disable by group |
| **Quick Search** | Filter by status, group, tag, delay, and keywords |

### 🏷️ Organization & Annotation
| Feature | Description |
|---------|-------------|
| **Custom Names** | Give plugins memorable names |
| **Notes & Descriptions** | Record plugin usage and configuration notes |
| **Groups & Tags** | Flexible categorization, BPM installs auto-tagged `bpm-install` |

### 📥 GitHub Installation

1. ![Open download panel from BPM](docs/img/PixPin_2026-01-14_23-52-00.png)
2. ![Download function panel](docs/img/PixPin_2026-01-14_23-52-35.png)

| Feature | Description |
|---------|-------------|
| **Repo Install** | Supports `user/repo` or full URL |
| **Version Selection** | Pick releases like BRAT |
| **Jump to Repo** | One-click jump to GitHub from plugin card |

### 🔍 Conflict Troubleshooter 🆕

![Conflict Troubleshooter](docs/img/PixPin_2026-01-14_23-54-40.png)

| Feature | Description |
|---------|-------------|
| **Binary Search** | Quickly locate problematic plugins or conflict pairs |
| **Wizard-style UI** | Draggable floating window, test while troubleshooting |
| **Generate Report** | Export Markdown troubleshooting report |



### ↕ Customize Ribbon Bar 🆕

If you are annoyed by the ribbon icons changing order every time you start Obsidian due to BPM's delayed startup, please use this feature.

1. ![Open Ribbon Sort Function from BPM Panel](docs/img/PixPin_2026-01-14_23-55-10.png)
2. ![Ribbon Sort Function Panel](docs/img/PixPin_2026-01-14_23-51-05.png)

| Feature | Description |
|---------|-------------|
| **Show/Hide Ribbon Icons** | Customize the visibility of each icon on the ribbon bar |
| **Customize Ribbon Order** | Customize the order of each icon on the ribbon bar by dragging |

### 📱 Mobile Adaptation
| Feature | Description |
|---------|-------------|
| **Responsive Layout** | Auto-switch between mobile/desktop layouts |
| **Collapsible Action Bar** | Save screen space |
| **Long-press Tooltips** | Touch-friendly interaction |

---

## 📦 Installation

### Method 1: Official Marketplace (Recommended)
1. Open Obsidian Settings → Community Plugins
2. Search for "Better Plugins Manager"
3. Click Install and Enable

### Method 2: Manual Installation
1. Download the [latest Release](https://github.com/zenozero-dev/obsidian-manager/releases)
2. Extract to `.obsidian/plugins/better-plugins-manager/`
3. Restart Obsidian and enable

---

## 🚦 Quick Start

### Open the Manager

- Click the 📁 icon in the sidebar
- Or use Command Palette: `Ctrl/Cmd + P` → "Open Plugin Manager"

The panel is divided into three areas, from top to bottom:

1. Action Button Area
2. Filter & Search Area
3. Plugin List Area

### Usage Tips
- **Left-click** to interact with elements, hover over buttons to see tooltips
- **Right-click** to open context menu

---

## 🔍 Plugin Conflict Troubleshooter

When encountering issues caused by plugin conflicts, use the Conflict Troubleshooter wizard:

### How to Use
1. Click the 🔍 button on the toolbar or use command "Troubleshoot plugin conflicts"
2. Follow the wizard prompts
3. Test if the problem exists at each step, click the corresponding button
4. Automatically locate the problematic plugin or conflict pair

### Supported Scenarios
- **Single Plugin Issue**: A plugin itself has a bug
- **Two-Plugin Conflict**: Two plugins work fine separately but conflict when used together

### Tips
- The floating window is draggable for convenient testing
- Supports undo last step
- Troubleshooting state is saved, can continue after restart

---

## ⚙️ Startup Self-Check

BPM checks `community-plugins.json` on startup:

| Situation | Action |
|-----------|--------|
| Only BPM | Normal startup |
| Other plugins present | Prompt to take over |

### Why Takeover?
- Avoid Obsidian and BPM controlling plugins simultaneously
- Ensure delay-start and other features work properly
- Maintain plugin state consistency

---

## 📤 Export to Obsidian Base

### Configuration
Set **Plugin info export directory** in settings (folder inside your vault)

### Rules
| Prefix | Permission |
|--------|------------|
| `bpm_rw_*` | Read-write |
| `bpm_ro_*` | Read-only |
| `bpm_rwc_repo` | Conditionally writable |

### Frontmatter Example

```yaml
---
bpm_ro_id: some-plugin
bpm_rw_name: Custom Name
bpm_rw_desc: Custom Description
bpm_rw_note: Note
bpm_rw_enabled: true
bpm_rwc_repo: user/repo
bpm_ro_group: group-id
bpm_ro_tags:
  - tag-a
  - bpm-install
bpm_ro_delay: delay-id
bpm_ro_installed_via_bpm: true
---

Body section: You can edit or replace this content.
```

---

## ⚙️ Settings

| Setting | Description |
|---------|-------------|
| Delay Profiles | Create delay configurations and assign to plugins |
| Hide BPM Tag | Keep auto-tag but hide from UI |
| GitHub API Token | Increase rate limits for release fetching |
| Fade Disabled Plugins | Visually dim disabled plugin cards |
| Export Notice Text | Customize the body text of exported files |
| Self-Check Reminder | Control whether startup self-check popup shows |

---

## ⌨️ Commands

| Command | Description |
|---------|-------------|
| Open Plugin Manager | Open BPM main interface |
| Troubleshoot plugin conflicts | 🆕 Start conflict troubleshooter wizard |
| Enable/Disable [Plugin Name] | Per-plugin toggle (enable in settings) |
| Enable/Disable [Group Name] | Group batch operations (enable in settings) |

---

## 📱 Compatibility

| Platform | Supported |
|----------|-----------|
| Windows / macOS / Linux | ✅ |
| Android | ✅ |
| iOS / iPadOS | ✅ |

The plugin automatically switches between desktop/mobile layouts based on the platform.

---

## 🤝 Contributing

Issues and PRs are welcome!

- **Bug Reports**: Please include logs and reproduction steps
- **Feature Requests**: Consider opening a discussion or issue first

## 🙏 Acknowledgments

- The ribbon sorting feature is inspired by [Obsidian-ribbon-sort](https://github.com/yunrr/Obsidian-app-ribbon-sorting)

---

## 📄 License

[MIT](LICENSE)
