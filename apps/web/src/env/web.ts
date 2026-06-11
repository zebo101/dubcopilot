import { z } from "zod";

const webEnvSchema = z.object({
	// Node
	NODE_ENV: z.enum(["development", "production", "test"]),
	ANALYZE: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),

	// Public
	NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),

	// Server — optional: only the 音效 (Freesound) search needs these; the app
	// itself is fully client-side (no database, no auth).
	FREESOUND_CLIENT_ID: z.string().default(""),
	FREESOUND_API_KEY: z.string().default(""),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const webEnv = webEnvSchema.parse(process.env);
