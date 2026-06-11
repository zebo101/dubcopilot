import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { type NextRequest, NextResponse } from "next/server";
import { getJob } from "@/dub/course/link/server/jobs";

// Stream one finished file out of a job's tmp dir. `name` must match a file
// recorded on the job (no path traversal — names come from our own readdir).

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
	mp4: "video/mp4",
	m4v: "video/mp4",
	mov: "video/quicktime",
	mkv: "video/x-matroska",
	webm: "video/webm",
	vtt: "text/vtt",
	srt: "application/x-subrip",
};

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ key: string }> },
) {
	const { key } = await params;
	const job = getJob(key);
	if (!job) {
		return NextResponse.json({ error: "job not found" }, { status: 404 });
	}
	const name = request.nextUrl.searchParams.get("name") ?? "";
	const file = job.files.find((f) => f.name === name);
	if (!file) {
		return NextResponse.json({ error: "file not found" }, { status: 404 });
	}
	const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
	const stream = createReadStream(path.join(job.dir, file.name));
	return new NextResponse(
		Readable.toWeb(stream) as unknown as ReadableStream,
		{
			status: 200,
			headers: {
				"Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
				"Content-Length": String(file.size),
				"Cache-Control": "no-store",
			},
		},
	);
}
