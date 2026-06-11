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
	title: "Privacy Policy - dubcopilot",
	description:
		"Learn how dubcopilot handles your data and privacy. Our commitment to protecting your information while you dub videos.",
	openGraph: {
		title: "Privacy Policy - dubcopilot",
		description:
			"Learn how dubcopilot handles your data and privacy. Our commitment to protecting your information while you dub videos.",
		type: "website",
	},
};

export default function PrivacyPage() {
	return (
		<BasePage
			title="Privacy policy"
			description="Learn how we handle your data and privacy. Contact us if you have any questions."
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
							Your content stays on your device.
						</h3>
						<ol className="list-decimal space-y-2 pl-6">
							<li>
								Editing happens locally in your browser - we never see your
								files
							</li>
							<li>
								AI dubbing features (transcription, translation, voice
								synthesis) call the AI provider you configure with your own API
								key - we never receive or store that content
							</li>
							<li>dubcopilot does not currently require an account or login</li>
							<li>Project data stays on your device, not our servers</li>
							<li>We do not run analytics or tracking scripts</li>
							<li>You can clear local data from your browser at any time</li>
							<li>
								We don&apos;t sell or share your data with anyone (we don&apos;t
								even have it)
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
				<h2 className="text-2xl font-semibold">How We Handle Your Content</h2>
				<p>
					<strong>
						All editing and processing happens locally on your device.
					</strong>{" "}
					We never upload, store, or have access to your video or audio files.
					Your content remains completely private and under your control.
				</p>
				<p>
					When you use AI dubbing features (transcription, translation, or
					voice synthesis), the relevant audio or text is sent directly from
					your browser to the AI provider you configure, using your own API
					key. That data goes to the provider you choose under their privacy
					terms - it never passes through or gets stored on our servers.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Accounts & Authentication</h2>
				<p>
					dubcopilot does not currently offer user accounts, login, or Google
					sign-in.
				</p>
				<p>
					Because there is no account system today, we do not collect account
					emails, profile information, or OAuth identity data.
				</p>
				<p>
					Your projects are never stored on our servers. All project data,
					including names, thumbnails, and creation dates, is stored locally
					in your browser using IndexedDB.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Analytics</h2>
				<p>
					We do not run any analytics or tracking scripts. No personal
					information is collected, no individual users are tracked, and no
					data that could identify you is stored.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Local Storage & Cookies</h2>
				<p>We use browser local storage and IndexedDB to:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Save your projects locally on your device</li>
					<li>Remember your editor preferences and settings</li>
					<li>
						Store your AI provider API keys, which never leave your browser
						except to call the provider directly
					</li>
					<li>Store app state needed for the editor to work between sessions</li>
				</ul>
				<p>
					All data stays on your device and can be cleared at any time through
					your browser settings.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Third-Party Services</h2>
				<p>dubcopilot interacts with these services:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						<strong>Hosting:</strong> Static assets and the app itself are
						served from our hosting provider
					</li>
					<li>
						<strong>AI providers you configure:</strong> Transcription,
						translation, and voice synthesis requests go directly to the
						provider you set up with your own API key
					</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Your Rights</h2>
				<p>You have complete control over your data:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>No account is required to use dubcopilot today</li>
					<li>Clear local storage to remove all saved projects and API keys</li>
					<li>Contact us with any privacy concerns</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Contact Us</h2>
				<p>Questions about this privacy policy or how we handle your data?</p>
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
			</section>

			<Separator />

			<p className="text-muted-foreground text-sm">
				Last updated: June 11, 2026
			</p>
		</BasePage>
	);
}
