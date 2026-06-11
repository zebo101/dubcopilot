import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startJob } from "@/dub/course/link/server/jobs";

// Start a download job (yt-dlp or fetch backend → per-job tmp dir).
// Progress: GET /api/dub/link/jobs/[key] · files: …/[key]/file?name=

export const runtime = "nodejs";

const bodySchema = z.object({
	key: z.string().min(4).max(64).regex(/^[a-z0-9-]+$/i),
	kind: z.enum(["youtube", "gdrive", "onedrive", "direct"]),
	url: z.string().url(),
	proxy: z.string().optional(),
	subLangs: z.array(z.string().min(1).max(20)).max(5).optional(),
});

export async function POST(request: NextRequest) {
	const parsed = bodySchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid input" }, { status: 400 });
	}
	const job = await startJob(parsed.data);
	return NextResponse.json({ key: job.key, phase: job.phase });
}
