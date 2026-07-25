CREATE TYPE "scene_audio_asset_format" AS ENUM('mp3', 'opus', 'aac', 'flac', 'wav', 'pcm', 'webm', 'm4a');--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "voice_presets" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "voice_presets" ALTER COLUMN "format" DROP DEFAULT;--> statement-breakpoint
DROP TYPE "audio_output_format";--> statement-breakpoint
CREATE TYPE "audio_output_format" AS ENUM('mp3', 'opus', 'aac', 'flac', 'wav', 'pcm');--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ALTER COLUMN "format" SET DATA TYPE "audio_output_format" USING "format"::"audio_output_format";--> statement-breakpoint
ALTER TABLE "voice_presets" ALTER COLUMN "format" SET DATA TYPE "audio_output_format" USING "format"::"audio_output_format";--> statement-breakpoint
ALTER TABLE "voice_presets" ALTER COLUMN "format" SET DEFAULT 'mp3'::"audio_output_format";--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ALTER COLUMN "format" SET DATA TYPE "scene_audio_asset_format" USING "format"::text::"scene_audio_asset_format";