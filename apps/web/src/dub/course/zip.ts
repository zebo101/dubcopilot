// Minimal streaming ZIP writer (STORE / no compression) — no dependencies.
// mp4 is already compressed, so STORE is the right choice (no wasted CPU), and
// streaming each entry straight to a FileSystemWritableFileStream means we never
// hold the whole archive in memory. Standard zip (not ZIP64): fine for typical
// "export selected" sets; for a multi-GB full course, prefer folder export.

const CRC_TABLE: Uint32Array = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(buf: Uint8Array): number {
	let crc = 0xffffffff;
	for (let i = 0; i < buf.length; i++) {
		crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
	}
	return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipSink {
	write(chunk: Uint8Array): Promise<void>;
	close(): Promise<void>;
}

interface CentralEntry {
	nameBytes: Uint8Array;
	crc: number;
	size: number;
	offset: number;
}

export class StoreZipWriter {
	private offset = 0;
	private entries: CentralEntry[] = [];

	constructor(private sink: ZipSink) {}

	private async put(chunk: Uint8Array): Promise<void> {
		await this.sink.write(chunk);
		this.offset += chunk.length;
	}

	async addFile({ name, data }: { name: string; data: Uint8Array }): Promise<void> {
		// ZIP32 hard limits — exceeding them silently corrupts the archive
		// (32-bit size/offset fields wrap). Fail loud and steer to folder export.
		if (data.length >= 0xffffffff) {
			throw new Error(
				`「${name}」超过单文件 4 GB 的 ZIP 上限，请改用「导出到 _localized 文件夹」`,
			);
		}
		if (this.offset + data.length + 1024 > ZIP_SIZE_LIMIT_BYTES) {
			throw new Error(
				"ZIP 总大小将超过 4 GB 上限，请改用「导出到 _localized 文件夹」或减少所选课时",
			);
		}
		const nameBytes = new TextEncoder().encode(name);
		const crc = crc32(data);
		const offset = this.offset;

		const header = new Uint8Array(30 + nameBytes.length);
		const dv = new DataView(header.buffer);
		dv.setUint32(0, 0x04034b50, true); // local file header signature
		dv.setUint16(4, 20, true); // version needed
		dv.setUint16(6, 0x0800, true); // flags: UTF-8 filename
		dv.setUint16(8, 0, true); // method: store
		dv.setUint16(10, 0, true); // mod time
		dv.setUint16(12, 0, true); // mod date
		dv.setUint32(14, crc, true);
		dv.setUint32(18, data.length, true); // compressed size
		dv.setUint32(22, data.length, true); // uncompressed size
		dv.setUint16(26, nameBytes.length, true);
		dv.setUint16(28, 0, true); // extra field length
		header.set(nameBytes, 30);

		await this.put(header);
		await this.put(data);
		this.entries.push({ nameBytes, crc, size: data.length, offset });
	}

	async finish(): Promise<void> {
		const cdStart = this.offset;
		for (const e of this.entries) {
			const rec = new Uint8Array(46 + e.nameBytes.length);
			const dv = new DataView(rec.buffer);
			dv.setUint32(0, 0x02014b50, true); // central directory header signature
			dv.setUint16(4, 20, true); // version made by
			dv.setUint16(6, 20, true); // version needed
			dv.setUint16(8, 0x0800, true); // flags: UTF-8
			dv.setUint16(10, 0, true); // method: store
			dv.setUint16(12, 0, true); // mod time
			dv.setUint16(14, 0, true); // mod date
			dv.setUint32(16, e.crc, true);
			dv.setUint32(20, e.size, true);
			dv.setUint32(24, e.size, true);
			dv.setUint16(28, e.nameBytes.length, true);
			dv.setUint16(30, 0, true); // extra length
			dv.setUint16(32, 0, true); // comment length
			dv.setUint16(34, 0, true); // disk number
			dv.setUint16(36, 0, true); // internal attrs
			dv.setUint32(38, 0, true); // external attrs
			dv.setUint32(42, e.offset, true); // local header offset
			rec.set(e.nameBytes, 46);
			await this.put(rec);
		}

		const cdSize = this.offset - cdStart;
		const eocd = new Uint8Array(22);
		const dv = new DataView(eocd.buffer);
		dv.setUint32(0, 0x06054b50, true); // end of central directory signature
		dv.setUint16(4, 0, true); // disk number
		dv.setUint16(6, 0, true); // cd start disk
		dv.setUint16(8, this.entries.length, true);
		dv.setUint16(10, this.entries.length, true);
		dv.setUint32(12, cdSize, true);
		dv.setUint32(16, cdStart, true);
		dv.setUint16(20, 0, true); // comment length
		await this.put(eocd);

		await this.sink.close();
	}
}

/** ~4 GB ceiling of a standard (non-ZIP64) archive — caller should warn past this. */
export const ZIP_SIZE_LIMIT_BYTES = 3_800_000_000;
