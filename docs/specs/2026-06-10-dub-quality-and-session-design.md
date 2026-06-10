# 配音质量与编辑器贴合 · 设计规格 v2

日期：2026-06-10 · 分支：feat/ai-dubbing · 前置：headless-course-pipeline 规格

## 诊断（来自真实跑批截图）

| 现象 | 真凶 |
|---|---|
| "and the screen" ×5 连排 + 退化长句 | **Whisper（Tiny）幻觉**：静音/音乐段复读机式输出。垃圾原文→翻译照译。**不是翻译问题** |
| 112 句、51 句加速、10 句超时 | 幻觉碎片 + ASR 切句过碎（逗号级），每个小槽位独立强行变速；变速纯机械 retime，×1.5 以上明显机器人感 |
| 批量产物点开进不了逐句编辑台 | 逐句状态只活在内存（useDubStore），批量 assemble 从未持久化 segments；打开项目永远落在 SetupView |

## 方案（三层，互相独立）

### 1. 转写净化 sanitize（新 `dub/sanitize.ts`，纯函数+测试）

按序应用于 **ASR 输出**（字幕 cue 只做 c 步合并）：

a. **退化句丢弃**：归一化（去空白/标点/小写）后，token 重复率 >60% 且 token≥6 的句子（"and the screen and the screen…"）直接丢——幻觉无信息量，丢掉后该处由背景原声覆盖。
b. **连排去重**：归一化文本与前一句相同 → 丢弃后者（保留首句原始时间）。
c. **句子整形（合并碎片）**：相邻段满足 `间隙<0.35s 且 前段不以句末标点（.!?。！？）结尾 且 合并后时长<8s` → 合并为一句（end 取后者，text 拼接）。把逗号级碎片拼回自然句——槽位变大，加速需求骤降。

### 2. 语速自适应两级化（重写 synthesize 拟合策略）

现状：TTS 恒 1.0× 合成 → 纯机械 retime（≥1.2× 即机器味）。
新策略（zh-dub skill 的 native-speed 思路，`nativeMaxSpeed=1.35` 字段终于派上用场）：

```
预估 needed = estimateDuration(译文) / 槽长
第一级：原生语速 nativeRatio = clamp(needed, 1, nativeMaxSpeed)   ← TTS speed_ratio 参数，听感自然
        synthesizeSegment({speedRatio: nativeRatio}) → 解码真实时长
第二级：残余 retime = clamp(real/槽长, MIN_NATURAL_RATE, maxSpeedup/nativeRatio)
                                                        ← 机械变速只兜底残余部分
显示/旗标用 总变速 = nativeRatio × retime
```

效果：×1.35 内全部自然语速消化；×1.35–×2.3 区间机械部分只承担 real/native 的小残余。配合 sanitize 的合并，加速句数量预期 51 → 个位数。

### 3. 配音会话持久化（批量 ↔ 编辑器贴合，新 `dub/session.ts`）

- `saveDubSession({projectId, segments, settings})` / `loadDubSession({projectId})` / `deleteDubSession`——存课程同源 IndexedDB（key `dub-session:<projectId>`）。
- **写入方**：批量 assemble 成功后保存；编辑器内「② 合成应用」成功后也保存。
- **读取方**：DubView 挂载/活动项目切换时，若 phase==="setup" 且该项目有会话 → 载入 segments+settings、直接进入 **逐句编辑台**（review）。
- 重新生成/删除项目时连带删除会话。
- 由此：批量产物点「打开」→ 注入视频 → **直接落在逐句编辑台**，全部译文/时长就位，可改可重新合成（幂等替换轨道）。

## 验证

- sanitize：bun:test 覆盖 幻觉丢弃/连排去重/碎片合并/正常句不动 ≥6 例。
- 两级变速：单测 nativeRatio/retime/总变速边界（needed<1、1~1.35、>1.35、>maxSpeedup）。
- 会话：tsc + 人工——批量跑一课 → 打开 → 应直接是逐句台。
