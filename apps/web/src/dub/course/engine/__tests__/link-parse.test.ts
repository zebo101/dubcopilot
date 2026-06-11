import { describe, expect, test } from "bun:test";
import {
	classifyLink,
	extractGDriveFileId,
	lessonFileName,
	oneDriveContentUrl,
	sanitizeFileName,
} from "@/dub/course/link/parse";

describe("classifyLink", () => {
	test("youtube watch / shorts / youtu.be", () => {
		expect(classifyLink("https://www.youtube.com/watch?v=abc123")?.kind).toBe(
			"youtube",
		);
		expect(classifyLink("https://youtu.be/abc123")?.kind).toBe("youtube");
		expect(classifyLink("https://m.youtube.com/shorts/xyz")?.kind).toBe(
			"youtube",
		);
	});

	test("youtube playlist", () => {
		expect(
			classifyLink("https://www.youtube.com/playlist?list=PLabc")?.kind,
		).toBe("youtube-playlist");
		// watch URL with list param stays a single video (yt-dlp --no-playlist)
		expect(
			classifyLink("https://www.youtube.com/watch?v=abc&list=PLabc")?.kind,
		).toBe("youtube");
	});

	test("google drive file vs folder", () => {
		expect(
			classifyLink("https://drive.google.com/file/d/FILE123/view?usp=sharing")
				?.kind,
		).toBe("gdrive");
		expect(
			classifyLink("https://drive.google.com/open?id=FILE123")?.kind,
		).toBe("gdrive");
		expect(
			classifyLink(
				"https://drive.google.com/drive/folders/FOLDER123?usp=sharing",
			)?.kind,
		).toBe("gdrive-folder");
		expect(
			classifyLink("https://drive.google.com/drive/u/0/folders/F123")?.kind,
		).toBe("gdrive-folder");
	});

	test("onedrive hosts", () => {
		expect(classifyLink("https://1drv.ms/v/s!Abc-def")?.kind).toBe("onedrive");
		expect(
			classifyLink("https://onedrive.live.com/?cid=abc&id=def")?.kind,
		).toBe("onedrive");
		expect(
			classifyLink("https://contoso-my.sharepoint.com/:v:/g/personal/x")
				?.kind,
		).toBe("onedrive");
	});

	test("direct links and rejects", () => {
		expect(classifyLink("https://cdn.example.com/lesson1.mp4")?.kind).toBe(
			"direct",
		);
		expect(classifyLink("ftp://example.com/a.mp4")).toBeNull();
		expect(classifyLink("not a url")).toBeNull();
		expect(classifyLink("")).toBeNull();
	});
});

describe("extractGDriveFileId", () => {
	test("path and query forms", () => {
		expect(
			extractGDriveFileId("https://drive.google.com/file/d/FILE123/view"),
		).toBe("FILE123");
		expect(
			extractGDriveFileId("https://drive.google.com/open?id=FILE456"),
		).toBe("FILE456");
		expect(
			extractGDriveFileId("https://drive.google.com/uc?id=F789&export=download"),
		).toBe("F789");
		expect(extractGDriveFileId("https://drive.google.com/")).toBeNull();
	});
});

describe("oneDriveContentUrl", () => {
	test("base64url encoding with u! prefix, no padding", () => {
		const url = oneDriveContentUrl("https://1drv.ms/v/s!AAA");
		expect(url.startsWith("https://api.onedrive.com/v1.0/shares/u!")).toBe(
			true,
		);
		expect(url.endsWith("/root/content")).toBe(true);
		const token = url.split("/shares/")[1].split("/root")[0];
		expect(token.includes("=")).toBe(false);
		expect(token.includes("+")).toBe(false);
		expect(token.includes("/")).toBe(false);
	});
});

describe("file naming", () => {
	test("sanitizeFileName strips reserved chars, keeps spaces/hyphens", () => {
		expect(sanitizeFileName('a<b>:c"d/e\\f|g?h*i')).toBe("a b c d e f g h i");
		expect(sanitizeFileName("Lesson 3 - Intro")).toBe("Lesson 3 - Intro");
		expect(sanitizeFileName("trailing dots...")).toBe("trailing dots");
		expect(sanitizeFileName("  spaced   out  ")).toBe("spaced out");
	});

	test("lessonFileName pads paste order", () => {
		expect(lessonFileName({ index: 1, title: "Intro", ext: "mp4" })).toBe(
			"001 - Intro.mp4",
		);
		expect(lessonFileName({ index: 42, title: "", ext: "mp4" })).toBe(
			"042 - video_42.mp4",
		);
	});
});
