---
title: 本地化
status: active
hue: 90
desc: 多语言翻译系统与语言文件
code: src/lang/inxdex.ts
related:
  - src/lang/locale/en.ts
  - src/lang/locale/es.ts
  - src/lang/locale/fr.ts
  - src/lang/locale/ja.ts
  - src/lang/locale/ko.ts
  - src/lang/locale/ru.ts
  - src/lang/locale/zh_cn.ts
---
# 本地化

管理 BPM 的多语言翻译系统，包括 `Translator` 类和所有语言文件。

## 保证

- **支持的语言**：简体中文（zh-cn）、英语（en）、俄语（ru）、日语（ja）、韩语（ko）、法语（fr）、西班牙语（es）。共 7 种语言。
- **翻译回退链**：当前语言 → 英语 → 简体中文 → 原始 key 字符串。确保即使特定语言翻译缺失，UI 也不会显示空值或未格式化 key。
- **语言自动检测**：首次启动时根据 Obsidian 当前语言自动设置。用户可随后在设置中手动切换，修改后的选择不会被系统语言覆盖。
- **模板插值**：翻译字符串支持 `{name}`、`{count}` 等变量插值，在翻译调用时传入变量字典。
- **语言归一化**：将 Obsidian 的 locale（如 `en-gb`、`zh-tw`）归一化为 BPM 支持的语言代码。
- **语言文件结构**：每个语言文件导出与简体中文 key 集一致的翻译对象，TypeScript 类型安全。

## 边界

- 翻译系统不负责 UI 布局的 RTL 适配。
- 添加新语言需要创建新的 locale 文件并在 `Translator.localeMap` 和 `Translator.language` 中注册。
