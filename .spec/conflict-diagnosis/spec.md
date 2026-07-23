---
title: 冲突排查
status: active
hue: 0
desc: 插件冲突二分排查算法、会话状态管理、报告生成
code: src/troubleshoot/troubleshoot-algorithm.ts
related:
  - src/troubleshoot/troubleshoot-modal.ts
  - src/troubleshoot/troubleshoot-panel.ts
  - src/troubleshoot/troubleshoot-result.ts
  - src/troubleshoot/troubleshoot-state.ts
---
# 冲突排查

管理插件冲突排查的诊断算法、用户界面、会话状态持久化和结果报告。

## 保证

- **排查算法**：`TroubleshootAlgorithm` 实现二分排查算法，流程如下：
  1. 初始确认：禁用全部插件，确认问题是否由插件引起。
  2. 主循环二分：将嫌疑插件集合二分，分别测试前半和后半。问题在哪一半则缩小到那一半。
  3. 单插件验证：缩小到只剩一个插件时，单独启用验证是否为真正元凶。
  4. 冲突对验证：缩小到两个插件时，分别单独测试以判断是单个问题还是两个插件的冲突。
  5. 跨分区冲突搜索：如果前半和后半单独测试都无问题，则启用跨分区搜索算法，固定一侧全开、二分另一侧，分别定位出冲突双方。
- **算法状态机**：状态在 `TroubleshootState` 中持久化，支持关闭弹窗或重启 Obsidian 后恢复排查进度。包含阶段（initial-confirm / bisect-main / cross-pair-bisect-b / cross-pair-bisect-a / verify-single / verify-pair）、当前嫌疑池、已排除插件、历史记录。
- **用户交互**：`TroubleshootPanel` 提供步骤式 UI，每次测试后询问用户"问题是否仍然存在"。根据用户反馈推进算法。支持撤销上一步、重启 Obsidian、退出排查、恢复原始状态或保持当前状态。
- **结果报告**：排查完成后生成 Markdown 格式的冲突报告，包含检测到的插件和建议的下一步操作。
- **核心插件排除**：排查始终排除 Obsidian 核心插件和 BPM 自身，避免误判。

## 边界

- 排查算法依赖用户在每个测试步骤中的手动验证反馈；对间歇性 bug、加载顺序问题、配置特定 bug 或涉及三个以上插件的冲突，算法可能无法精确定位。
- 修改插件启用状态时不操作 `community-plugins.json`，仅在内存和 BPM 设置中管理状态。
