"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "./ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";
import {
	Cancel01Icon,
	Copy01Icon,
	Download01Icon,
	Menu02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";
import { DEFAULT_LOGO_URL } from "@/site/brand";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "./ui/context-menu";

const links = [
	{ label: "工作流程", href: "/#how-it-works" },
	{ label: "核心功能", href: "/#features" },
	{ label: "课程批量", href: "/course" },
	{ label: "适用场景", href: "/#use-cases" },
	{ label: "常见问题", href: "/#faq" },
];

export function Header() {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const closeMenu = () => setIsMenuOpen(false);

	return (
		<header className="bg-background shadow-background/85 sticky top-0 z-50 shadow-[0_30px_35px_15px_rgba(0,0,0,1)]">
			<div className="container relative mx-auto flex items-center justify-between px-6 pt-4 pb-2">
				<div className="relative z-10 flex items-center gap-6">
					<ContextMenu>
						<ContextMenuTrigger asChild>
							<Link href="/" className="flex items-center gap-2.5">
								<Image
									src={DEFAULT_LOGO_URL}
									alt="dubcopilot"
									className="rounded-md"
									width={32}
									height={32}
								/>
								<span className="text-base font-bold">dubcopilot</span>
							</Link>
						</ContextMenuTrigger>
						<ContextMenuContent>
							<ContextMenuItem
								onClick={async () => {
									const res = await fetch(DEFAULT_LOGO_URL);
									const svg = await res.text();
									await navigator.clipboard.writeText(svg);
								}}
							>
								<HugeiconsIcon icon={Copy01Icon} />
								Copy SVG
							</ContextMenuItem>
							<ContextMenuItem
								onClick={() => {
									const a = document.createElement("a");
									a.href = DEFAULT_LOGO_URL;
									a.download = "dubcopilot-logo.svg";
									a.click();
								}}
							>
								<HugeiconsIcon icon={Download01Icon} />
								Download SVG
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>

					<nav className="hidden items-center gap-4 md:flex">
						{links.map((link) => (
							<Link key={link.href} href={link.href}>
								<Button variant="text" className="p-0 text-sm">
									{link.label}
								</Button>
							</Link>
						))}
					</nav>
				</div>

				<div className="relative z-10">
					<div className="flex items-center gap-3 md:hidden">
						<Button
							variant="text"
							size="icon"
							className="flex items-center justify-center p-0"
							onClick={() => setIsMenuOpen(!isMenuOpen)}
						>
							<HugeiconsIcon icon={Menu02Icon} size={30} />
						</Button>
					</div>
					<div className="hidden items-center gap-3 md:flex">
						<Link href="/projects">
							<Button className="text-sm">
								Projects
								<ArrowRight className="size-4" />
							</Button>
						</Link>
						<ThemeToggle />
					</div>
				</div>
				<div
					className={cn(
						"pointer-events-none fixed inset-0 z-50 opacity-0 md:hidden",
						"transition-opacity duration-200",
						isMenuOpen && "pointer-events-auto opacity-100",
					)}
				>
					{/* 遮罩：近不透明底 + 毛玻璃，点击空白处关闭 */}
					<button
						type="button"
						aria-label="Close menu"
						className="bg-background/90 absolute inset-0 backdrop-blur-xl"
						onClick={closeMenu}
					/>
					<div className="relative flex h-full flex-col px-6 pt-20 pb-8">
						<div className="absolute top-4 right-5">
							<Button
								variant="text"
								size="icon"
								className="flex items-center justify-center p-0"
								onClick={closeMenu}
							>
								<HugeiconsIcon icon={Cancel01Icon} size={24} />
							</Button>
						</div>
						<nav className="flex flex-col">
							{links.map((link, index) => (
								<motion.div
									key={link.href}
									initial={{ y: 8, opacity: 0 }}
									animate={{
										y: isMenuOpen ? 0 : 8,
										opacity: isMenuOpen ? 1 : 0,
									}}
									transition={{
										duration: 0.3,
										delay: isMenuOpen ? index * 0.05 : 0,
										ease: [0.25, 0.46, 0.45, 0.94],
									}}
								>
									<Link
										href={link.href}
										className="text-foreground/90 border-border/50 block border-b py-4 text-lg font-medium"
										onClick={closeMenu}
									>
										{link.label}
									</Link>
								</motion.div>
							))}
						</nav>
						<motion.div
							initial={{ y: 8, opacity: 0 }}
							animate={{
								y: isMenuOpen ? 0 : 8,
								opacity: isMenuOpen ? 1 : 0,
							}}
							transition={{
								duration: 0.3,
								delay: isMenuOpen ? links.length * 0.05 : 0,
								ease: [0.25, 0.46, 0.45, 0.94],
							}}
							className="pt-6"
						>
							<Link href="/projects" onClick={closeMenu}>
								<Button className="w-full text-sm">
									Projects
									<ArrowRight className="size-4" />
								</Button>
							</Link>
						</motion.div>
						<ThemeToggle
							className="absolute right-6 bottom-8 size-10"
							iconClassName="!size-[1.2rem]"
							onToggle={(e) => {
								e.preventDefault();
								e.stopPropagation();
							}}
						/>
					</div>
				</div>
			</div>
		</header>
	);
}
