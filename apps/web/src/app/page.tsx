import { Hero } from "@/components/landing/hero";
import {
  Compare,
  CourseBatch,
  FAQ_ITEMS,
  Faq,
  Features,
  FinalCta,
  HowItWorks,
  UseCases,
  WhyDubcopilot,
} from "@/components/landing/sections";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import type { Metadata } from "next";
import { SITE_URL } from "@/site/brand";

const TITLE =
  "Dub Copilot - AI 视频配音工具 | 视频翻译、字幕生成、批量配音、一键导出成片";
const DESCRIPTION =
  "Dub Copilot 是一款免费的 AI 视频配音工具：上传外语视频，自动完成语音转写与字幕翻译，豆包 TTS 一键合成自然中文配音，带字幕导出成片。无论单个视频还是整门课程，上百个视频也能批量本地化；数据全程保存在本地浏览器，使用自己的 API 密钥，成本透明、无水印，是视频翻译配音的高效之选。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "AI 视频配音",
    "视频翻译",
    "字幕翻译",
    "语音转写",
    "中文配音",
    "课程本地化",
    "批量配音",
    "视频配音工具",
    "TTS 配音",
    "AI dubbing",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Dub Copilot",
      url: SITE_URL,
      description: DESCRIPTION,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "CNY",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ],
};

export default function Home() {
  return (
    <div className="font-landing">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <CourseBatch />
        <WhyDubcopilot />
        <UseCases />
        <Compare />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
