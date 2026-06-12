"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics";

/**
 * Sends a GA4 page_view event on every client-side route change.
 * Mount once in the root layout.
 */
export function RouteTracker() {
	const pathname = usePathname();

	useEffect(() => {
		trackPageView(pathname);
	}, [pathname]);

	return null;
}
