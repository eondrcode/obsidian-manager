---
title: 插件生命周期
status: active
hue: 210
desc: 启动、自检、迁移、延迟启动、自动接管、卸载清理
code: src/self-check.ts
related:
  - src/migrations.ts
  - src/main.ts
---
# 插件生命周期

管辖 BPM 插件的启动、初始化、运行期检查和卸载阶段的整体行为。

## 保证

- **启动初始化**：`onload` 阶段负责加载设置、运行数据迁移、初始化翻译系统、初始化内置标签、初始化仓库解析器、注册侧边栏图标、注册设置页面、注册命令、构建延迟启动队列、注册 Obsidian 协议处理器。实际启用插件放在布局就绪后的独立宏任务中，避免零秒档插件在 BPM 的 `onload` 内同步读盘和求值。自检（`performSelfCheck`）在 Obsidian 布局就绪后延迟 2 秒执行。
- **数据迁移**：`runMigrations` 在 `onload` 早期执行，确保 `data.json` 格式与当前插件版本兼容。迁移可重复执行，不产生重复数据。迁移版本号记录在 `MIGRATION_VERSION` 设置中。
- **自检与自动接管**：延迟启动启用时，`performSelfCheck` 检查 `community-plugins.json` 中是否有未被 BPM 管理的插件。如果有，显示接管提示弹窗或（如果 `AUTO_TAKEOVER` 启用）自动接管。被 `bpm-ignore` 标签标记的插件不参与接管。
- **延迟启动**：启用延迟启动后，插件的启用/禁用状态由 BPM 的 `ManagerPlugin.enabled` 记录驱动，而非 `community-plugins.json`。BPM 自身始终在 Obsidian 原生启动列表中。插件按延迟配置在指定秒数后异步启用。
- **启动队列（串行排空 + 帧让出）**：`enableDelay` 不再为每个插件挂独立 `setTimeout`（旧写法下同档插件会在同一宏任务批次里并发 `enablePlugin`，0 秒档实测 18 个插件共 24 MB 在启动窗口内连发编译求值）。改为两步：
  1. `buildDelayQueue(now)` 算出「谁、最早何时」（`earliestAt = now + 档位秒数 × 1000`，按 `earliestAt` 升序，同刻保持 manifest 顺序），只排序不启动。
  2. `drainDelayQueue()` 串行排空：睡到 `earliestAt` → 启动一个 → 等它落定 → 让出一帧 → 下一个。
  延迟档位语义不变（仍是「指定秒数后启用」），队列只负责节奏。
- **启动成功判定**：`enablePlugin` 实测解析为 `boolean`（`false` = 已在运行或 manifest 缺失，**不等于失败**）。判定成功的唯一标准是「实例存在且 `_loaded !== false`」。单个插件抛错时 `try/catch` 隔离、`console.error` 留痕、队列继续；排空结束后汇总失败清单。结果保存在 `Manager.lastDelayStartReport`。
- **帧让出兜底**：`requestAnimationFrame` 在窗口最小化 / 离屏时不触发，因此帧让出带 `DELAY_YIELD_TIMEOUT_MS` 超时放行，避免把队列卡死。卸载时 `cancelDelayQueue()` 放行挂起的休眠/让出并清空队列，排空循环靠 `isUnloaded` 退出。
- **延时开关的不变量**：`community-plugins.json` 的内容 ⇔ 延时开关状态。开启 = 被接管插件移出该文件（`enableDelaysForAllPlugins` 用 `disablePluginAndSave` 移出后以运行时延迟启用）；关闭 = 交回 Obsidian 托管（`disableDelaysForAllPlugins` 用 `enablePluginAndSave` 写回）。**该交接只在用户切换延时开关时发生，`onunload` 绝不改动插件启用状态** —— 卸载无法区分「退出 App / 重载插件 / 用户停用 BPM」，一旦在此交接，每次重载 BPM 都会改写用户配置、使延时启动失效，并被自检报成「非 BPM 管理的插件」。
- **GitHub Token 管理**：支持通过 Obsidian 的 SecretStorage API 或旧版 `settings.GITHUB_TOKEN` 存储 GitHub 访问令牌。有 SecretStorage 时优先使用并迁移旧版令牌。
- **卸载清理**：`onunload` 阶段只停掉侧边栏运行时特性（全部延迟回调在卸载后不再动作），**不改动插件启用状态、不写 `community-plugins.json`**。

## 边界

- 数据迁移只操作 `data.json` 和旧版 Markdown 导出文件，不读取或修改用户笔记。
- 自检接管只修改 `community-plugins.json`，不修改插件自身文件。

## Windows 冷启动开销

- 布局已经就绪（例如热重载）时，`onLayoutReady` 会同步调用回调，因此队列仍通过 `setTimeout` 切到独立宏任务；延迟档位的基准时间仍为建队列时刻。
- 自动更新检查和安装来源维护在布局就绪 3 秒后发起；协议处理器不在构造时获取社区插件列表，只在用户使用时请求。
- 启动计时器统一跟踪，卸载时取消；布局回调在卸载后不启动任务。后台任务异常记录到控制台。
- 数据迁移与初始化变更合并为一次设置保存，减少 Windows 启动阶段重复写盘；迁移完成后仍在 `onload` 返回前保存版本。
- 冲突诊断按需初始化；生产构建启用 minify，降低文件读取和解析开销。
- 依据：[Obsidian 启动优化](https://docs.obsidian.md/plugins/guides/load-time)、[Electron 性能指南](https://www.electronjs.org/docs/latest/tutorial/performance)、[Microsoft Defender 性能分析](https://learn.microsoft.com/en-us/defender-endpoint/tune-performance-defender-antivirus)。Defender 扫描可能放大 Windows 文件 I/O 开销，但未经目标 Windows 机器采样，不能认定为本次根因。
