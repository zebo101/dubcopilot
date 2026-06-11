"use client";

import { Fragment, useCallback, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";

// ---------------------------------------------------------------------------
// Hero — Hero307-style isometric dashboard with mouse parallax
// ---------------------------------------------------------------------------

interface HeroButton {
  text: string;
  url: string;
}

interface HeroProps {
  className?: string;
  heading?: string;
  description?: string;
  buttons?: {
    primary?: HeroButton;
    secondary?: HeroButton;
  };
}

const DEFAULTS = {
  heading: "AI 视频配音，跨越语言边界",
  description:
    "上传视频，自动语音转写、AI 字幕翻译，豆包 TTS 合成自然中文配音，带字幕一键导出成片，整门课程也能批量处理。",
  buttons: {
    primary: {
      text: "立即开始配音",
      url: "/projects",
    },
    secondary: {
      text: "课程批量中心",
      url: "/course",
    },
  },
} satisfies HeroProps;

const TILT_DEG = 4;
const TRANSLATE_PX = 12;

export function Hero(props: HeroProps) {
  const { heading, description, buttons, className } = {
    ...DEFAULTS,
    ...props,
  };

  const illustrationRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = illustrationRef.current;
      if (!el) return;
      el.style.transform = [
        `translate(${nx * TRANSLATE_PX}px, ${ny * TRANSLATE_PX}px)`,
        `rotateY(${nx * TILT_DEG}deg)`,
        `rotateX(${-ny * TILT_DEG}deg)`,
      ].join(" ");
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const el = illustrationRef.current;
    if (el)
      el.style.transform = "translate(0px, 0px) rotateY(0deg) rotateX(0deg)";
  }, []);

  return (
    <section
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "dark relative h-svh max-h-[1200px] min-h-[600px] w-full overflow-hidden bg-background pt-32 font-sans text-foreground md:pt-40",
        className,
      )}
    >
      <div className="container mx-auto px-6">
        <div className="relative z-20 flex flex-col gap-5">
          <h1 className="md:leading-tighter max-w-3xl text-5xl leading-[1.05] tracking-tight text-balance md:text-7xl lg:text-7xl">
            {heading}
          </h1>
          <div className="max-w-2xl">
            <p className="text-center text-xl font-medium text-muted-foreground md:text-left">
              {description}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 py-4 md:flex-row">
            {buttons?.primary && (
              <Button size="lg" asChild>
                <Link href={buttons.primary.url}>{buttons.primary.text}</Link>
              </Button>
            )}
            {buttons?.secondary && (
              <Button size="lg" variant="outline" asChild>
                <Link href={buttons.secondary.url}>
                  {buttons.secondary.text}
                </Link>
              </Button>
            )}
          </div>
          <div
            className="pointer-events-none relative -mt-[8.75rem] w-full"
            style={{ perspective: "1200px" }}
          >
            <div
              ref={illustrationRef}
              className="h-[60rem] w-full transition-transform duration-500 ease-out will-change-transform md:h-[85rem]"
            >
              <div className="relative size-full [perspective-origin:100%_0] [perspective:4000px] [transform-style:preserve-3d]">
                <div className="pointer-events-auto absolute inset-0 mx-auto mt-[11.25rem] h-[160rem] w-[120rem] [transform-origin:top_left] [transform:scale(.7)_rotateX(47deg)_rotateY(21deg)_rotate(330deg)] rounded-xl shadow-[-24px_-28px_48px_rgba(0,0,0,0.15)] md:mt-[17.5rem] md:[transform:translateX(2%)_scale(1.2)_rotateX(47deg)_rotateY(31deg)_rotate(324deg)] dark:shadow-[-24px_-28px_48px_rgba(0,0,0,0.45)]">
                  <Dashboard />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent from-80% to-background"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute top-[30%] left-0 z-10 h-[60%] w-[50%] bg-radial-[ellipse_at_30%_50%] from-foreground/10 to-transparent to-65%"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 bg-linear-to-b from-transparent from-50% to-background"
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-0 h-[81.25rem] w-[35rem] -translate-y-[21.875rem] rotate-[-45deg] rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
        <div className="absolute top-0 left-0 h-[81.25rem] w-[15rem] origin-top-left translate-x-[5%] translate-y-[-5%] rotate-[-45deg] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
        <div className="absolute top-0 left-0 h-[81.25rem] w-[15rem] origin-top-left translate-x-[180%] translate-y-[70%] rotate-[-45deg] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Dashboard mock — dubcopilot 课程批量配音中心
// ---------------------------------------------------------------------------

const NAV = [
  { label: "总览", active: true },
  { label: "转写" },
  { label: "翻译" },
  { label: "配音" },
  { label: "导出" },
];

const METRICS = [
  { label: "课时总数", value: "128", change: "全部已扫描入库" },
  { label: "配音完成", value: "96", change: "本周 +12 节" },
  { label: "处理中", value: "8", change: "流水线运行中" },
  { label: "待复核", value: "14", change: "语速/溢出标记" },
];

const DUB_DATA = [
  { month: "1月", value: 18 },
  { month: "2月", value: 22 },
  { month: "3月", value: 19 },
  { month: "4月", value: 28 },
  { month: "5月", value: 32 },
  { month: "6月", value: 26 },
  { month: "7月", value: 34 },
  { month: "8月", value: 38 },
  { month: "9月", value: 42 },
  { month: "10月", value: 36 },
  { month: "11月", value: 48 },
  { month: "12月", value: 52 },
];

const RECENT_DONE = [
  { badge: "12", name: "12-react-hooks.mp4", meta: "React 进阶 · 第三章", duration: "08:24" },
  { badge: "07", name: "07-async-await.mp4", meta: "JS 异步编程 · 第二章", duration: "12:08" },
  { badge: "21", name: "21-docker-compose.mp4", meta: "DevOps 实战 · 第五章", duration: "15:42" },
  { badge: "03", name: "03-sql-joins.mp4", meta: "数据库基础 · 第一章", duration: "09:51" },
  { badge: "16", name: "16-rust-ownership.mp4", meta: "Rust 入门 · 第四章", duration: "11:17" },
];

const SIDEBAR_ITEMS = [
  { icon: "◫", label: "批量中心", active: true },
  { icon: "⊞", label: "工程" },
  { icon: "⊡", label: "课程库" },
  { icon: "◇", label: "导出" },
  { icon: "⚙", label: "设置" },
];

const TTS_DATA = [
  12, 18, 14, 22, 19, 26, 24, 31, 28, 35, 32, 38, 36, 42, 39, 45, 41, 48, 44,
  52, 49, 55, 51, 58,
];

const TASK_ROWS = [
  { id: "TASK-128", lesson: "12-react-hooks.mp4", status: "已完成", stage: "配音合成", duration: "08:24", date: "2026-06-11" },
  { id: "TASK-127", lesson: "11-react-context.mp4", status: "处理中", stage: "字幕翻译", duration: "10:03", date: "2026-06-11" },
  { id: "TASK-126", lesson: "10-react-router.mp4", status: "已完成", stage: "配音合成", duration: "13:36", date: "2026-06-10" },
  { id: "TASK-125", lesson: "09-react-state.mp4", status: "失败", stage: "语音转写", duration: "07:48", date: "2026-06-10" },
  { id: "TASK-124", lesson: "08-react-props.mp4", status: "已完成", stage: "配音合成", duration: "09:15", date: "2026-06-09" },
  { id: "TASK-123", lesson: "07-async-await.mp4", status: "已完成", stage: "配音合成", duration: "12:08", date: "2026-06-09" },
  { id: "TASK-122", lesson: "06-promises.mp4", status: "处理中", stage: "配音合成", duration: "11:29", date: "2026-06-08" },
  { id: "TASK-121", lesson: "05-event-loop.mp4", status: "已完成", stage: "配音合成", duration: "14:02", date: "2026-06-08" },
];

const ACTIVITY = [
  { badge: "音", item: "12-react-hooks.mp4", action: "配音合成完成，已装配工程", time: "2 分钟前" },
  { badge: "译", item: "11-react-context.mp4", action: "字幕翻译完成，进入配音队列", time: "8 分钟前" },
  { badge: "转", item: "13-react-suspense.mp4", action: "语音转写完成，共 142 句", time: "14 分钟前" },
  { badge: "标", item: "09-react-state.mp4", action: "3 句语速超限，已标记待复核", time: "22 分钟前" },
  { badge: "出", item: "04-css-grid.mp4", action: "成片导出完成（带字幕）", time: "31 分钟前" },
  { badge: "扫", item: "Rust 入门", action: "课程扫描完成，新增 24 节课时", time: "45 分钟前" },
];

const COURSE_PROGRESS = [
  { course: "react-advanced", lessons: "32 节", done: "28", flagged: "2" },
  { course: "js-async", lessons: "24 节", done: "24", flagged: "0" },
  { course: "devops-in-action", lessons: "28 节", done: "21", flagged: "5" },
  { course: "sql-fundamentals", lessons: "20 节", done: "15", flagged: "3" },
  { course: "rust-beginners", lessons: "24 节", done: "8", flagged: "4" },
];

const VOICE_USAGE = [
  { label: "知性女声", value: 42 },
  { label: "沉稳男声", value: 18 },
  { label: "活力女声", value: 14 },
  { label: "纪录片男声", value: 11 },
  { label: "温柔女声", value: 8 },
  { label: "其他音色", value: 7 },
];

const Dashboard = () => {
  const [hoveredMetric, setHoveredMetric] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("总览");
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  return (
    <div className="overflow-hidden rounded-sm border border-neutral-700 bg-neutral-900 shadow-2xl select-none">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-neutral-700" />
          <span className="size-2.5 rounded-full bg-neutral-700" />
          <span className="size-2.5 rounded-full bg-neutral-700" />
          <span className="ml-4 hidden font-mono text-xs text-neutral-500 sm:inline">
            dubcopilot &middot; 课程批量中心
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="hidden rounded border border-neutral-700 px-2 py-0.5 sm:inline">
            ⌘K
          </span>
          <span className="size-5 rounded-full border border-neutral-700 bg-neutral-800" />
        </div>
      </div>

      <div className="grid grid-cols-1 text-left md:grid-cols-[160px_1fr]">
        <aside className="hidden border-r border-neutral-800 py-4 md:block">
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <img
                src="/logos/dubcopilot/svg/logo.svg"
                alt="dubcopilot"
                className="size-6 rounded"
              />
              <span className="text-xs font-medium text-neutral-100">
                dubcopilot
              </span>
            </div>
          </div>
          <nav className="space-y-0.5 text-sm">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2.5 border-l-2 px-4 py-1.5 text-left text-xs transition-colors",
                  item.active
                    ? "border-neutral-300 bg-neutral-800 font-medium text-neutral-100"
                    : "border-transparent text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-100",
                )}
              >
                <span className="text-[0.65rem] opacity-60">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-6 border-t border-neutral-800 px-4 pt-4">
            <div className="text-xs text-neutral-500">本月 TTS 用量</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xs font-medium text-neutral-100">
                53 万字符
              </span>
              <span className="font-mono text-[0.55rem] text-neutral-500">
                · 自有密钥
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full bg-neutral-400" style={{ width: "53%" }} />
            </div>
          </div>
        </aside>

        <div className="p-4 md:p-5">
          <div className="flex items-center gap-4 border-b border-neutral-800 pb-3">
            {NAV.map((tab) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => setActiveTab(tab.label)}
                className={cn(
                  "pb-1 text-xs transition-colors",
                  activeTab === tab.label
                    ? "border-b border-neutral-300 text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-100",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {METRICS.map((m, i) => (
              <div
                key={m.label}
                onMouseEnter={() => setHoveredMetric(i)}
                onMouseLeave={() => setHoveredMetric(null)}
                className={cn(
                  "cursor-default border border-neutral-800 p-2.5 transition-colors md:p-3",
                  hoveredMetric === i && "border-neutral-700 bg-neutral-900/50",
                )}
              >
                <div className="text-xs text-neutral-500">{m.label}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-display text-base tracking-tight text-neutral-100 md:text-xl">
                    {m.value}
                  </span>
                </div>
                <span className="mt-0.5 inline-block font-mono text-[0.55rem] text-neutral-500">
                  {m.change}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr]">
            <div className="border border-neutral-800 p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-neutral-500">
                    配音课时 &middot; 2026
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-display text-2xl tracking-tight text-neutral-100 md:text-3xl">
                      392 节
                    </span>
                    <span className="font-mono text-[0.55rem] text-neutral-500">
                      较去年 +20.1%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-500">
                  <span className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5">
                    按月
                  </span>
                  <span className="rounded border border-neutral-800 px-1.5 py-0.5">
                    按周
                  </span>
                </div>
              </div>
              <div className="mt-4 h-28 text-neutral-100 md:h-36">
                <BarChart
                  data={DUB_DATA}
                  hoveredBar={hoveredBar}
                  onHover={setHoveredBar}
                />
              </div>
            </div>

            <div className="border border-neutral-800 p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-neutral-500">最近完成</div>
                <span className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 font-mono text-[0.55rem] text-neutral-500">
                  今日 {RECENT_DONE.length} 节
                </span>
              </div>
              <ul className="mt-3 space-y-3">
                {RECENT_DONE.map((lesson) => (
                  <li
                    key={lesson.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-6 items-center justify-center rounded-full bg-neutral-800 font-mono text-[0.55rem] text-neutral-100">
                        {lesson.badge}
                      </span>
                      <div>
                        <div className="text-xs leading-tight font-medium text-neutral-100">
                          {lesson.name}
                        </div>
                        <div className="font-mono text-[0.55rem] text-neutral-500">
                          {lesson.meta}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-neutral-100 tabular-nums">
                      {lesson.duration}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr]">
            <div className="border border-neutral-800 p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-neutral-500">
                    TTS 合成 &middot; 近 24 小时
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-display text-2xl tracking-tight text-neutral-100 md:text-3xl">
                      2.48 万
                    </span>
                    <span className="font-mono text-[0.55rem] text-neutral-500">
                      字符
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-500">
                  <span className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5">
                    24h
                  </span>
                  <span className="rounded border border-neutral-800 px-1.5 py-0.5">
                    7d
                  </span>
                  <span className="rounded border border-neutral-800 px-1.5 py-0.5">
                    30d
                  </span>
                </div>
              </div>
              <div className="mt-4 h-28 text-neutral-100 md:h-36">
                <AreaChart data={TTS_DATA} />
              </div>
            </div>

            <div className="border border-neutral-800 p-3 md:p-4">
              <div className="text-xs text-neutral-500">音色使用分布</div>
              <ul className="mt-4 space-y-3">
                {VOICE_USAGE.map((item) => (
                  <li key={item.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-100">{item.label}</span>
                      <span className="font-mono text-neutral-500">
                        {item.value}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full bg-neutral-600"
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 border border-neutral-800 p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-neutral-500">课程进度</div>
              <span className="text-xs text-neutral-500">近 30 天</span>
            </div>
            <div className="mt-3 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 gap-y-0 text-xs">
                <div className="border-b border-neutral-800 py-2 text-xs text-neutral-500">
                  课程
                </div>
                <div className="border-b border-neutral-800 py-2 text-right text-xs text-neutral-500">
                  课时
                </div>
                <div className="border-b border-neutral-800 py-2 text-right text-xs text-neutral-500">
                  已完成
                </div>
                <div className="border-b border-neutral-800 py-2 text-right text-xs text-neutral-500">
                  待复核
                </div>
                {COURSE_PROGRESS.map((row) => (
                  <Fragment key={row.course}>
                    <div className="border-b border-neutral-800/50 py-2.5 font-mono text-[0.65rem] text-neutral-100">
                      {row.course}
                    </div>
                    <div className="border-b border-neutral-800/50 py-2.5 text-right font-mono text-[0.65rem] text-neutral-100 tabular-nums">
                      {row.lessons}
                    </div>
                    <div className="border-b border-neutral-800/50 py-2.5 text-right font-mono text-[0.65rem] text-neutral-500 tabular-nums">
                      {row.done}
                    </div>
                    <div className="border-b border-neutral-800/50 py-2.5 text-right font-mono text-[0.65rem] text-neutral-500 tabular-nums">
                      {row.flagged}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 border border-neutral-800 p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-neutral-500">配音任务记录</div>
              <span className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 font-mono text-[0.55rem] text-neutral-500">
                {TASK_ROWS.length} 条
              </span>
            </div>
            <div className="mt-3 overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 gap-y-0 text-xs">
                <div className="border-b border-neutral-800 py-2 text-xs text-neutral-500">
                  任务
                </div>
                <div className="border-b border-neutral-800 py-2 text-xs text-neutral-500">
                  课时
                </div>
                <div className="border-b border-neutral-800 py-2 text-xs text-neutral-500">
                  状态
                </div>
                <div className="border-b border-neutral-800 py-2 text-xs text-neutral-500">
                  阶段
                </div>
                <div className="border-b border-neutral-800 py-2 text-right text-xs text-neutral-500">
                  时长
                </div>
                <div className="border-b border-neutral-800 py-2 text-right text-xs text-neutral-500">
                  日期
                </div>
                {TASK_ROWS.map((row) => (
                  <Fragment key={row.id}>
                    <div className="border-b border-neutral-800/50 py-2.5 font-mono text-[0.65rem] text-neutral-500">
                      {row.id}
                    </div>
                    <div className="border-b border-neutral-800/50 py-2.5 text-xs text-neutral-100">
                      {row.lesson}
                    </div>
                    <div className="border-b border-neutral-800/50 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 font-mono text-[0.55rem]",
                          row.status === "已完成" &&
                            "bg-neutral-800 text-neutral-300",
                          row.status === "处理中" &&
                            "bg-amber-950 text-amber-400",
                          row.status === "失败" && "bg-red-950 text-red-400",
                        )}
                      >
                        {row.status}
                      </span>
                    </div>
                    <div className="border-b border-neutral-800/50 py-2.5 font-mono text-[0.65rem] text-neutral-500">
                      {row.stage}
                    </div>
                    <div className="border-b border-neutral-800/50 py-2.5 text-right font-mono text-[0.65rem] text-neutral-100 tabular-nums">
                      {row.duration}
                    </div>
                    <div className="border-b border-neutral-800/50 py-2.5 text-right font-mono text-[0.65rem] text-neutral-500 tabular-nums">
                      {row.date}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
            <div className="border border-neutral-800 p-3 md:p-4">
              <div className="text-xs text-neutral-500">流水线动态</div>
              <ul className="mt-3 space-y-0">
                {ACTIVITY.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 border-b border-neutral-800/50 py-3 last:border-0"
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-mono text-[0.45rem] text-neutral-100">
                      {item.badge}
                    </span>
                    <div className="flex-1">
                      <div className="text-xs">
                        <span className="font-medium text-neutral-100">
                          {item.item}
                        </span>{" "}
                        <span className="text-neutral-500">{item.action}</span>
                      </div>
                      <div className="mt-0.5 font-mono text-[0.55rem] text-neutral-600">
                        {item.time}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="border border-neutral-800 p-3 md:p-4">
                <div className="text-xs text-neutral-500">语速达标率</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-3xl tracking-tight text-neutral-100">
                    96.8%
                  </span>
                  <span className="font-mono text-[0.55rem] text-neutral-500">
                    较上周 +0.4%
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1">
                  {[94.2, 95.1, 94.8, 96.4, 96.1, 95.7, 96.8].map((v, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="relative h-12 w-full overflow-hidden rounded-[1px] bg-neutral-800">
                        <div
                          className="absolute inset-x-0 bottom-0 bg-neutral-600"
                          style={{ height: `${((v - 90) / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-[0.45rem] text-neutral-600">
                        {["一", "二", "三", "四", "五", "六", "日"][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-neutral-800 p-3 md:p-4">
                <div className="text-xs text-neutral-500">批量任务成功率</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-3xl tracking-tight text-neutral-100">
                    99.2%
                  </span>
                  <span className="font-mono text-[0.55rem] text-neutral-500">
                    近 30 次运行
                  </span>
                </div>
                <div className="mt-3 flex gap-0.5">
                  {Array.from({ length: 30 }, (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-4 flex-1 rounded-[1px]",
                        i === 17 ? "bg-neutral-400" : "bg-neutral-800/60",
                      )}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between text-[0.45rem] text-neutral-600">
                  <span>30 天前</span>
                  <span>今天</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BarChart = ({
  data,
  hoveredBar,
  onHover,
}: {
  data: typeof DUB_DATA;
  hoveredBar: number | null;
  onHover: (i: number | null) => void;
}) => {
  const max = Math.max(...data.map((d) => d.value));

  return (
    <div className="flex h-full items-end gap-1">
      {data.map((d, i) => {
        const height = `${(d.value / max) * 100}%`;
        return (
          <div
            key={d.month}
            className="group flex flex-1 flex-col items-center gap-1"
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="relative flex w-full flex-1 items-end">
              {hoveredBar === i && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 font-mono text-[0.5rem] whitespace-nowrap text-neutral-100 shadow-lg">
                  {d.value} 节
                </div>
              )}
              <div
                className={cn(
                  "w-full rounded-[1px] transition-all duration-200",
                  hoveredBar === i ? "bg-neutral-300" : "bg-neutral-700",
                )}
                style={{ height }}
              />
            </div>
            <span
              className={cn(
                "text-[0.45rem] transition-colors",
                hoveredBar === i ? "text-neutral-100" : "text-neutral-600",
              )}
            >
              {d.month}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const AreaChart = ({ data }: { data: number[] }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 100;
  const H = 100;
  const pt = (v: number, i: number) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * 78 - 10;
    return { x, y };
  };
  const points = data.map((v, i) => pt(v, i));
  const lineStr = points.map((p) => `${p.x},${p.y}`).join(" ");
  const tip = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dash-area-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map((y) => (
        <line
          key={y}
          x1={0}
          x2={W}
          y1={y}
          y2={y}
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeDasharray="1 2"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <polyline
        points={`0,${H} ${lineStr} ${W},${H}`}
        fill="url(#dash-area-fill)"
      />
      <polyline
        points={lineStr}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={tip.x}
        cy={tip.y}
        r="1.2"
        fill="currentColor"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={tip.x}
        cy={tip.y}
        r="2.5"
        fill="currentColor"
        fillOpacity="0.18"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};
