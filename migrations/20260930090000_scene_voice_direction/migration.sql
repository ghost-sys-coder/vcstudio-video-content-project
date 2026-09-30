-- Per-scene delivery direction for narration: tone, pacing and the words to
-- stress. Defaults keep every existing scene version exactly as it was, and a
-- scene with no direction is voiced with its preset's instructions alone.
ALTER TABLE "scene_versions" ADD COLUMN "voice_tone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_versions" ADD COLUMN "voice_pacing" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_versions" ADD COLUMN "voice_emphasis" jsonb DEFAULT '[]'::jsonb NOT NULL;
