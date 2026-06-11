import { type NextRequest, NextResponse } from "next/server";
import { cleanupJob, getJob } from "@/dub/course/link/server/jobs";

// GET: poll job progress · DELETE: remove the job's tmp dir after the
// browser has written all files into the user's course folder.

export const runtime = "nodejs";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ key: string }> },
) {
	const { key } = await params;
	const job = getJob(key);
	if (!job) {
		return NextResponse.json({ error: "job not found" }, { status: 404 });
	}
	const { dir: _dir, ...publicState } = job;
	return NextResponse.json(publicState);
}

export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ key: string }> },
) {
	const { key } = await params;
	await cleanupJob(key);
	return NextResponse.json({ ok: true });
}
