"use client";

import { ArrowRight, Captions, Languages, Mic2 } from "lucide-react";
import React from "react";
import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/utils/ui";

// ---------------------------------------------------------------------------
// Hero — Hero213-style cutout layout, fixed single frame (no carousel)
// ---------------------------------------------------------------------------

const HERO_IMAGE = { src: "/img/1.jpg", alt: "dubcopilot 编辑器" };
const SIDE_IMAGE = { src: "/img/key.jpg", alt: "配音密钥配置" };

export function Hero({ className }: { className?: string }) {
  return (
    <section className={cn("py-16 lg:py-24", className)}>
      <div className="mx-auto w-full max-w-6xl px-4">
        {/* heading */}
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4">
          <h1 className="text-center text-5xl font-bold tracking-tight lg:text-6xl">
            AI 视频配音，跨越语言边界
          </h1>
          <p className="px-10 text-center text-muted-foreground lg:text-lg">
            上传视频，自动语音转写、AI
            字幕翻译，豆包 TTS 合成自然中文配音，带字幕一键导出成片，整门课程也能批量处理。
          </p>
          <Link href="/projects">
            <button className="mt-2 flex items-center gap-1.5 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80">
              立即开始
              <ArrowRight className="size-4" />
            </button>
          </Link>
        </div>

        {/* masked editor screenshot */}
        <div className="relative mt-4">
          {/* floating icon pill */}
          <div className="relative z-10 mx-auto my-7 flex w-fit cursor-pointer items-center justify-center gap-8 rounded-full bg-muted px-4 py-2 md:my-0 lg:translate-y-12 lg:py-3 xl:px-8 xl:py-4">
            <Mic2 className="size-4 opacity-40 hover:opacity-100 lg:size-6" />
            <Languages className="size-4 opacity-40 hover:opacity-100 lg:size-6" />
            <Captions className="size-4 opacity-40 hover:opacity-100 lg:size-6" />
          </div>

          <MaskedDiv maskType="type-3">
            <img
              className="h-full w-full object-cover"
              src={HERO_IMAGE.src}
              alt={HERO_IMAGE.alt}
            />
          </MaskedDiv>

          {/* floating bottom-left preview — click to enlarge */}
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="放大查看"
                className="absolute bottom-8 left-0 hidden h-44 w-32 cursor-zoom-in items-center justify-center overflow-hidden rounded-2xl border lg:flex xl:bottom-12 xl:h-52 xl:w-36 2xl:-left-12 2xl:h-64 2xl:w-44"
              >
                <img
                  className="h-full w-full object-cover"
                  src={SIDE_IMAGE.src}
                  alt={SIDE_IMAGE.alt}
                />
              </button>
            </DialogTrigger>
            <DialogContent className="w-auto max-w-[90vw] overflow-hidden p-0">
              <DialogTitle className="sr-only">{SIDE_IMAGE.alt}</DialogTitle>
              <img
                className="max-h-[85vh] w-auto"
                src={SIDE_IMAGE.src}
                alt={SIDE_IMAGE.alt}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// MaskedDiv — unchanged from Hero213 original
// ---------------------------------------------------------------------------

type MaskType = "type-1" | "type-2" | "type-3" | "type-4";

interface SvgPath {
  path: string;
  height: number;
  width: number;
}

interface MaskedDivProps {
  children: React.ReactElement<HTMLImageElement | HTMLVideoElement>;
  maskType?: MaskType;
  className?: string;
  backgroundColor?: string;
  size?: number;
}

const svgPaths: Record<MaskType, SvgPath> = {
  "type-1": {
    path: "M0.928955 40.9769C0.928955 18.9149 18.7917 1.01844 40.8536 0.976903L289.97 0.507853C308.413 0.473128 323.521 15.1483 324.022 33.5845L324.886 65.4007C325.955 104.745 358.022 136.159 397.38 136.417L432.98 136.65C447.818 136.748 459.797 148.799 459.803 163.637L459.982 550.982C459.992 573.08 442.08 591 419.982 591H40.9289C18.8376 591 0.928955 573.091 0.928955 551V40.9769Z",
    height: 591,
    width: 460,
  },
  "type-2": {
    path: "M0.811768 77.2118C0.811768 60.4225 14.4222 46.8121 31.2115 46.8121H180.95C192.496 46.8121 201.855 37.4527 201.855 25.9073V25.9073C201.855 11.9565 213.164 0.647217 227.115 0.647217H529.273C548.014 0.647217 563.206 15.8395 563.206 34.5802V34.5802C563.206 50.0897 575.779 62.6626 591.289 62.6626H820.388C837.177 62.6626 850.787 76.273 850.787 93.0623V350.953C850.787 367.742 837.177 381.353 820.388 381.353H366.165C349.852 381.353 336.627 368.128 336.627 351.814V351.814C336.627 335.501 323.402 322.276 307.089 322.276H31.2114C14.4222 322.276 0.811768 308.666 0.811768 291.876V77.2118Z",
    height: 381,
    width: 850,
  },
  "type-3": {
    path: "M0.680664 112.659C0.680664 50.805 50.823 0.662672 112.677 0.662672H413.07C456.315 0.662672 497.495 19.1588 526.221 51.4846V51.4846C554.948 83.8104 596.128 102.307 639.373 102.307H711.793C752.427 102.307 790.787 83.5522 815.744 51.4846V51.4846C840.7 19.417 879.06 0.662644 919.695 0.662597L1225.01 0.66224C1286.86 0.662168 1337.01 50.8046 1337.01 112.658V652.815C1337.01 714.668 1286.86 764.811 1225.01 764.811L670 764.811H335.34H278.376C217.423 764.811 168.01 715.399 168.01 654.446V626.747C168.01 580.208 130.283 542.48 83.7437 542.48V542.48C37.8692 542.48 0.680664 505.292 0.680664 459.417V382.737V112.659Z",
    height: 889,
    width: 1340,
  },
  "type-4": {
    path: "M0.811768 34.5451C0.811768 15.7441 16.053 0.502808 34.8541 0.502808H816.745C835.546 0.502808 850.787 15.7441 850.787 34.5452V242.977C850.787 261.778 835.546 277.019 816.745 277.019H638.293H550.537C527.035 277.019 504.789 266.407 490.001 248.141L486.211 243.46C453.263 202.765 390.688 204.378 359.881 246.717V246.717C346.027 265.756 323.901 277.019 300.355 277.019H213.306H34.8541C16.0531 277.019 0.811768 261.778 0.811768 242.977V34.5451Z",
    height: 278,
    width: 851,
  },
};

const MaskedDiv: React.FC<MaskedDivProps> = ({
  children,
  maskType = "type-1",
  className = "",
  backgroundColor = "transparent",
  size = 1,
}) => {
  const selectedMask = svgPaths[maskType];

  const svgString = `data:image/svg+xml,%3Csvg width='${selectedMask.width}' height='${selectedMask.height}' viewBox='0 0 ${selectedMask.width} ${selectedMask.height}' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fillRule='evenodd' clipRule='evenodd' d='${selectedMask.path}' fill='%23D9D9D9'/%3E%3C/svg%3E%0A`;

  const containerStyle: React.CSSProperties = {
    aspectRatio: `${selectedMask.width}/${selectedMask.height}`,
    backgroundColor,
    maskImage: `url("${svgString}")`,
    WebkitMaskImage: `url("${svgString}")`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskSize: "contain",
    width: `${size * 100}%`,
    maxWidth: "100%",
    margin: "0 auto",
  };

  return (
    <section className={`relative ${className}`} style={containerStyle}>
      {React.cloneElement(children, {
        className: `w-full h-full object-cover transition-all duration-300 ${
          children.props.className || ""
        }`,
      })}
    </section>
  );
};
