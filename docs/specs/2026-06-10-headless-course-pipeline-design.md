# 无头课程配音流水线 · 设计规格

日期：2026-06-10 · 分支：feat/ai-dubbing · 状态：已批准（路线 2 + 零复制 A + 独立页 A）

## 1. 目标

把"整门课（100+ 视频）批量转译为用户母语"确立为产品核心场景：

- 处理引擎与活动编辑器**完全解耦**（无头），跑批期间编辑器照常可用；
- **多课并发**：分阶段信号量限流 + 流水线重叠，总时长 ≈ 瓶颈阶段之和；
- **零复制**：源视频不写入浏览器存储（OPFS），全程句柄直读——消除 100 节 ≈ 20GB 的存储炸弹；
- 修复两轮代码审查发现的全部 18 个问题（5 Critical / 10 High / 3 Medium）；
- 批量中心升级为一级页面 `/course`，编辑器降级为"逐课复核"工具。

非目标（明确不做）：云盘/URL 导入、多 Whisper 模型实例（asr>1）、双路并发导出、ZIP64。

## 2. 引擎架构

```
dub/course/engine/
  semaphore.ts    异步信号量 + 全局 abort/pause 信号
  pipeline.ts     runLesson(ctx, lesson)：单课依次过各阶段，阶段入口处 acquire 对应信号量
  scheduler.ts    runCourse(ctx)：所有目标课并发进入 runLesson，落库防抖，终态即时持久化
  stages/
    prepare.ts    句柄→File；mediabunny readVideoFile 读元数据；有字幕则解析（subtitles.ts）
    transcribe.ts 仅缺字幕课：构建临时 tracks → extractTimelineAudio（纯函数）→ transcriptionService
    translate.ts  课内批次 4 路并发（复用修复后的 dub/translate.ts 重试+退化守卫）
    synthesize.ts TTS 8 路并发（信号量）；共享 AudioContext 单例解码真实时长；返回 {clip, realDuration, rate}
    assemble.ts   纯数据构建 SceneTracks + TProject → storageService.saveProject；TTS 音频经
                  storageService.saveMediaAsset 正常入库（小，几 MB/课）
    export.ts     无头渲染 buildScene + SceneExporter → 写 _localized/<stem>_zh.mp4；
                  支持流式 target 则流式，否则 buffer 后立即写盘并释放
```

### 并发参数（信号量）

| 信号量 | 并发 | 理由 |
|---|---|---|
| 全局在飞课数 | 4 | 限内存峰值 |
| prepare | 4 | 纯 IO |
| asr | 1 | Whisper 模型 2–4GB 单实例 |
| network（课级，翻译+TTS） | 2 | 课内已 4–8 路请求，2×8=16 在飞 |
| assemble | 2 | IndexedDB 写串行化 |
| export | 1 | WebCodecs 编码器上限 |

带字幕的课跳过 asr——主流课程（Udemy 等）大多带 `_en.srt`，瓶颈只剩 export。

### 关键依据（架构勘察确认）

- `storageService.saveProject({project})` 接受纯 `TProject`——无需 EditorCore（services/storage/service.ts:134）；
- `buildScene({tracks, mediaAssets, duration, canvasSize, background})` 与 `SceneExporter.export({rootNode})` 是纯函数（services/renderer/scene-builder.ts:226, scene-exporter.ts:47）；
- `extractTimelineAudio({tracks, mediaAssets, totalDuration})` 纯函数；`transcriptionService.transcribe` 不依赖编辑器；
- 翻译/TTS 是纯 fetch。

## 3. 零复制媒体与复核

- 源视频**永不**调用 `saveMediaAsset`。导出时在内存组装 `MediaAsset`（file 来自句柄）。
- 项目内视频元素持 `mediaId` 引用；course store 维护 `lessonId → {videoPath, mediaId}`。
- TTS 音频正常入项目存储（开箱即用的复核体验，量小）。
- **重新生成**某课：先 `editor.project.deleteProjects({ids:[旧projectId]})` 清旧项目与其媒体（修 IMP-2 泄漏）。
- **复核流**：/course 点"打开"（用户手势）→ 确认目录授权 → 取 File → 写入 course store 的 `pendingInjection {projectId, mediaId, file}` → `router.push(/editor/:id)` → 编辑器内轻量注入器（替代原全屏覆盖层）监听项目加载完成后 `editor.media.setAssets`（纯内存，不写盘）。编辑器页刷新后句柄丢失 → 显示"回 /course 重新打开"提示条。

## 4. /course 页面与入口

- `app/course/page.tsx`：导入向导（含 subs/ 子目录、宽松命名配对）、授权恢复横幅（手势内 requestPermission，修 IMP-5）、统一配置（音色/原声/字幕/语速 + 凭据区复用 CredentialsSection）、triage 课时表（含 移除所选/清空重导）、运行控制（开始/暂停/停止 + 在飞阶段可视化）、导出控制（自动导出开关 / 导出到 _localized / 导出所选 ZIP）。
- 编辑器 AI 配音面板的"批量"按钮 → `router.push("/course")`；首页项目列表加入口。
- 删除编辑器内 BatchCenter/ImportCourse 全屏覆盖层挂载。

## 5. 容错 · 续传 · 持久化

- persist 防抖 2s；终态（done/review/failed/exported）即时落库；IDB 连接模块级单例（修 IMP-1）。
- hydrate 只 `queryPermission` 不 request；授权恢复仅由按钮触发（修 IMP-5）。
- 暂停/停止：abort 信号在阶段边界检查；ASR 走 transcriptionService.cancel；在飞网络请求自然完成。
- runner 循环每轮重读 store 中课程是否仍存在（修 IMP-6 stale 快照）。
- 课程状态机不变（queued/processing/done/review/failed），新增 `outputPath`/`exportedAt`。

## 6. 审查发现 → 修复映射

| 发现 | 修复位置 |
|---|---|
| CRIT-1 视频复制进 OPFS | 架构消除（零复制） |
| CRIT-2/单课#1 AudioContext 泄漏与 6 实例上限 | 模块级共享 AudioContext 单例 + try/finally（adapter.ts 与 synthesize.ts） |
| CRIT-3 劫持活动编辑器 | 架构消除（无头引擎） |
| CRIT-4 导出整段入堆 | export.ts 支持流式 target，回退路径 buffer 即写即释；UI 标注长课内存上限 |
| CRIT-5 ZIP>4GB 静默损坏 | StoreZipWriter.addFile/finish 强制 ZIP_SIZE_LIMIT_BYTES 守卫，超限报错引导文件夹导出 |
| IMP-1 IDB 写风暴 | persist 防抖 + 连接单例 |
| IMP-2 重试泄漏旧项目 | 重跑前 deleteProjects |
| IMP-3 subs/ 子目录配对缺失 | scan.ts 合并 subs/subtitles/captions 子目录字幕到父目录映射 |
| IMP-4 objectURL 泄漏 | prepare/注入路径显式 revoke；processing.ts continue 路径补 revoke |
| IMP-5 无手势授权必败 | 授权恢复按钮（手势内） |
| IMP-6 stale 快照竞态 | 每轮重读 store |
| IMP-7 VTT Unicode 空白 | parseSubtitles 时间戳清洗加   -​ |
| IMP-8 confirmImport 非原子 | persist 失败 toast 并保留内存态可重试 |
| 单课#2 setSegmentSpeed 除零 | store.ts 加 rate>0 守卫 |
| 单课#3 finish_reason=length 静默截断 | translate route 检测并 502 报明确错误 |
| 单课#5 preview URL 泄漏 | preview.ts try/catch revoke |
| 单课#6 waitForInit 吞错 | service.ts 存 initError 并 reject |
| 单课#7/#10 翻译/TTS 串行 | 引擎并发；编辑器内 adapter.ts 同步改 8 路并发 |
| 单课#8/#11 store 时长启发式失真 | applyDubToTimeline 返回真实 rate，回写 store |
| 单课#9 Groq 25MB 无检查 | transcribe-cloud.ts 上传前限额校验 |

## 7. 性能预期（100 节、平均 10 分钟、80% 带字幕）

- 旧串行：~(转写 10min×20 + 翻译 0.5min×100 + TTS 0.7min×100 + 导出 3min×100) ≈ 全部相加 ≈ 10h+
- 新流水线：≈ max(ASR 串行段, 导出串行段) + 少量首尾 ≈ Σ导出(≈5h) 与 ASR 段重叠 → **约砍半，且全程编辑器可用**；带字幕比例越高越接近纯导出时间。

## 8. 验证策略

- 单元：semaphore、scan 配对（subs/ 子目录、_zh/_en 变体）、zip 守卫、translate 退化守卫（既有）。
- 集成（真实环境，用户跑）：3 节小课端到端（含 1 节无字幕）→ 校验时间轴连贯、_localized 产物可播放、暂停/续传、复核注入。
- 回归：`bunx tsc --noEmit` 零新增错误；编辑器内单课流程不回归。
