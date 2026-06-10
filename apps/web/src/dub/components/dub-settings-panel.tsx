"use client";

// 配音设置 — lives in the RIGHT properties panel while the AI 配音 tab is
// active. These are properties of the dub (voice / original audio / subtitles
// / speed / credentials), adjustable at ANY phase — notably during review,
// which is the natural moment to audition voices and re-apply.

import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowRight01Icon,
	DashboardSpeed02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";
import { useDubStore } from "@/dub/store";
import { useDubCredentials, hasTtsKey } from "@/dub/credentials";
import { VOICES } from "@/dub/data";

function CredField({
	label,
	value,
	onChange,
	type = "text",
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	type?: "text" | "password";
	placeholder?: string;
}) {
	return (
		<label className="block space-y-1">
			<span className="text-muted-foreground text-[11px]">{label}</span>
			<input
				type={type}
				value={value}
				placeholder={placeholder}
				spellCheck={false}
				autoComplete="off"
				onChange={(e) => onChange(e.target.value)}
				className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
			/>
		</label>
	);
}

export function CredentialsSection() {
	const cred = useDubCredentials();
	const [open, setOpen] = useState(false);
	const configured = hasTtsKey(cred);

	return (
		<div className="rounded-md border">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
			>
				<span className="font-medium">语音 / 翻译 凭据</span>
				<span
					className={cn(
						"rounded px-1.5 text-[10px]",
						configured
							? "bg-emerald-500/15 text-emerald-500"
							: "bg-amber-500/15 text-amber-500",
					)}
				>
					{configured ? "已配置" : "未配置"}
				</span>
				<HugeiconsIcon
					icon={ArrowRight01Icon}
					className={cn(
						"text-muted-foreground ml-auto size-4 transition-transform",
						open && "rotate-90",
					)}
				/>
			</button>
			{open ? (
				<div className="space-y-3 border-t p-3">
					<div className="space-y-2">
						<div className="text-[11px] font-medium">豆包语音 TTS</div>
						<CredField
							label="API Key（必填）"
							type="password"
							placeholder="VOLCENGINE_TTS_API_KEY"
							value={cred.ttsApiKey}
							onChange={(v) => cred.setField({ key: "ttsApiKey", value: v })}
						/>
						<CredField
							label="Resource ID"
							value={cred.ttsResourceId}
							onChange={(v) => cred.setField({ key: "ttsResourceId", value: v })}
						/>
						<CredField
							label="TTS URL"
							value={cred.ttsUrl}
							onChange={(v) => cred.setField({ key: "ttsUrl", value: v })}
						/>
						<CredField
							label="Cluster"
							value={cred.ttsCluster}
							onChange={(v) => cred.setField({ key: "ttsCluster", value: v })}
						/>
					</div>
					<div className="space-y-2">
						<div className="text-[11px] font-medium">DeepSeek 翻译</div>
						<CredField
							label="API Key（必填）"
							type="password"
							placeholder="sk-..."
							value={cred.deepseekApiKey}
							onChange={(v) => cred.setField({ key: "deepseekApiKey", value: v })}
						/>
						<CredField
							label="Base URL"
							value={cred.deepseekBaseUrl}
							onChange={(v) =>
								cred.setField({ key: "deepseekBaseUrl", value: v })
							}
						/>
						<CredField
							label="模型（V4 默认 deepseek-chat）"
							value={cred.deepseekModel}
							onChange={(v) => cred.setField({ key: "deepseekModel", value: v })}
						/>
					</div>
					<div className="space-y-2">
						<div className="text-[11px] font-medium">Groq 云端转写</div>
						<CredField
							label="API Key（云端转写用）"
							type="password"
							placeholder="gsk_..."
							value={cred.groqApiKey}
							onChange={(v) => cred.setField({ key: "groqApiKey", value: v })}
						/>
						<CredField
							label="Base URL"
							value={cred.groqBaseUrl}
							onChange={(v) => cred.setField({ key: "groqBaseUrl", value: v })}
						/>
						<CredField
							label="模型"
							value={cred.groqModel}
							onChange={(v) => cred.setField({ key: "groqModel", value: v })}
						/>
					</div>
					<div className="flex items-center gap-2 pt-1">
						<Button
							size="sm"
							className="h-7 text-xs"
							onClick={() =>
								toast.success("凭据已保存到本地浏览器，刷新不会丢失")
							}
						>
							保存
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="h-7 text-xs"
							onClick={() => {
								cred.reset();
								toast("已清除凭据");
							}}
						>
							清除
						</Button>
						<span className="text-muted-foreground text-[10px]">
							输入即自动保存
						</span>
					</div>
					<p className="text-muted-foreground text-[10px] leading-relaxed">
						凭据仅存本地浏览器（localStorage），不上传服务器、刷新不丢；仅用于经薄代理调用你自己的 DeepSeek / 豆包接口。
					</p>
				</div>
			) : null}
		</div>
	);
}

export function DubSettingsPanel() {
	const settings = useDubStore((s) => s.settings);
	const setSetting = useDubStore((s) => s.setSetting);
	const phase = useDubStore((s) => s.phase);

	return (
		<div className="space-y-5 p-4">
			<div>
				<div className="text-sm font-semibold">配音设置</div>
				<p className="text-muted-foreground text-[11px]">
					任何阶段都可调整{phase === "review" ? "——改完点左侧「合成配音并应用」生效" : ""}
				</p>
			</div>

			{/* voice gallery */}
			<div className="space-y-2">
				<div className="text-muted-foreground text-xs font-medium">配音音色</div>
				<div className="grid grid-cols-2 gap-2">
					{VOICES.map((v) => {
						const selected = settings.voiceId === v.id;
						return (
							<button
								type="button"
								key={v.id}
								onClick={() => setSetting({ key: "voiceId", value: v.id })}
								className={cn(
									"flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-colors",
									selected
										? "border-primary bg-primary/10"
										: "border-border hover:bg-muted",
								)}
							>
								<div className="flex w-full items-center gap-2">
									<span
										className="flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white"
										style={{ background: `oklch(0.55 0.13 ${v.hue})` }}
									>
										{v.name[0]}
									</span>
									<span className="text-sm font-medium">{v.name}</span>
									{v.recommended ? (
										<span className="bg-primary/20 text-primary ml-auto rounded px-1 text-[10px]">
											推荐
										</span>
									) : null}
								</div>
								<span className="text-muted-foreground text-[11px]">
									{v.genderLabel} · {v.style}
								</span>
							</button>
						);
					})}
				</div>
				{phase === "review" ? (
					<p className="text-muted-foreground text-[10px]">
						提示：在左侧句列表点 ▶ 可用当前音色试听单句。
					</p>
				) : null}
			</div>

			{/* original audio */}
			<div className="space-y-2">
				<div className="text-muted-foreground text-xs font-medium">原声处理</div>
				<div className="bg-muted inline-flex rounded-md p-0.5">
					{(["mute", "background"] as const).map((mode) => (
						<button
							type="button"
							key={mode}
							onClick={() => setSetting({ key: "originalAudio", value: mode })}
							className={cn(
								"rounded px-3 py-1 text-xs transition-colors",
								settings.originalAudio === mode
									? "bg-background shadow-sm"
									: "text-muted-foreground",
							)}
						>
							{mode === "mute" ? "静音原声" : "保留为背景"}
						</button>
					))}
				</div>
				{settings.originalAudio === "background" ? (
					<div className="pt-1">
						<div className="text-muted-foreground mb-1 flex justify-between text-[11px]">
							<span>背景音量</span>
							<span>{Math.round(settings.backgroundVolume * 100)}%</span>
						</div>
						<input
							type="range"
							min={0}
							max={0.5}
							step={0.01}
							value={settings.backgroundVolume}
							onChange={(e) =>
								setSetting({
									key: "backgroundVolume",
									value: Number(e.target.value),
								})
							}
							className="w-full"
						/>
					</div>
				) : null}
			</div>

			{/* subtitles */}
			<div className="space-y-2">
				<label className="flex cursor-pointer items-center justify-between">
					<span className="text-sm">同时生成中文字幕</span>
					<input
						type="checkbox"
						checked={settings.subtitles}
						onChange={(e) =>
							setSetting({ key: "subtitles", value: e.target.checked })
						}
					/>
				</label>
				{settings.subtitles ? (
					<div className="bg-muted inline-flex rounded-md p-0.5">
						{(["soft", "burn"] as const).map((mode) => (
							<button
								type="button"
								key={mode}
								onClick={() => setSetting({ key: "subtitleMode", value: mode })}
								className={cn(
									"rounded px-3 py-1 text-xs transition-colors",
									settings.subtitleMode === mode
										? "bg-background shadow-sm"
										: "text-muted-foreground",
								)}
							>
								{mode === "soft" ? "软字幕（可关）" : "烧录到画面"}
							</button>
						))}
					</div>
				) : null}
			</div>

			{/* speed & alignment — no longer hidden behind an "advanced" toggle */}
			<div className="space-y-3 rounded-md border p-3">
				<div className="flex items-center gap-2 text-xs font-medium">
					<HugeiconsIcon
						icon={DashboardSpeed02Icon}
						className="text-muted-foreground size-4"
					/>
					语速与对齐
				</div>
				<label className="flex cursor-pointer items-start justify-between gap-2">
					<span className="flex flex-col">
						<span className="text-xs">语速自适应</span>
						<span className="text-muted-foreground text-[10px]">
							译文偏长时自动加速，贴合原时长
						</span>
					</span>
					<input
						type="checkbox"
						checked={settings.speedAdaptive}
						onChange={(e) =>
							setSetting({ key: "speedAdaptive", value: e.target.checked })
						}
					/>
				</label>
				<div>
					<div className="text-muted-foreground mb-1 flex justify-between text-[11px]">
						<span>原生最大语速</span>
						<span>×{settings.nativeMaxSpeed.toFixed(2)}</span>
					</div>
					<input
						type="range"
						min={1}
						max={1.6}
						step={0.05}
						value={settings.nativeMaxSpeed}
						onChange={(e) =>
							setSetting({ key: "nativeMaxSpeed", value: Number(e.target.value) })
						}
						className="w-full"
					/>
				</div>
				<div>
					<div className="text-muted-foreground mb-1 flex justify-between text-[11px]">
						<span>最大变速</span>
						<span>×{settings.maxSpeedup.toFixed(1)}</span>
					</div>
					<input
						type="range"
						min={1.5}
						max={3}
						step={0.1}
						value={settings.maxSpeedup}
						onChange={(e) =>
							setSetting({ key: "maxSpeedup", value: Number(e.target.value) })
						}
						className="w-full"
					/>
				</div>
				<div className="text-muted-foreground flex justify-between text-[11px]">
					<span>重叠保护</span>
					<span>{settings.overlapGuardMs} ms</span>
				</div>
			</div>

			<CredentialsSection />
		</div>
	);
}
