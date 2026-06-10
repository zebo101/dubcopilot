import { describe, expect, test } from "bun:test";
import { StoreZipWriter, ZIP_SIZE_LIMIT_BYTES } from "@/dub/course/zip";

function memorySink() {
	const chunks: Uint8Array[] = [];
	return {
		chunks,
		sink: {
			write: async (c: Uint8Array) => {
				chunks.push(c);
			},
			close: async () => {},
		},
	};
}

describe("StoreZipWriter guards", () => {
	test("writes a small archive fine", async () => {
		const { sink, chunks } = memorySink();
		const zip = new StoreZipWriter(sink);
		await zip.addFile({ name: "a.txt", data: new TextEncoder().encode("hi") });
		await zip.finish();
		const total = chunks.reduce((n, c) => n + c.length, 0);
		expect(total).toBeGreaterThan(50); // header + data + central dir + EOCD
	});

	test("rejects a file that would push the archive past the ZIP32 limit", async () => {
		const { sink } = memorySink();
		const zip = new StoreZipWriter(sink) as unknown as {
			offset: number;
			addFile: (a: { name: string; data: Uint8Array }) => Promise<void>;
		};
		// simulate an archive already near the cap — no need to write 4 GB
		zip.offset = ZIP_SIZE_LIMIT_BYTES - 10;
		await expect(
			zip.addFile({ name: "big.mp4", data: new Uint8Array(1024) }),
		).rejects.toThrow(/ZIP/);
	});

	test("rejects a single file over 4 GB by declared size", async () => {
		const { sink } = memorySink();
		const zip = new StoreZipWriter(sink);
		// a fake Uint8Array-like with a huge length — only the length is read
		const fake = { length: 0x1_0000_0000 } as unknown as Uint8Array;
		await expect(zip.addFile({ name: "huge.bin", data: fake })).rejects.toThrow(
			/ZIP|4 GB/,
		);
	});
});
