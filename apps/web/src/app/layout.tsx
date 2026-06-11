import { ThemeProvider } from "next-themes";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "../components/ui/sonner";
import { TooltipProvider } from "../components/ui/tooltip";
import { baseMetaData } from "./metadata";
import { BotIdClient } from "botid/client";
import {
	Inter,
	JetBrains_Mono,
	Outfit,
	Playfair_Display,
} from "next/font/google";

const siteFont = Inter({ subsets: ["latin"] });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const playfair = Playfair_Display({
	subsets: ["latin"],
	variable: "--font-playfair",
});
const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-jetbrains-mono",
});

export const metadata = baseMetaData;

const protectedRoutes = [
	{
		path: "/none",
		method: "GET",
	},
];

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning className="scroll-smooth">
			<head>
				<BotIdClient protect={protectedRoutes} />
				{process.env.NODE_ENV === "development" && (
					<>
						<Script
							src="//unpkg.com/react-scan/dist/auto.global.js"
							crossOrigin="anonymous"
							strategy="beforeInteractive"
						/>
					</>
				)}
			</head>
			<body
				className={`${siteFont.className} ${outfit.variable} ${playfair.variable} ${jetbrainsMono.variable} font-sans antialiased`}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					disableTransitionOnChange={true}
				>
					<TooltipProvider>
						<Toaster />
						{children}
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
