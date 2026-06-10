# 无头课程配音流水线 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把课程批量配音改造为不碰活动编辑器的无头并发流水线（零复制媒体 + /course 一级页），并修复审查发现的 18 个问题。

**Architecture:** `dub/course/engine/` 信号量调度的分阶段流水线；项目以纯数据构建经 `storageService.saveProject` 落库；导出走纯函数 `buildScene`+`SceneExporter`；视频零复制（句柄直读）。规格见 `docs/specs/2026-06-10-headless-course-pipeline-design.md`。

**Tech Stack:** TypeScript / Next.js App Router / Zustand / bun:test / mediabunny / File System Access API。

**通用验证命令**（每任务末尾运行）：
- `cd apps/web && bunx tsc --noEmit` → 非基线错误为 0（基线 12 个：keybinding/storage migrations/stickers/__tests__）
- 有测试的任务：`cd apps/web && bun test src/dub/course/engine/__tests__/<file>.test.ts`

---

### Task 1: 信号量与引擎信号原语

**Files:**
- Create: `apps/web/src/dub/course/engine/semaphore.ts`
- Test: `apps/web/src/dub/course/engine/__tests__/semaphore.test.ts`

- [ ] Step 1 写失败测试（acquire 限并发、release 放行、withPermit 异常也释放、AbortSignal 取消等待者）
- [ ] Step 2 `bun test …/semaphore.test.ts` 确认失败（模块不存在）
- [ ] Step 3 实现 `Semaphore { acquire(signal?), release(), withPermit(fn, signal?) }` + `class AbortError extends Error`
- [ ] Step 4 测试通过
- [ ] Step 5 commit `feat(course): engine semaphore primitive`

实现要点：FIFO 等待队列 `Array<{resolve, reject, signal}>`；`acquire` 时若 signal 已 aborted 立即 reject AbortError；signal abort 时从队列移除并 reject；`withPermit` 用 try/finally 保证 release。

### Task 2: 单课流程独立 bug 修复（6 处）

**Files:**
- Modify: `apps/web/src/dub/store.ts`（setSegmentSpeed 除零守卫，镜像 editSegment 的 `rate > 0 ?` 写法）
- Modify: `apps/web/src/dub/preview.ts`（`await audio.play()` 包 try/catch，失败 revokeObjectURL 并 return false）
- Modify: `apps/web/src/services/transcription/service.ts`（新增 `private initError: Error|null`；init-error 分支记录；`waitForInit` 在 `!isInitializing` 且有 initError 时 reject）
- Modify: `apps/web/src/app/api/dub/translate/route.ts`（解析前检查 `choices[0].finish_reason === "length"` → 502 `"翻译输出超长被截断，请缩小批次"`）
- Modify: `apps/web/src/dub/transcribe-cloud.ts`（上传前 `wav.size > 24*1024*1024` → throw 明确中文错误引导本地模式）
- Create: `apps/web/src/dub/audio-context.ts`（模块级共享 AudioContext：`getSharedAudioContext()`，closed 时重建）
- Modify: `apps/web/src/dub/adapter.ts`（用共享 ctx；TTS 循环包 try/finally——共享 ctx 不再 close，仅捕获异常向上抛）

- [ ] Step 1 依次实施上述 6 处修改（每处即改即查 tsc）
- [ ] Step 2 `bunx tsc --noEmit` 零新增
- [ ] Step 3 commit `fix(dub): six independent robustness fixes from code review`

### Task 3: 扫描配对增强 + 持久化修复

**Files:**
- Modify: `apps/web/src/dub/course/scan.ts`
- Modify: `apps/web/src/dub/course/subtitles.ts`（时间戳行 split 正则改 `/[\s  -​]+/`）
- Modify: `apps/web/src/dub/course/idb.ts`（模块级缓存 `let dbPromise: Promise<IDBDatabase>|null`，复用连接，去掉每次 close）
- Modify: `apps/web/src/dub/course/store.ts`（persist 防抖 2s + `persistNow` 终态即时；hydrate 只 queryPermission 不 requestPermission，新增 `needsPermission: boolean` 状态 + `restorePermission()` 动作（手势内调用，granted 后 rescan 重建句柄））
- Test: `apps/web/src/dub/course/engine/__tests__/scan-pairing.test.ts`（纯函数部分：抽出 `pairVideosWithSubtitles({videos, subs, childSubs})` 可测）

- [ ] Step 1 scan.ts：把目录内配对逻辑抽成纯函数 `pairVideosWithSubtitles`；walk 时先收集 `subs/`、`subtitles/`、`captions/`、`字幕/` 一级子目录的字幕并入父映射；videos/subs 配对维持 zh 优先
- [ ] Step 2 写并跑配对测试（含 `01-intro/video.mp4 + 01-intro/subs/video.en.srt`、`foo.mp4 + foo.zh-cn.srt`、无字幕）
- [ ] Step 3 store/idb 持久化修复（防抖、连接复用、needsPermission 流）
- [ ] Step 4 tsc 零新增 → commit `fix(course): subtitle pairing in subfolders + persistence hardening`

### Task 4: prepare 与 transcribe 阶段（无头取段）

**Files:**
- Create: `apps/web/src/dub/course/engine/stages/prepare.ts`
- Create: `apps/web/src/dub/course/engine/stages/transcribe.ts`
- Create: `apps/web/src/dub/course/engine/types.ts`

`types.ts` 核心类型：
```ts
export interface LessonWork {
  lessonId: string;
  stem: string;
  title: string;
  videoFile: File;
  meta: { duration: number; width: number; height: number; fps: number; hasAudio: boolean };
  subtitle: { lang: "en" | "zh"; cues: SubtitleCue[] } | null;
  segments: Segment[];
  clips: SynthesizedClip[];   // Task 5 产出
  projectId?: string;
}
export interface SynthesizedClip { segId: string; bytes: ArrayBuffer; realDuration: number; rate: number; fitted: number }
export interface EngineSignals { aborted: () => boolean; paused: () => Promise<void> }
```

`prepare.ts`：`prepareLesson({videoHandle, subtitleHandle, subtitleLang}) → {videoFile, meta, subtitle}`——`handle.getFile()` + `readVideoFile({file})`（mediabunny，返回 duration 秒/width/height/fps/hasAudio）+ 字幕 `file.text()` → `parseSubtitles`。

`transcribe.ts`：`transcribeLesson({videoFile, meta, modelId, onStep}) → Segment[]`——构建最小 SceneTracks（仅 main 轨一个 video 元素引用内存 asset）→ `extractTimelineAudio({tracks, mediaAssets:[asset], totalDuration: mediaTimeFromSeconds({seconds: meta.duration})})` → `decodeAudioToFloat32` → `transcriptionService.transcribe`。segments 映射复用 generate.ts 现有形状（提取公共 `segmentsFromTranscription` 到 `dub/course/segments.ts` 防 DRY 破坏）。

- [ ] Step 1 types.ts + prepare.ts 实现
- [ ] Step 2 transcribe.ts 实现（抽公共映射函数，generate.ts 改调它）
- [ ] Step 3 tsc 零新增 → commit `feat(course): headless prepare & transcribe stages`

### Task 5: 并发 synthesize 阶段 + 翻译批次并发化

**Files:**
- Create: `apps/web/src/dub/course/engine/stages/synthesize.ts`
- Modify: `apps/web/src/dub/translate.ts`（runPass 内批次 `Promise.allSettled` 4 路并发；保持重试轮次语义）
- Modify: `apps/web/src/dub/adapter.ts`（TTS 循环改为信号量 8 路并发：先并发 synth+decode 收集，再串行 addMediaAsset+build；完成后把真实 rate/fitted 回写返回值 `Map<segId,{rate,fitted,realDuration}>`，dub-view 应用回 store——修审查 #8/#11）

`synthesize.ts`：`synthesizeLesson({segments, settings, creds, onStep, signals}) → SynthesizedClip[]`——对 `translated` 非空段，Semaphore(8) 并发 `synthesizeSegment` + `getSharedAudioContext().decodeAudioData` 取真实时长 → `autoFitSpeed` → clip。单段失败重试 1 次，仍败记入 `failures[]` 并继续（最终若 failures>10% 抛错）。

- [ ] Step 1 synthesize.ts 实现
- [ ] Step 2 translate.ts 并发化（注意：去重逻辑/进度回调按完成数累计）
- [ ] Step 3 adapter.ts 并发化 + 真实时长回写（dub-view.tsx 的 apply 路径接收并 setSegments 同步）
- [ ] Step 4 tsc 零新增 → commit `perf(dub): concurrent TTS/translate + real-duration write-back`

### Task 6: assemble 阶段（纯数据建项目）

**Files:**
- Create: `apps/web/src/dub/course/engine/stages/assemble.ts`

`assembleLesson({work, settings, projectName}) → projectId`：
1. `buildDefaultScene({name:"Main scene", isMain:true})`；视频元素（mediaId=generateUUID 预生成，零复制——**不调 saveMediaAsset**）置于 main 轨，`duration: mediaTimeFromSeconds({seconds: meta.duration})`，params 走 `buildDefaultParamValues(getBuiltInElementParams({type:"video"}))`；
2. TTS 音频每 clip `new File([bytes], …)` → `storageService.saveMediaAsset({projectId, mediaAsset:{id:generateUUID(),…, ephemeral:true}})`（小文件正常入库）→ 构建 audio 元素（startTime=seg.start、duration=fitted、retime {rate, maintainPitch}）挂 `配音 · 中文` 轨；字幕开启时 `buildSubtitleTextElement` 挂 `字幕 · 中文` 轨；原声 mute/duck 直接写在 main 轨纯数据上（复用 adapter.ts `applyOriginalAudio` 抽出为公共函数）；
3. 组 `TProject { metadata:{id,name,duration:getProjectDurationFromScenes,createdAt,updatedAt}, scenes:[scene], currentSceneId, settings:{fps: floatToFrameRate(meta.fps)…, canvasSize:{width:meta.width,height:meta.height}, canvasSizeMode:"custom", background:{type:"color",color:DEFAULT_BACKGROUND_COLOR}}, version: CURRENT_PROJECT_VERSION }` → `storageService.saveProject({project})`；
4. course store 记 `lessonId → {videoMediaId, videoPath}` 供复核注入。

注意：saveMediaAsset 需要 projectId 先于 saveProject 存在——顺序：先 generateUUID 做 projectId → 存媒体 → 存项目（验证 storage 层无外键约束，纯 kv 可行）。

- [ ] Step 1 抽 `applyOriginalAudio` 到 `dub/original-audio.ts`（adapter.ts 改引用）
- [ ] Step 2 assemble.ts 实现
- [ ] Step 3 tsc 零新增 → commit `feat(course): headless project assembly (zero-copy video)`

### Task 7: export 阶段（无头渲染 + ZIP 守卫）

**Files:**
- Create: `apps/web/src/dub/course/engine/stages/export.ts`
- Modify: `apps/web/src/dub/course/zip.ts`（addFile/finish 强制 `ZIP_SIZE_LIMIT_BYTES` 守卫 + 单文件 >4GB 拒绝）
- Modify: `apps/web/src/dub/course/export-batch.ts`（renderLesson 改调无头 `renderLessonHeadless`，不再 loadProject 进编辑器）
- Test: `apps/web/src/dub/course/engine/__tests__/zip-guard.test.ts`

`export.ts` `renderLessonHeadless({project, mediaAssets, onProgress}) → ArrayBuffer`：镜像 renderer-manager.exportProject 141-232 行逻辑但全部入参化——`calculateTotalDuration({tracks})` → `createTimelineAudioBuffer({tracks, mediaAssets, duration})` → `buildScene({tracks, mediaAssets, duration, canvasSize: project.settings.canvasSize, background: project.settings.background})` → `new SceneExporter({width,height,fps: project.settings.fps, format:"mp4", quality:"high", shouldIncludeAudio:true, audioBuffer})` → `exporter.export({rootNode})`。mediaAssets = [内存视频 asset（句柄 File）] + 项目存储里加载的 TTS 音频（`storageService.loadAllMediaAssets({projectId})`）。buffer 写盘后置 null 释放。

- [ ] Step 1 zip 守卫 + 测试（构造超限 offset 断言 throw）
- [ ] Step 2 export.ts 实现；export-batch.ts 切换到无头渲染（保留 _localized 与 ZIP 两种 sink）
- [ ] Step 3 tsc 零新增 → commit `feat(course): headless export + enforced zip guard`

### Task 8: pipeline + scheduler（并发编排）

**Files:**
- Create: `apps/web/src/dub/course/engine/pipeline.ts`
- Create: `apps/web/src/dub/course/engine/scheduler.ts`
- Modify: `apps/web/src/dub/course/runner.ts`（改薄壳：转调 scheduler；保留导出 API 兼容）
- Delete logic: `apps/web/src/dub/course/lesson-pipeline.ts`（被 stages 取代，文件删除）

`scheduler.ts`：
```ts
const SEMS = { inflight: new Semaphore(4), prepare: new Semaphore(4), asr: new Semaphore(1), network: new Semaphore(2), assemble: new Semaphore(2), export: new Semaphore(1) };
export async function runCourse({ onlyIds, autoExport }: {...}): Promise<void>
```
- 目标课 = onlyIds ?? status==="queued"；onlyIds 重跑前先 `editor.project.deleteProjects({ids:[旧projectId]})`（修 IMP-2，注意：用 EditorCore 仅做存储删除，不 load）；
- `await Promise.allSettled(targets.map(l => runLesson(l)))`；runLesson 每阶段前检查 store 中课是否仍存在 + abort 信号（修 IMP-6）；
- 进度经 store.updateLesson（已防抖持久化）；终态 `persistNow`；
- 暂停=置 paused Promise gate；停止=abort 信号，等待在飞自然结束。

`pipeline.ts` `runLesson`：inflight 包裹全程；prepare→(无字幕→asr)→(zh 字幕直配 else network: translate)→network: synthesize→assemble→(autoExport && export)。状态机沿用 queued/processing/done/review/failed；flagged 判定沿用 sped/overflow 计数。

- [ ] Step 1 pipeline.ts + scheduler.ts 实现
- [ ] Step 2 runner.ts 薄壳化、删除 lesson-pipeline.ts、修正全部引用
- [ ] Step 3 tsc 零新增 → commit `feat(course): concurrent staged scheduler replaces serial runner`

### Task 9: /course 一级页 + 入口收敛 + 复核注入

**Files:**
- Create: `apps/web/src/app/course/page.tsx`（"use client"；挂 BatchCenter 的页面化版本 + ImportCourse + 授权横幅）
- Modify: `apps/web/src/dub/course/components/batch-center.tsx`（fixed overlay → 普通页面布局；"返回编辑器"→ router.back()；新增 暂停/恢复 按钮、needsPermission 横幅（调 restorePermission）、自动导出开关（store 增 `autoExport: boolean`，传 scheduler）；"打开"改走 pendingInjection 流）
- Modify: `apps/web/src/dub/course/components/course-overlay.tsx`（移除 BatchCenter/ImportCourse 渲染；改为 ReviewInjector：监听 `pendingInjection` + `useEditor(e=>e.project.getActiveOrNull())`，匹配 projectId 且媒体加载完后 `editor.media.setAssets({assets:[...e.media.getAssets(), videoAsset]})` 注入内存视频资产并清除 pending；若进入 dub 复核项目但无 pending（刷新场景）显示顶部提示条"视频源未注入，请回 /course 重新打开"）
- Modify: `apps/web/src/dub/components/dub-view.tsx`（"批量"按钮 → `router.push("/course")`）
- Modify: `apps/web/src/dub/course/store.ts`（新增 `pendingInjection: {projectId, mediaId, file} | null`、`autoExport`、`paused`）

- [ ] Step 1 store 扩展 + course-overlay 改造为 ReviewInjector
- [ ] Step 2 /course 页面 + batch-center 页面化（含暂停/授权/自动导出 UI）
- [ ] Step 3 dub-view 入口改路由；删除编辑器页对 BatchCenter 的依赖
- [ ] Step 4 tsc 零新增 → commit `feat(course): standalone /course workspace + review injector`

### Task 10: 收尾验证

- [ ] Step 1 `bun test`（全部 engine 测试 + 既有 __tests__ 不回归）
- [ ] Step 2 `bunx tsc --noEmit` 全仓非基线为 0
- [ ] Step 3 `bun run lint`（仅检查本次新文件无报错；基线告警忽略）
- [ ] Step 4 grep 校验：无任何残留 `lesson-pipeline` 引用；`saveMediaAsset` 不出现在视频路径；`loadProject` 不出现在 engine/
- [ ] Step 5 commit `chore(course): final verification pass` + 把规格/计划文档一并入库
- [ ] Step 6 人工端到端清单（需用户真机）：3 节小课导入→并发生成（观察编辑器同时可用）→暂停/恢复→复核注入→自动导出 _localized→ZIP 守卫提示

## Self-Review

- 规格覆盖：§2 引擎=T1/4/5/6/7/8；§3 零复制与复核=T6/9；§4 页面=T9；§5 容错续传=T3/8；§6 修复映射全部落位（CRIT-1→T6、CRIT-2→T2、CRIT-3→T8、CRIT-4→T7（buffer 即写即释 + 上限注记）、CRIT-5→T7、IMP-1/5/7/8→T3、IMP-2/6→T8、IMP-3/4→T3/T4、单课 6 项→T2、#7/#10/#8/#11→T5、#9→T2）。无缺口。
- 占位符：无 TBD；各任务给出函数签名与数据形状，长函数以"镜像 renderer-manager 141-232"方式给出可定位的实现蓝本。
- 类型一致性：LessonWork/SynthesizedClip/Semaphore 等命名在 T4-T8 间一致。
