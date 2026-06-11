"use client";

import { Fragment, useCallback, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";

// ---------------------------------------------------------------------------
// Hero — Hero307-style isometric dashboard with mouse parallax.
// Follows the site theme: light + dark variants throughout.
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
        "relative h-svh max-h-[1200px] min-h-[600px] w-full overflow-hidden bg-background pt-32 font-sans text-foreground md:pt-40",
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
      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <div className="absolute top-0 left-0 h-[81.25rem] w-[35rem] -translate-y-[21.875rem] rotate-[-45deg] rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
        <div className="absolute top-0 left-0 h-[81.25rem] w-[15rem] origin-top-left translate-x-[5%] translate-y-[-5%] rotate-[-45deg] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
        <div className="absolute top-0 left-0 h-[81.25rem] w-[15rem] origin-top-left translate-x-[180%] translate-y-[70%] rotate-[-45deg] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
      </div>
      <div className="pointer-events-none absolute inset-0 dark:hidden">
        <div className="absolute top-0 left-0 h-[81.25rem] w-[35rem] -translate-y-[21.875rem] rotate-[-45deg] rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,15%,.05)_0,hsla(0,0%,45%,.015)_50%,hsla(0,0%,55%,0)_80%)]" />
        <div className="absolute top-0 left-0 h-[81.25rem] w-[15rem] origin-top-left translate-x-[5%] translate-y-[-5%] rotate-[-45deg] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,15%,.04)_0,hsla(0,0%,55%,.015)_80%,transparent_100%)]" />
        <div className="absolute top-0 left-0 h-[81.25rem] w-[15rem] origin-top-left translate-x-[180%] translate-y-[70%] rotate-[-45deg] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,15%,.03)_0,hsla(0,0%,55%,.015)_80%,transparent_100%)]" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Dashboard mock — dubcopilot 课程批量配音中心（明暗双主题）
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

// 仪表盘双主题色组（浅色 → dark: 深色）
const T = {
  panel: "border-neutral-200 dark:border-neutral-800",
  panelFaint: "border-neutral-200/60 dark:border-neutral-800/50",
  chrome: "border-neutral-300 dark:border-neutral-700",
  ink: "text-neutral-900 dark:text-neutral-100",
  inkFaint: "text-neutral-400 dark:text-neutral-600",
  fill: "bg-neutral-100 dark:bg-neutral-800",
  fillSoft: "bg-neutral-50 dark:bg-neutral-900",
  dot: "bg-neutral-300 dark:bg-neutral-700",
  bar: "bg-neutral-300 dark:bg-neutral-700",
  barHover: "bg-neutral-700 dark:bg-neutral-300",
  gauge: "bg-neutral-400 dark:bg-neutral-600",
  gaugeStrong: "bg-neutral-500 dark:bg-neutral-400",
};

const Dashboard = () => {
  const [hoveredMetric, setHoveredMetric] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("总览");
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-sm border bg-white shadow-2xl select-none dark:bg-neutral-900",
        T.chrome,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-3",
          T.panel,
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-full", T.dot)} />
          <span className={cn("size-2.5 rounded-full", T.dot)} />
          <span className={cn("size-2.5 rounded-full", T.dot)} />
          <span className="ml-4 hidden font-mono text-xs text-neutral-500 sm:inline">
            dubcopilot &middot; 课程批量中心
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span
            className={cn("hidden rounded border px-2 py-0.5 sm:inline", T.chrome)}
          >
            ⌘K
          </span>
          <span className={cn("size-5 rounded-full border", T.chrome, T.fill)} />
        </div>
      </div>

      <div className="grid grid-cols-1 text-left md:grid-cols-[160px_1fr]">
        <aside className={cn("hidden border-r py-4 md:block", T.panel)}>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <img
                src="/logos/dubcopilot/svg/logo.svg"
                alt="dubcopilot"
                className="size-6 rounded"
              />
              <span className={cn("text-xs font-medium", T.ink)}>
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
                    ? cn(
                        "border-neutral-700 font-medium dark:border-neutral-300",
                        T.fill,
                        T.ink,
                      )
                    : "border-transparent text-neutral-500 hover:bg-neutral-100/60 hover:text-neutral-900 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-100",
                )}
              >
                <span className="text-[0.65rem] opacity-60">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className={cn("mt-6 border-t px-4 pt-4", T.panel)}>
            <div className="text-xs text-neutral-500">本月 TTS 用量</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={cn("text-xs font-medium", T.ink)}>
                53 万字符
              </span>
              <span className="font-mono text-[0.55rem] text-neutral-500">
                · 自有密钥
              </span>
            </div>
            <div
              className={cn("mt-2 h-1 overflow-hidden rounded-full", T.fill)}
            >
              <div
                className={cn("h-full", T.gaugeStrong)}
                style={{ width: "53%" }}
              />
            </div>
          </div>
        </aside>

        <div className="p-4 md:p-5">
          <div
            className={cn("flex items-center gap-4 border-b pb-3", T.panel)}
          >
            {NAV.map((tab) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => setActiveTab(tab.label)}
                className={cn(
                  "pb-1 text-xs transition-colors",
                  activeTab === tab.label
                    ? cn(
                        "border-b border-neutral-700 dark:border-neutral-300",
                        T.ink,
                      )
                    : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100",
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
                  "cursor-default border p-2.5 transition-colors md:p-3",
                  T.panel,
                  hoveredMetric === i &&
                    cn("border-neutral-300 dark:border-neutral-700", T.fillSoft),
                )}
              >
                <div className="text-xs text-neutral-500">{m.label}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "font-display text-base tracking-tight md:text-xl",
                      T.ink,
                    )}
                  >
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
            <div className={cn("border p-3 md:p-4", T.panel)}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-neutral-500">
                    配音课时 &middot; 2026
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "font-display text-2xl tracking-tight md:text-3xl",
                        T.ink,
                      )}
                    >
                      392 节
                    </span>
                    <span className="font-mono text-[0.55rem] text-neutral-500">
                      较去年 +20.1%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-500">
                  <span
                    className={cn("rounded border px-1.5 py-0.5", T.chrome, T.fill)}
                  >
                    按月
                  </span>
                  <span className={cn("rounded border px-1.5 py-0.5", T.panel)}>
                    按周
                  </span>
                </div>
              </div>
              <div className={cn("mt-4 h-28 md:h-36", T.ink)}>
                <BarChart
                  data={DUB_DATA}
                  hoveredBar={hoveredBar}
                  onHover={setHoveredBar}
                />
              </div>
            </div>

            <div className={cn("border p-3 md:p-4", T.panel)}>
              <div className="flex items-center justify-between">
                <div className="text-xs text-neutral-500">最近完成</div>
                <span
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono text-[0.55rem] text-neutral-500",
                    T.panel,
                    T.fillSoft,
                  )}
                >
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
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full font-mono text-[0.55rem]",
                          T.fill,
                          T.ink,
                        )}
                      >
                        {lesson.badge}
                      </span>
                      <div>
                        <div
                          className={cn(
                            "text-xs leading-tight font-medium",
                            T.ink,
                          )}
                        >
                          {lesson.name}
                        </div>
                        <div className="font-mono text-[0.55rem] text-neutral-500">
                          {lesson.meta}
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "font-mono text-xs tabular-nums",
                        T.ink,
                      )}
                    >
                      {lesson.duration}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr]">
            <div className={cn("border p-3 md:p-4", T.panel)}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-neutral-500">
                    TTS 合成 &middot; 近 24 小时
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "font-display text-2xl tracking-tight md:text-3xl",
                        T.ink,
                      )}
                    >
                      2.48 万
                    </span>
                    <span className="font-mono text-[0.55rem] text-neutral-500">
                      字符
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-500">
                  <span
                    className={cn("rounded border px-1.5 py-0.5", T.chrome, T.fill)}
                  >
                    24h
                  </span>
                  <span className={cn("rounded border px-1.5 py-0.5", T.panel)}>
                    7d
                  </span>
                  <span className={cn("rounded border px-1.5 py-0.5", T.panel)}>
                    30d
                  </span>
                </div>
              </div>
              <div className={cn("mt-4 h-28 md:h-36", T.ink)}>
                <AreaChart data={TTS_DATA} />
              </div>
            </div>

            <div className={cn("border p-3 md:p-4", T.panel)}>
              <div className="text-xs text-neutral-500">音色使用分布</div>
              <ul className="mt-4 space-y-3">
                {VOICE_USAGE.map((item) => (
                  <li key={item.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={T.ink}>{item.label}</span>
                      <span className="font-mono text-neutral-500">
                        {item.value}%
                      </span>
                    </div>
                    <div
                      className={cn(
                        "mt-1.5 h-1 overflow-hidden rounded-full",
                        T.fill,
                      )}
                    >
                      <div
                        className={cn("h-full", T.gauge)}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={cn("mt-4 border p-3 md:p-4", T.panel)}>
            <div className="flex items-center justify-between">
              <div className="text-xs text-neutral-500">课程进度</div>
              <span className="text-xs text-neutral-500">近 30 天</span>
            </div>
            <div className="mt-3 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 gap-y-0 text-xs">
                <div
                  className={cn("border-b py-2 text-xs text-neutral-500", T.panel)}
                >
                  课程
                </div>
                <div
                  className={cn(
                    "border-b py-2 text-right text-xs text-neutral-500",
                    T.panel,
                  )}
                >
                  课时
                </div>
                <div
                  className={cn(
                    "border-b py-2 text-right text-xs text-neutral-500",
                    T.panel,
                  )}
                >
                  已完成
                </div>
                <div
                  className={cn(
                    "border-b py-2 text-right text-xs text-neutral-500",
                    T.panel,
                  )}
                >
                  待复核
                </div>
                {COURSE_PROGRESS.map((row) => (
                  <Fragment key={row.course}>
                    <div
                      className={cn(
                        "border-b py-2.5 font-mono text-[0.65rem]",
                        T.panelFaint,
                        T.ink,
                      )}
                    >
                      {row.course}
                    </div>
                    <div
                      className={cn(
                        "border-b py-2.5 text-right font-mono text-[0.65rem] tabular-nums",
                        T.panelFaint,
                        T.ink,
                      )}
                    >
                      {row.lessons}
                    </div>
                    <div
                      className={cn(
                        "border-b py-2.5 text-right font-mono text-[0.65rem] text-neutral-500 tabular-nums",
                        T.panelFaint,
                      )}
                    >
                      {row.done}
                    </div>
                    <div
                      className={cn(
                        "border-b py-2.5 text-right font-mono text-[0.65rem] text-neutral-500 tabular-nums",
                        T.panelFaint,
                      )}
                    >
                      {row.flagged}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className={cn("mt-4 border p-3 md:p-4", T.panel)}>
            <div className="flex items-center justify-between">
              <div className="text-xs text-neutral-500">配音任务记录</div>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[0.55rem] text-neutral-500",
                  T.panel,
                  T.fillSoft,
                )}
              >
                {TASK_ROWS.length} 条
              </span>
            </div>
            <div className="mt-3 overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 gap-y-0 text-xs">
                <div
                  className={cn("border-b py-2 text-xs text-neutral-500", T.panel)}
                >
                  任务
                </div>
                <div
                  className={cn("border-b py-2 text-xs text-neutral-500", T.panel)}
                >
                  课时
                </div>
                <div
                  className={cn("border-b py-2 text-xs text-neutral-500", T.panel)}
                >
                  状态
                </div>
                <div
                  className={cn("border-b py-2 text-xs text-neutral-500", T.panel)}
                >
                  阶段
                </div>
                <div
                  className={cn(
                    "border-b py-2 text-right text-xs text-neutral-500",
                    T.panel,
                  )}
                >
                  时长
                </div>
                <div
                  className={cn(
                    "border-b py-2 text-right text-xs text-neutral-500",
                    T.panel,
                  )}
                >
                  日期
                </div>
                {TASK_ROWS.map((row) => (
                  <Fragment key={row.id}>
                    <div
                      className={cn(
                        "border-b py-2.5 font-mono text-[0.65rem] text-neutral-500",
                        T.panelFaint,
                      )}
                    >
                      {row.id}
                    </div>
                    <div
                      className={cn("border-b py-2.5 text-xs", T.panelFaint, T.ink)}
                    >
                      {row.lesson}
                    </div>
                    <div className={cn("border-b py-2.5", T.panelFaint)}>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 font-mono text-[0.55rem]",
                          row.status === "已完成" &&
                            "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
                          row.status === "处理中" &&
                            "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
                          row.status === "失败" &&
                            "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
                        )}
                      >
                        {row.status}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "border-b py-2.5 font-mono text-[0.65rem] text-neutral-500",
                        T.panelFaint,
                      )}
                    >
                      {row.stage}
                    </div>
                    <div
                      className={cn(
                        "border-b py-2.5 text-right font-mono text-[0.65rem] tabular-nums",
                        T.panelFaint,
                        T.ink,
                      )}
                    >
                      {row.duration}
                    </div>
                    <div
                      className={cn(
                        "border-b py-2.5 text-right font-mono text-[0.65rem] text-neutral-500 tabular-nums",
                        T.panelFaint,
                      )}
                    >
                      {row.date}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
            <div className={cn("border p-3 md:p-4", T.panel)}>
              <div className="text-xs text-neutral-500">流水线动态</div>
              <ul className="mt-3 space-y-0">
                {ACTIVITY.map((item, i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex items-start gap-3 border-b py-3 last:border-0",
                      T.panelFaint,
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[0.45rem]",
                        T.fill,
                        T.ink,
                      )}
                    >
                      {item.badge}
                    </span>
                    <div className="flex-1">
                      <div className="text-xs">
                        <span className={cn("font-medium", T.ink)}>
                          {item.item}
                        </span>{" "}
                        <span className="text-neutral-500">{item.action}</span>
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 font-mono text-[0.55rem]",
                          T.inkFaint,
                        )}
                      >
                        {item.time}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className={cn("border p-3 md:p-4", T.panel)}>
                <div className="text-xs text-neutral-500">语速达标率</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-display text-3xl tracking-tight",
                      T.ink,
                    )}
                  >
                    96.8%
                  </span>
                  <span className="font-mono text-[0.55rem] text-neutral-500">
                    较上周 +0.4%
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1">
                  {[94.2, 95.1, 94.8, 96.4, 96.1, 95.7, 96.8].map((v, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          "relative h-12 w-full overflow-hidden rounded-[1px]",
                          T.fill,
                        )}
                      >
                        <div
                          className={cn("absolute inset-x-0 bottom-0", T.gauge)}
                          style={{ height: `${((v - 90) / 10) * 100}%` }}
                        />
                      </div>
                      <span className={cn("text-[0.45rem]", T.inkFaint)}>
                        {["一", "二", "三", "四", "五", "六", "日"][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={cn("border p-3 md:p-4", T.panel)}>
                <div className="text-xs text-neutral-500">批量任务成功率</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-display text-3xl tracking-tight",
                      T.ink,
                    )}
                  >
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
                        i === 17
                          ? T.gaugeStrong
                          : "bg-neutral-200/60 dark:bg-neutral-800/60",
                      )}
                    />
                  ))}
                </div>
                <div
                  className={cn(
                    "mt-1.5 flex justify-between text-[0.45rem]",
                    T.inkFaint,
                  )}
                >
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
                <div
                  className={cn(
                    "absolute -top-5 left-1/2 -translate-x-1/2 rounded border px-1.5 py-0.5 font-mono text-[0.5rem] whitespace-nowrap shadow-lg",
                    "border-neutral-300 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100",
                  )}
                >
                  {d.value} 节
                </div>
              )}
              <div
                className={cn(
                  "w-full rounded-[1px] transition-all duration-200",
                  hoveredBar === i ? T.barHover : T.bar,
                )}
                style={{ height }}
              />
            </div>
            <span
              className={cn(
                "text-[0.45rem] transition-colors",
                hoveredBar === i ? T.ink : T.inkFaint,
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
