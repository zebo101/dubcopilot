import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  BadgeCheck,
  Briefcase,
  Captions,
  CheckCheck,
  FolderSearch,
  GraduationCap,
  KeyRound,
  Languages,
  Layers,
  Mic2,
  Presentation,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Workflow,
  Youtube,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ---------------------------------------------------------------------------
// Landing sections — SEO 结构：每个 section 一个 H2，卡片标题为 H3
// ---------------------------------------------------------------------------

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
      <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">{title}</h2>
      {description ? (
        <p className="text-muted-foreground lg:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-6">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

// --- 三步流程 ---------------------------------------------------------------

const STEPS = [
  {
    icon: <Upload className="size-5" />,
    title: "上传视频，自动语音转写",
    description:
      "把外语课程视频拖进 dubcopilot，AI 语音识别自动生成逐句字幕和时间轴，无需手动听写。",
  },
  {
    icon: <Languages className="size-5" />,
    title: "AI 字幕翻译，逐句可改",
    description:
      "字幕自动翻译成中文，译文逐句对照原文展示，任何一句不满意都可以直接修改后重新合成。",
  },
  {
    icon: <AudioLines className="size-5" />,
    title: "合成配音，带字幕导出",
    description:
      "豆包 TTS 把译文合成自然中文配音，自动对齐原视频时间轴，一键导出带字幕的配音成片。",
  },
];

export function HowItWorks() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          title="三步完成视频翻译配音"
          description="从原始视频到中文配音成片，整个流程在浏览器里完成，不需要剪辑经验。"
        />
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="relative flex flex-col gap-3 rounded-2xl border p-6"
            >
              <span className="text-muted-foreground/40 absolute top-4 right-5 text-4xl font-bold">
                {i + 1}
              </span>
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                {step.icon}
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- 核心功能 ---------------------------------------------------------------

const FEATURES = [
  {
    icon: <Mic2 className="size-5" />,
    title: "高精度语音转写",
    description:
      "AI 语音识别把视频里的讲解自动转成逐句字幕，自带时间戳，是后续视频翻译和配音的基础。",
  },
  {
    icon: <Languages className="size-5" />,
    title: "AI 字幕翻译",
    description:
      "接入你自己的大模型 API 做字幕翻译，术语和语气可通过逐句编辑微调，译文质量自己把控。",
  },
  {
    icon: <AudioLines className="size-5" />,
    title: "自然中文配音合成",
    description:
      "豆包 TTS 神经网络语音合成，多种中文音色可选，每句配音自动适配原句时长，语速异常自动标记。",
  },
  {
    icon: <SlidersHorizontal className="size-5" />,
    title: "时间轴精修",
    description:
      "基于专业视频编辑器的时间轴，逐句检查配音与画面的对齐，单句重新合成，不用整段重跑。",
  },
  {
    icon: <Captions className="size-5" />,
    title: "字幕同步导出",
    description: "配音和字幕一起合成进成片，导出即可直接上传课程平台或视频网站。",
  },
  {
    icon: <Layers className="size-5" />,
    title: "整课批量处理",
    description:
      "课程批量中心把转写、翻译、配音、导出串成流水线，上百个视频排队自动处理。",
  },
];

export function Features() {
  return (
    <section className="bg-muted/30 py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          title="开箱即用的 AI 视频配音能力"
          description="dubcopilot 把语音转写、字幕翻译、TTS 配音和视频导出整合在一个浏览器工具里。"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

// --- 课程批量本地化 ----------------------------------------------------------

const COURSE_POINTS = [
  {
    icon: <FolderSearch className="size-5" />,
    title: "课程目录一键扫描",
    description:
      "选择课程文件夹，dubcopilot 自动识别所有课时视频并建立课程清单，目录结构原样保留。",
  },
  {
    icon: <Workflow className="size-5" />,
    title: "全自动配音流水线",
    description:
      "每节课依次完成转写、翻译、配音合成与工程装配，批量任务挂着跑，进度一目了然。",
  },
  {
    icon: <CheckCheck className="size-5" />,
    title: "逐课复核与导出",
    description:
      "语速超限、翻译溢出的句子会被标记出来，逐课打开复核修改后再导出，质量可控。",
  },
];

export function CourseBatch() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          title="整门课程，批量本地化"
          description="一门在线课程动辄上百个视频，逐个手动配音不现实。dubcopilot 的课程批量中心专为整课视频翻译配音设计。"
        />
        <div className="grid gap-6 md:grid-cols-3">
          {COURSE_POINTS.map((p) => (
            <FeatureCard key={p.title} {...p} />
          ))}
        </div>
      </div>
    </section>
  );
}

// --- 为什么选择 --------------------------------------------------------------

const WHY = [
  {
    icon: <ShieldCheck className="size-5" />,
    title: "数据全程留在本地",
    description:
      "视频文件和工程数据保存在你的浏览器里，不上传服务器；AI 请求由浏览器直连服务商。",
  },
  {
    icon: <KeyRound className="size-5" />,
    title: "自带 API 密钥，成本透明",
    description:
      "转写、翻译、配音都用你自己的 API 密钥，按量付给服务商，没有中间加价和订阅捆绑。",
  },
  {
    icon: <BadgeCheck className="size-5" />,
    title: "免费使用，无水印",
    description:
      "dubcopilot 本身完全免费，导出的配音视频没有水印，个人和商业项目都可以使用。",
  },
  {
    icon: <Layers className="size-5" />,
    title: "基于成熟开源编辑器",
    description:
      "构建在开源视频编辑器 OpenCut 之上，时间轴、渲染、导出能力久经验证，不是黑盒。",
  },
];

export function WhyDubcopilot() {
  return (
    <section className="bg-muted/30 py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          title="为什么选择 dubcopilot"
          description="和订阅制的在线配音服务不同，dubcopilot 把控制权交回给你。"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => (
            <FeatureCard key={w.title} {...w} />
          ))}
        </div>
      </div>
    </section>
  );
}

// --- 适用场景 ----------------------------------------------------------------

const USE_CASES = [
  {
    icon: <GraduationCap className="size-5" />,
    title: "海外课程引进汉化",
    description:
      "把英文技术课程、学术讲座批量翻译成中文配音版本，让团队和学员无障碍学习。",
  },
  {
    icon: <Briefcase className="size-5" />,
    title: "企业培训视频翻译",
    description:
      "总部培训材料、产品讲解视频快速本地化成中文配音，培训落地不再卡在语言上。",
  },
  {
    icon: <Youtube className="size-5" />,
    title: "教程视频中文化",
    description:
      "把 YouTube 上的优质教程做成中文配音学习资料，转写、翻译、配音一站完成。",
  },
  {
    icon: <Presentation className="size-5" />,
    title: "讲座与公开课配音",
    description:
      "会议演讲、公开课录像配上中文配音和字幕，扩大内容在中文世界的传播。",
  },
];

export function UseCases() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          title="dubcopilot 适用场景"
          description="只要是「外语视频 + 想要中文配音」的场景，dubcopilot 都能帮你省下大量时间。"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((u) => (
            <FeatureCard key={u.title} {...u} />
          ))}
        </div>
      </div>
    </section>
  );
}

// --- AI 配音 vs 人工配音 -------------------------------------------------------

const COMPARE_ROWS = [
  {
    dimension: "成本",
    ai: "只付 AI 服务商的 API 费用，一节课通常只要几元",
    human: "按分钟计价，整门课轻松上万元",
  },
  {
    dimension: "速度",
    ai: "批量流水线自动处理，一晚上跑完一门课",
    human: "排期、录制、返工，以周为单位",
  },
  {
    dimension: "修改",
    ai: "改一句译文，单句重新合成，秒级完成",
    human: "重新进棚补录，按次收费",
  },
  {
    dimension: "批量能力",
    ai: "上百个视频排队处理，进度可视",
    human: "人力瓶颈明显，难以并行",
  },
];

export function Compare() {
  return (
    <section className="bg-muted/30 py-16 lg:py-24">
      <div className="mx-auto w-full max-w-4xl px-4">
        <SectionHeading
          title="AI 配音 vs 传统人工配音"
          description="对于课程类内容，AI 视频配音在成本和效率上是数量级的差距。"
        />
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 font-semibold">对比维度</th>
                <th className="px-4 py-3 font-semibold">dubcopilot AI 配音</th>
                <th className="px-4 py-3 font-semibold">人工配音</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.dimension} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{row.dimension}</td>
                  <td className="text-muted-foreground px-4 py-3">{row.ai}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {row.human}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// --- FAQ ----------------------------------------------------------------------

export const FAQ_ITEMS = [
  {
    question: "dubcopilot 收费吗？",
    answer:
      "工具本身免费、导出无水印。配音过程会调用你自己配置的 AI 服务（语音识别、翻译模型、豆包 TTS 等），费用由服务商按量计费，成本透明可控。",
  },
  {
    question: "支持哪些语言的视频翻译？",
    answer:
      "语音转写和字幕翻译的语言能力取决于你接入的 AI 模型，常见外语（如英语）转中文的效果最佳；配音端当前主打自然的中文音色。",
  },
  {
    question: "AI 配音的声音自然吗？",
    answer:
      "dubcopilot 使用豆包 TTS 等新一代神经网络语音合成，提供多种中文音色。每句配音会自动适配原视频时长，语速异常的句子会被标记出来供人工复核。",
  },
  {
    question: "我的视频会被上传到你们的服务器吗？",
    answer:
      "不会。视频文件和工程数据全部保存在浏览器本地（IndexedDB），AI 请求由你的浏览器直接发给所配置的服务商，dubcopilot 没有服务器存储你的内容。",
  },
  {
    question: "翻译有错误可以修改吗？",
    answer:
      "可以。内置时间轴编辑器支持逐句对照原文修改译文，改完只需重新合成该句配音，不用整段重跑。",
  },
  {
    question: "可以批量处理整门课程吗？",
    answer:
      "可以。课程批量中心支持选择整个课程文件夹，上百个视频自动排队完成转写、翻译、配音和装配，逐课标记复核状态。",
  },
  {
    question: "导出的是什么格式？",
    answer:
      "导出带中文配音和字幕的完整视频成片，可以直接上传到课程平台、内网或视频网站使用。",
  },
  {
    question: "dubcopilot 和 OpenCut 是什么关系？",
    answer:
      "dubcopilot 基于开源视频编辑器 OpenCut（MIT 协议）二次开发，复用其成熟的时间轴与渲染能力，并专注于 AI 视频配音与课程本地化场景。",
  },
];

export function Faq() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto w-full max-w-3xl px-4">
        <SectionHeading
          title="关于 dubcopilot 的常见问题"
          description="还有其他问题？发邮件到 support@dubcopilot.com 告诉我们。"
        />
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={item.question} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-base font-medium">
                {item.question}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed">
                  {item.answer}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

// --- CTA ------------------------------------------------------------------------

export function FinalCta() {
  return (
    <section className="bg-muted/30 py-16 lg:py-24">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
          现在开始你的第一个 AI 配音视频
        </h2>
        <p className="text-muted-foreground lg:text-lg">
          打开 dubcopilot，上传一个视频试试——转写、翻译、配音、导出，几分钟内看到成片效果。
        </p>
        <Link href="/projects">
          <button className="mt-2 flex items-center gap-1.5 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80">
            免费开始配音
            <ArrowRight className="size-4" />
          </button>
        </Link>
      </div>
    </section>
  );
}
