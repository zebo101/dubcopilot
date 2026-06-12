import Link from "next/link";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon } from "@hugeicons/core-free-icons";
import { DEFAULT_LOGO_URL, SITE_INFO } from "@/site/brand";

const productLinks = [
	{ label: "首页", href: "/" },
	{ label: "功能介绍", href: "/#features" },
	{ label: "开源仓库", href: "https://github.com/zebo101/dubcopilot", external: true },
];

const resourceLinks = [
	{ label: "隐私政策", href: "/privacy" },
	{ label: "使用条款", href: "/terms" },
	{ label: "邮件联系", href: "mailto:support@dubcopilot.com" },
];

export function Footer() {
	return (
		<footer className="bg-background border-t">
			<div className="mx-auto max-w-5xl px-8 py-12">
				<div className="mb-10 grid grid-cols-1 gap-10 sm:grid-cols-3">
					{/* Brand Section */}
					<div className="sm:col-span-1">
						<div className="mb-3 flex items-center justify-start gap-2">
							<Image
								src={DEFAULT_LOGO_URL}
								alt="Dub Copilot"
								width={28}
								height={28}
								className="rounded-sm"
							/>
							<span className="text-lg font-bold">Dub Copilot</span>
						</div>
						<p className="text-muted-foreground mb-3 text-sm leading-relaxed">
							{SITE_INFO.description}
						</p>
						<p className="text-muted-foreground/60 text-xs">
							免费 · 开源 · 本地优先
						</p>
					</div>

					{/* Product Links */}
					<div className="flex flex-col gap-2 sm:col-span-1">
						<h3 className="text-foreground mb-1 font-semibold text-sm">
							产品
						</h3>
						<ul className="space-y-2 text-sm">
							{productLinks.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href}
										target={link.external ? "_blank" : undefined}
										rel={link.external ? "noopener noreferrer" : undefined}
										className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
									>
										{link.label}
										{link.external && (
											<HugeiconsIcon
												icon={GithubIcon}
												className="size-3.5"
											/>
										)}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{/* Resource Links */}
					<div className="flex flex-col gap-2 sm:col-span-1">
						<h3 className="text-foreground mb-1 font-semibold text-sm">
							资源
						</h3>
						<ul className="space-y-2 text-sm">
							{resourceLinks.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href}
										className="text-muted-foreground hover:text-foreground transition-colors"
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>

				{/* Bottom Section */}
				<div className="text-muted-foreground border-t pt-6 text-sm">
					<p>
						© {new Date().getFullYear()} Dub Copilot.{" "}
						基于开源项目{" "}
						<a
							href="https://github.com/OpenCut-app/OpenCut"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-foreground underline underline-offset-2 transition-colors"
						>
							OpenCut
						</a>{" "}
						构建（MIT 协议）。
					</p>
				</div>
			</div>
		</footer>
	);
}
