import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
	title: "Terms of Service - Dub Copilot",
	description:
		"Dub Copilot's Terms of Service. Fair, transparent terms for our AI video dubbing tool.",
	openGraph: {
		title: "Terms of Service - Dub Copilot",
		description:
			"Dub Copilot's Terms of Service. Fair, transparent terms for our AI video dubbing tool.",
		type: "website",
	},
};

export default function TermsPage() {
	return (
		<BasePage
			title="Terms of service"
			description="Fair and transparent terms for our AI video dubbing tool. Contact us if you have any questions."
		>
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem
					value="quick-summary"
					className="rounded-2xl border px-5"
				>
					<AccordionTrigger className="no-underline!">
						Quick summary
					</AccordionTrigger>
					<AccordionContent>
						<h3 className="mb-3 text-lg font-medium">
							You own your content, we own nothing.
						</h3>
						<ol className="list-decimal space-y-2 pl-6">
							<li>
								Editing runs locally in your browser - nothing is uploaded to
								our servers
							</li>
							<li>We never claim ownership of your content</li>
							<li>
								Free for personal and commercial use with no watermarks or
								restrictions
							</li>
							<li>
								AI dubbing uses the provider you configure with your own API
								key - their terms apply to those requests
							</li>
							<li>
								You&apos;re responsible for how you use it - don&apos;t break
								the law
							</li>
							<li>
								Service provided &quot;as is&quot; - we can&apos;t guarantee
								perfect uptime
							</li>
							<li>
								No account required - your exported videos are always yours
							</li>
						</ol>
						<p className="mt-4">
							Questions? Email us at{" "}
							<a
								href="mailto:support@dubcopilot.com"
								className="text-primary hover:underline"
							>
								support@dubcopilot.com
							</a>
						</p>
					</AccordionContent>
				</AccordionItem>
			</Accordion>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Your Content, Your Rights</h2>
				<p>
					<strong>You own everything you create.</strong> All editing and
					processing happens locally on your device. We never see, store, or
					have access to your files. We make no claims to ownership, licensing,
					or rights over your videos, projects, or any content you create using
					Dub Copilot.
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Your content is never stored on our servers</li>
					<li>You retain all intellectual property rights to your content</li>
					<li>You can export and use your content however you choose</li>
					<li>No watermarks, no licensing restrictions from Dub Copilot</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">How You Can Use Dub Copilot</h2>
				<p>Dub Copilot is free for personal and commercial use. You can:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						Create dubbed videos for personal, educational, or commercial
						purposes
					</li>
					<li>Use Dub Copilot for client work and paid projects</li>
					<li>Share and distribute videos created with Dub Copilot</li>
				</ul>
				<p>
					You&apos;re responsible for how you use Dub Copilot and the content
					you create. Make sure you have the rights to the videos you dub, and
					don&apos;t use it for anything illegal in your jurisdiction.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">AI Features</h2>
				<p>
					AI dubbing features (transcription, translation, and voice synthesis)
					send the relevant audio or text directly from your browser to the AI
					provider you configure, using your own API key. Those requests are
					governed by your provider&apos;s terms of service and pricing. We are
					not a party to that relationship and are not responsible for the
					provider&apos;s output, availability, or costs.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Service</h2>
				<p>
					Dub Copilot does not currently require an account. The service is
					provided &quot;as is&quot; without warranties. While we strive for
					reliability, we can&apos;t guarantee uninterrupted service.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Attribution</h2>
				<p>
					Dub Copilot is built on the open-source{" "}
					<a
						href="https://github.com/OpenCut-app/OpenCut"
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						OpenCut
					</a>{" "}
					project (MIT license). The original license and copyright notices are
					preserved in our source distribution.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Limitations and Liability</h2>
				<p>
					Dub Copilot is provided free of charge. To the extent permitted by
					law:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>We&apos;re not liable for any loss of data or content</li>
					<li>
						Projects are stored in your browser and may be lost if you clear
						browser data
					</li>
					<li>We&apos;re not responsible for how you use the service</li>
					<li>Our liability is limited to the maximum extent allowed by law</li>
				</ul>
				<p>
					Since your content stays on your device, we have no way to recover
					lost projects. Consider exporting important videos when finished
					editing.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Service Changes</h2>
				<p>We may update Dub Copilot and these terms:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>We&apos;ll notify you of significant changes to these terms</li>
					<li>Continued use means you accept any updates</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Stopping Use</h2>
				<p>You can stop using Dub Copilot at any time:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Clear your browser data to remove local projects</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Contact Us</h2>
				<p>Questions about these terms or need to report an issue?</p>
				<p>
					Email us at{" "}
					<a
						href="mailto:support@dubcopilot.com"
						className="text-primary hover:underline"
					>
						support@dubcopilot.com
					</a>
					.
				</p>
				<p>
					These terms are governed by applicable law in your jurisdiction. We
					prefer to resolve disputes through friendly discussion.
				</p>
			</section>
			<Separator />
			<p className="text-muted-foreground text-sm">
				Last updated: June 11, 2026
			</p>
		</BasePage>
	);
}
