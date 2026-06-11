"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";

// ---------------------------------------------------------------------------
// Hero — Hero307-style isometric showcase with mouse parallax.
// The tilted panel is a mock of the dubcopilot editor (AI 配音工作台).
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
                <div className="pointer-events-auto absolute inset-0 mx-auto mt-[11.25rem] h-[160rem] w-[120rem] [transform-origin:top_left] [transform:scale(.7)_rotateX(47deg)_rotateY(21deg)_rotate(330deg)] rounded-xl shadow-[-40px_-48px_120px_rgba(71,85,105,0.06),32px_48px_120px_rgba(71,85,105,0.08)] md:mt-[17.5rem] md:[transform:translateX(2%)_scale(1.2)_rotateX(47deg)_rotateY(31deg)_rotate(324deg)] dark:shadow-[-24px_-28px_48px_rgba(0,0,0,0.45)]">
                  <EditorMock />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-transparent from-80% to-background dark:block"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute top-[30%] left-0 z-10 h-[60%] w-[50%] bg-radial-[ellipse_at_30%_50%] from-foreground/[0.03] to-transparent to-65% dark:from-foreground/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-48 bg-linear-to-b from-transparent via-background/60 to-background dark:hidden"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 hidden bg-linear-to-b from-transparent from-50% to-background dark:block"
      />
      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <div className="absolute top-0 left-0 h-[81.25rem] w-[35rem] -translate-y-[21.875rem] rotate-[-45deg] rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
        <div className="absolute top-0 left-0 h-[81.25rem] w-[15rem] origin-top-left translate-x-[5%] translate-y-[-5%] rotate-[-45deg] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
        <div className="absolute top-0 left-0 h-[81.25rem] w-[15rem] origin-top-left translate-x-[180%] translate-y-[70%] rotate-[-45deg] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
      </div>
      <div className="pointer-events-none absolute inset-0 dark:hidden">
        <div className="absolute top-0 left-0 h-[81.25rem] w-[35rem] -translate-y-[21.875rem] rotate-[-45deg] rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(215,35%,45%,.025)_0,hsla(215,30%,55%,.01)_50%,hsla(215,30%,60%,0)_80%)]" />
        <div className="absolute top-0 left-0 h-[81.25rem] w-[15rem] origin-top-left translate-x-[5%] translate-y-[-5%] rotate-[-45deg] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(215,35%,45%,.02)_0,hsla(215,30%,60%,.008)_80%,transparent_100%)]" />
        <div className="absolute top-0 left-0 h-[81.25rem] w-[15rem] origin-top-left translate-x-[180%] translate-y-[70%] rotate-[-45deg] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(215,35%,45%,.015)_0,hsla(215,30%,60%,.008)_80%,transparent_100%)]" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// EditorMock — dubcopilot 编辑器界面（AI 配音工作台，明暗双主题）
// ---------------------------------------------------------------------------

// 双主题色组（浅色 → dark: 深色）
const T = {
  panel: "border-neutral-200 dark:border-neutral-800",
  panelFaint: "border-neutral-200/60 dark:border-neutral-800/50",
  chrome: "border-neutral-300 dark:border-neutral-700",
  ink: "text-neutral-900 dark:text-neutral-100",
  inkFaint: "text-neutral-400 dark:text-neutral-600",
  fill: "bg-neutral-100 dark:bg-neutral-800",
  fillSoft: "bg-neutral-50 dark:bg-neutral-900",
};

const SEGMENTS = [
  {
    t: "0:00",
    en: "And that's now it for this section.",
    zh: "这一节的内容就是这些了。",
  },
  {
    t: "0:04",
    en: "In this section we had an in-depth look into Next.js using the app router.",
    zh: "在这一节中，我们深入了解了使用 app router 的 Next.js。",
  },
  {
    t: "0:11",
    en: "And you learned how you can set up routes by using the file system…",
    zh: "你还学会了如何通过文件系统（在 app 目录内）来设置路由。",
  },
  {
    t: "0:22",
    en: "You also learned about other special files like error.js…",
    zh: "你还了解了其他特殊文件，比如处理错误的 error.js 和 loading.js。",
  },
  {
    t: "0:39",
    en: "…more granular control by using Suspense, which is what we t…",
    zh: "学会了通过 Suspense 获得更细粒度的控制。",
  },
  {
    t: "0:57",
    en: "Individual meals where we don't know in advance how many…",
    zh: "最重要的是，这些页面最终只是导出标准的 React 组件。",
  },
  {
    t: "1:14",
    en: "Using Next.js, they are server components executed on the server…",
    zh: "使用 Next.js 时，它们是服务器组件，在服务器上执行并渲染。",
  },
];

const FILTER_CHIPS = [
  { label: "全部 24", active: true },
  { label: "未译 0" },
  { label: "超时 0" },
  { label: "加速 2" },
  { label: "已改 0" },
];

const VOICE_CHIPS = ["原声", "静音", "轻 5%", "标准 12%", "明显 25%"];

const RAIL_ICONS = ["▤", "♫", "T", "☺", "✂", "≡", "⚙"];

const TIMELINE_TICKS = [
  "00:00",
  "00:03",
  "00:06",
  "00:09",
  "00:12",
  "00:15",
  "00:18",
  "00:21",
  "00:24",
  "00:27",
  "00:30",
  "00:33",
];

// 字幕块（文本轨）：left/width 为时间轴百分比
const TEXT_BLOCKS = [
  { left: 0, width: 10.5, zh: "这一节的内容就是这些了。" },
  { left: 11, width: 17, zh: "在这一节中，我们深入了解了使用 app router 的 Next.js。" },
  { left: 28.5, width: 29, zh: "你还学会了如何通过文件系统（在 app 目录内）来设置路由，并使用像 page.js 和 layout.js 这样的特殊文件名。" },
  { left: 58.5, width: 41, zh: "你还了解了其他特殊文件，比如用于处理错误的 error.js、用于处理未找到错误的 not-found.js、以及 loading.js 文件。" },
];

// 配音块（音频轨）
const AUDIO_BLOCKS = [
  { left: 0, width: 5.5, label: "配音 1" },
  { left: 11, width: 14, label: "配音 2" },
  { left: 28.5, width: 27, label: "配音 3" },
  { left: 58.5, width: 33, label: "配音 4" },
];

// 确定性伪波形高度（0~1）
const wave = (n: number, seed: number) =>
  Array.from(
    { length: n },
    (_, i) => 0.25 + 0.7 * Math.abs(Math.sin(i * 1.7 + seed)),
  );

const EditorMock = () => {
  const [selected, setSelected] = useState(1);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-sm border bg-white text-left shadow-2xl select-none dark:bg-neutral-900",
        T.chrome,
      )}
    >
      {/* 顶栏 */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-2.5",
          T.panel,
        )}
      >
        <div className="flex items-center gap-3">
          <img
            src="/logos/dubcopilot/svg/logo.svg"
            alt="dubcopilot"
            className="size-5 rounded"
          />
          <span
            className={cn(
              "rounded border px-2 py-0.5 text-xs font-medium",
              T.panel,
              T.ink,
            )}
          >
            简体中文配音
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1 text-xs font-medium text-white">
            <Download className="size-3" />
            Export
          </span>
          <span className={cn("size-5 rounded-full border", T.chrome, T.fill)} />
        </div>
      </div>

      {/* 主区域：图标栏 / AI 配音面板 / 预览 / 配音设置 */}
      <div className="grid grid-cols-[2.5rem_19rem_1fr_18rem]">
        {/* 图标栏 */}
        <div
          className={cn(
            "flex flex-col items-center gap-4 border-r py-4 text-sm text-neutral-400 dark:text-neutral-600",
            T.panel,
          )}
        >
          {RAIL_ICONS.map((icon, i) => (
            <span
              key={i}
              className={cn(i === 0 && "text-blue-500 dark:text-blue-400")}
            >
              {icon}
            </span>
          ))}
        </div>

        {/* AI 配音面板 */}
        <div className={cn("flex flex-col border-r", T.panel)}>
          <div className="flex items-center justify-between px-3 pt-3">
            <div className="flex items-center gap-1.5">
              <span className={cn("text-xs font-semibold", T.ink)}>
                AI 配音
              </span>
              <span className="rounded bg-blue-100 px-1 py-px font-mono text-[0.5rem] text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                BETA
              </span>
            </div>
            <span
              className={cn(
                "rounded border px-2 py-0.5 text-[0.6rem] text-neutral-500",
                T.panel,
              )}
            >
              批量中心 →
            </span>
          </div>
          <div className="flex items-center gap-1 px-3 pt-2.5">
            {FILTER_CHIPS.map((chip) => (
              <span
                key={chip.label}
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[0.55rem]",
                  chip.active
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                    : "text-neutral-500",
                )}
              >
                {chip.label}
              </span>
            ))}
          </div>
          <div className="px-3 pt-2.5">
            <div
              className={cn(
                "rounded border px-2.5 py-1.5 text-[0.65rem] text-neutral-400 dark:text-neutral-600",
                T.panel,
                T.fillSoft,
              )}
            >
              搜索译文 / 原文…
            </div>
          </div>

          {/* 字幕段落列表 */}
          <ul className="mt-2 flex-1">
            {SEGMENTS.map((seg, i) => (
              <li key={seg.t}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  className={cn(
                    "flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors",
                    selected === i
                      ? "bg-blue-50 dark:bg-blue-950/40"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40",
                  )}
                >
                  <span className="pt-px font-mono text-[0.55rem] text-neutral-400 dark:text-neutral-600">
                    {seg.t}
                  </span>
                  <span className="flex-1">
                    <span className="block truncate text-[0.6rem] text-neutral-400 dark:text-neutral-500">
                      {seg.en}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[0.65rem] leading-snug",
                        T.ink,
                      )}
                    >
                      {seg.zh}
                    </span>
                  </span>
                  <span className="pt-px text-[0.55rem] text-neutral-300 dark:text-neutral-700">
                    ▷
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* 面板底部操作 */}
          <div className={cn("border-t px-3 py-2.5", T.panel)}>
            <div className="flex items-center gap-1">
              {VOICE_CHIPS.map((chip, i) => (
                <span
                  key={chip}
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono text-[0.5rem]",
                    i === 3
                      ? cn("font-medium", T.chrome, T.fill, T.ink)
                      : cn("text-neutral-500", T.panel),
                  )}
                >
                  {chip}
                </span>
              ))}
            </div>
            <div
              className={cn(
                "mt-2.5 rounded-md py-2 text-center text-[0.65rem] font-medium",
                "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900",
              )}
            >
              ▷ ② 合成配音并应用到时间轴
            </div>
            <div
              className={cn(
                "mt-1.5 rounded-md border py-1.5 text-center text-[0.6rem] text-neutral-500",
                T.panel,
              )}
            >
              ✓ 复核通过，返回批量中心
            </div>
          </div>
        </div>

        {/* 视频预览（白天浅色课程录屏，深色模式保持暗色影院感） */}
        <div className="flex flex-col bg-neutral-100 dark:bg-neutral-950">
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {/* 模拟视频画面：代码编辑器风格色块 */}
            <div className="absolute inset-6 rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/80">
              <div className="flex gap-3">
                <div className="w-28 space-y-1.5">
                  {[
                    "app",
                    "community",
                    "meals",
                    "[mealSlug]",
                    "page.js",
                    "share",
                    "error.js",
                    "layout.js",
                  ].map((f, i) => (
                    <div
                      key={f}
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[0.55rem]",
                        i === 6
                          ? "bg-neutral-200 text-neutral-700 dark:bg-neutral-700/60 dark:text-neutral-200"
                          : "text-neutral-400 dark:text-neutral-500",
                      )}
                      style={{ marginLeft: `${(i % 4) * 6}px` }}
                    >
                      {f}
                    </div>
                  ))}
                </div>
                <div className="flex-1 space-y-1.5 pt-1">
                  {[88, 72, 95, 60, 80, 45, 90, 66, 75, 52].map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-4 text-right font-mono text-[0.5rem] text-neutral-300 dark:text-neutral-700">
                        {i + 3}
                      </span>
                      <div
                        className={cn(
                          "h-1.5 rounded-full",
                          i % 3 === 0
                            ? "bg-blue-500/35 dark:bg-blue-400/30"
                            : i % 3 === 1
                              ? "bg-emerald-500/30 dark:bg-emerald-400/25"
                              : "bg-neutral-400/40 dark:bg-neutral-600/40",
                        )}
                        style={{ width: `${w * 0.8}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* 字幕浮层 */}
            <div className="absolute inset-x-0 bottom-8 z-10 px-10 text-center">
              <span className="inline-block rounded bg-black/70 px-3 py-1.5 text-sm font-medium text-white">
                {SEGMENTS[selected]?.zh}
              </span>
            </div>
          </div>
          {/* 播放控制条 */}
          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 dark:border-neutral-800">
            <span className="font-mono text-[0.6rem] text-neutral-500 dark:text-neutral-400">
              00:00:08:06{" "}
              <span className="text-neutral-400 dark:text-neutral-600">
                / 00:04:25:25
              </span>
            </span>
            <span className="text-xs text-neutral-600 dark:text-neutral-300">
              ⏸
            </span>
            <div className="flex items-center gap-2 text-[0.6rem] text-neutral-500 dark:text-neutral-400">
              <span className="rounded border border-neutral-300 px-1.5 py-0.5 dark:border-neutral-700">
                Fit ▾
              </span>
              <span>⛶</span>
            </div>
          </div>
        </div>

        {/* 配音设置 */}
        <div className={cn("flex flex-col gap-3 border-l p-3.5", T.panel)}>
          <div>
            <div className={cn("text-xs font-semibold", T.ink)}>配音设置</div>
            <div className="mt-1 text-[0.55rem] leading-relaxed text-neutral-400 dark:text-neutral-600">
              任何阶段都可调整——改完点左侧「合成配音并应用」生效
            </div>
          </div>

          <div
            className={cn(
              "flex items-center justify-between rounded border px-2.5 py-1.5",
              T.panel,
            )}
          >
            <span className={cn("text-[0.65rem]", T.ink)}>语音 / 翻译凭据</span>
            <span className="rounded bg-emerald-100 px-1.5 py-px font-mono text-[0.5rem] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              已配置
            </span>
          </div>

          <div>
            <div className="text-[0.6rem] text-neutral-500">翻译方向</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className={cn(
                  "flex-1 rounded border px-2 py-1 text-[0.65rem]",
                  T.panel,
                  T.ink,
                )}
              >
                自动检测 ▾
              </span>
              <span className="text-[0.6rem] text-neutral-400">→</span>
              <span
                className={cn(
                  "flex-1 rounded border px-2 py-1 text-[0.65rem]",
                  T.panel,
                  T.ink,
                )}
              >
                简体中文 ▾
              </span>
            </div>
          </div>

          <div>
            <div className="text-[0.6rem] text-neutral-500">配音音色</div>
            <div
              className={cn(
                "mt-1.5 flex items-center gap-2 rounded border px-2.5 py-2",
                T.panel,
              )}
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-blue-100 text-[0.6rem] text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                刘
              </span>
              <span className="flex-1">
                <span className={cn("block text-[0.65rem] font-medium", T.ink)}>
                  刘飞
                </span>
                <span className="block text-[0.55rem] text-neutral-500">
                  男声 · 沉稳磁性
                </span>
              </span>
              <span className="text-[0.6rem] text-neutral-400">▾</span>
            </div>
          </div>

          <div>
            <div className="text-[0.6rem] text-neutral-500">原声处理</div>
            <div className="mt-1.5 flex items-center gap-1">
              {VOICE_CHIPS.map((chip, i) => (
                <span
                  key={chip}
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono text-[0.5rem]",
                    i === 3
                      ? cn("font-medium", T.chrome, T.fill, T.ink)
                      : cn("text-neutral-500", T.panel),
                  )}
                >
                  {chip}
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-1">
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[0.5rem] font-medium",
                  T.chrome,
                  T.fill,
                  T.ink,
                )}
              >
                静音原声
              </span>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[0.5rem] text-neutral-500",
                  T.panel,
                )}
              >
                保留为背景
              </span>
            </div>
          </div>

          <MockSlider label="背景音量" value="39%" pct={39} />

          <div>
            <div className="flex items-center justify-between">
              <span className={cn("text-[0.65rem]", T.ink)}>
                同时生成简体中文字幕
              </span>
              <MockCheck />
            </div>
            <div className="mt-1.5 flex items-center gap-1">
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[0.5rem] font-medium",
                  T.chrome,
                  T.fill,
                  T.ink,
                )}
              >
                软字幕（可关）
              </span>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[0.5rem] text-neutral-500",
                  T.panel,
                )}
              >
                烧录到画面
              </span>
            </div>
          </div>

          <div className={cn("rounded border p-2.5", T.panel)}>
            <div className="flex items-center justify-between">
              <span className={cn("text-[0.65rem] font-medium", T.ink)}>
                语速与对齐
              </span>
              <MockCheck />
            </div>
            <div className="mt-1 text-[0.55rem] leading-relaxed text-neutral-400 dark:text-neutral-600">
              语速自适应：译文偏长时自动加速，贴合原时长
            </div>
            <div className="mt-2.5 space-y-2.5">
              <MockSlider label="原声最大语速" value="×1.35" pct={62} />
              <MockSlider label="最大变速" value="×2.3" pct={78} />
            </div>
          </div>
        </div>
      </div>

      {/* 时间轴 */}
      <div className={cn("border-t", T.panel)}>
        {/* 工具条 */}
        <div
          className={cn(
            "flex items-center justify-between border-b px-3 py-1.5",
            T.panel,
          )}
        >
          <div className="flex items-center gap-3 text-[0.65rem] text-neutral-400 dark:text-neutral-600">
            {["✂", "⊢", "⊣", "⧉", "✦", "🗑", "🔖"].map((icon, i) => (
              <span key={i}>{icon}</span>
            ))}
          </div>
          <span
            className={cn(
              "rounded border px-2 py-0.5 text-[0.6rem]",
              T.panel,
              T.ink,
            )}
          >
            Main scene ▾
          </span>
          <div className="flex items-center gap-2 text-[0.65rem] text-neutral-400 dark:text-neutral-600">
            <span className="text-blue-500 dark:text-blue-400">⊜</span>
            <span>⇔</span>
            <span>⊖</span>
            <span className={cn("h-1 w-16 rounded-full", T.fill)}>
              <span className="block h-full w-1/2 rounded-full bg-neutral-400 dark:bg-neutral-500" />
            </span>
            <span>⊕</span>
          </div>
        </div>

        {/* 刻度尺 */}
        <div className="relative">
          <div
            className={cn(
              "flex border-b px-14 font-mono text-[0.55rem] text-neutral-400 dark:text-neutral-600",
              T.panel,
            )}
          >
            {TIMELINE_TICKS.map((tick) => (
              <span key={tick} className="flex-1 py-1">
                {tick}
              </span>
            ))}
          </div>

          {/* 播放头 */}
          <div className="absolute top-0 bottom-0 left-[26%] z-10 w-px bg-blue-500">
            <span className="absolute -top-0 -left-1 size-2 rounded-sm bg-blue-500" />
          </div>

          {/* 文本轨 */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className="w-9 text-center text-[0.6rem] text-neutral-400 dark:text-neutral-600">
              ◎ T
            </span>
            <div className="relative h-7 flex-1">
              {TEXT_BLOCKS.map((block) => (
                <span
                  key={block.left}
                  className="absolute top-0 flex h-full items-center overflow-hidden rounded-sm bg-teal-600/80 px-1.5 dark:bg-teal-700/80"
                  style={{ left: `${block.left}%`, width: `${block.width}%` }}
                >
                  <span className="truncate text-[0.55rem] text-white">
                    {block.zh}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* 视频轨（始终深色缩略条） */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className="w-9 text-center text-[0.6rem] text-neutral-400 dark:text-neutral-600">
              ♪ ◫
            </span>
            <div className="relative h-10 flex-1 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-950">
              <span className="absolute top-1 left-2 z-10 font-mono text-[0.5rem] text-neutral-600 dark:text-neutral-400">
                049-module-summary.mp4
              </span>
              <div className="flex h-full dark:hidden">
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className="h-full flex-1 border-r border-neutral-300"
                    style={{
                      background: `linear-gradient(180deg, hsla(${200 + (i % 5) * 8},35%,${88 - (i % 4) * 3}%,1), hsla(${220 + (i % 3) * 10},30%,${80 - (i % 3) * 3}%,1))`,
                    }}
                  />
                ))}
              </div>
              <div className="hidden h-full dark:flex">
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className="h-full flex-1 border-r border-neutral-800"
                    style={{
                      background: `linear-gradient(180deg, hsla(${200 + (i % 5) * 8},25%,${18 + (i % 4) * 4}%,1), hsla(${220 + (i % 3) * 10},20%,${10 + (i % 3) * 4}%,1))`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 配音轨（紫色波形块） */}
          <div className="flex items-center gap-2 px-3 py-1.5 pb-3">
            <span className="w-9 text-center text-[0.6rem] text-neutral-400 dark:text-neutral-600">
              ♪ ≣
            </span>
            <div className="relative h-10 flex-1">
              {AUDIO_BLOCKS.map((block, b) => (
                <span
                  key={block.label}
                  className="absolute top-0 flex h-full flex-col overflow-hidden rounded-sm bg-violet-500/90 px-1.5 pt-0.5 dark:bg-violet-600/90"
                  style={{ left: `${block.left}%`, width: `${block.width}%` }}
                >
                  <span className="font-mono text-[0.45rem] text-violet-100">
                    {block.label}
                  </span>
                  <span className="flex flex-1 items-center gap-px">
                    {wave(28, b * 2.3).map((h, i) => (
                      <span
                        key={i}
                        className="w-px flex-1 rounded-full bg-violet-200/90"
                        style={{ height: `${h * 100}%` }}
                      />
                    ))}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MockSlider = ({
  label,
  value,
  pct,
}: {
  label: string;
  value: string;
  pct: number;
}) => (
  <div>
    <div className="flex items-center justify-between">
      <span className="text-[0.6rem] text-neutral-500">{label}</span>
      <span className={cn("font-mono text-[0.6rem]", T.ink)}>{value}</span>
    </div>
    <div
      className={cn("relative mt-1.5 h-1 rounded-full", T.fill)}
    >
      <span
        className="absolute top-0 left-0 h-full rounded-full bg-blue-500"
        style={{ width: `${pct}%` }}
      />
      <span
        className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-blue-500 bg-white dark:bg-neutral-900"
        style={{ left: `calc(${pct}% - 5px)` }}
      />
    </div>
  </div>
);

const MockCheck = () => (
  <span className="flex size-3.5 items-center justify-center rounded-sm bg-blue-500 text-[0.5rem] text-white">
    ✓
  </span>
);
