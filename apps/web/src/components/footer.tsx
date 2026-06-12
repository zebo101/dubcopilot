import Link from "next/link";
import Image from "next/image";
import { DEFAULT_LOGO_URL, SITE_INFO } from "@/site/brand";

const links = [
	{ label: "隐私政策", href: "/privacy" },
	{ label: "使用条款", href: "/terms" },
];

export function Footer() {
	return (
		<footer className="bg-background border-t">
			<div className="mx-auto max-w-5xl px-8 py-10">
				<div className="mb-8 grid grid-cols-1 gap-12 md:grid-cols-2">
					{/* Brand Section */}
					<div className="max-w-sm md:col-span-1">
						<div className="mb-4 flex items-center justify-start gap-2">
							<Image
								src={DEFAULT_LOGO_URL}
								alt="Dub Copilot"
								width={24}
								height={24}
								className="rounded-sm"
							/>
							<span className="text-lg font-bold">Dub Copilot</span>
						</div>
						<p className="text-muted-foreground mb-5 text-sm md:text-left">
							{SITE_INFO.description}
						</p>
					</div>

					<div className="flex items-start justify-start gap-12 py-2">
						<div className="flex flex-col gap-2">
							<h3 className="text-foreground font-semibold">Resources</h3>
							<ul className="space-y-2 text-sm">
								{links.map((link) => (
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
				</div>

				{/* Bottom Section */}
				<div className="flex flex-col items-start justify-between gap-4 pt-2 md:flex-row">
					<div className="text-muted-foreground flex flex-col gap-1 text-sm">
						<span>
							© {new Date().getFullYear()} Dub Copilot, All Rights Reserved
						</span>
						<span>
							Built on the open-source{" "}
							<a
								href="https://github.com/OpenCut-app/OpenCut"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:text-foreground underline transition-colors"
							>
								OpenCut
							</a>{" "}
							project.
						</span>
					</div>
				</div>
			</div>
		</footer>
	);
}
