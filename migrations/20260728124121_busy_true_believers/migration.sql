CREATE TYPE "project_video_kind" AS ENUM('staticImages', 'animatedCharacter');--> statement-breakpoint
CREATE TYPE "scene_character_stage_slot" AS ENUM('left', 'center', 'right');--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "video_kind" "project_video_kind" DEFAULT 'staticImages'::"project_video_kind" NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_version_characters" ADD COLUMN "stage_slot" "scene_character_stage_slot" DEFAULT 'center'::"scene_character_stage_slot" NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_version_characters" ADD COLUMN "is_speaker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "scene_version_characters_single_speaker_unique" ON "scene_version_characters" ("scene_version_id") WHERE "is_speaker";