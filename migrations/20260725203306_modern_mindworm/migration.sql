CREATE TYPE "audio_generation_source" AS ENUM('ai_generated', 'user_recorded');--> statement-breakpoint
CREATE TYPE "image_generation_source" AS ENUM('ai_generated', 'user_uploaded');--> statement-breakpoint
ALTER TYPE "audio_output_format" ADD VALUE 'webm';--> statement-breakpoint
ALTER TYPE "audio_output_format" ADD VALUE 'm4a';--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD COLUMN "source" "audio_generation_source" DEFAULT 'ai_generated'::"audio_generation_source" NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD COLUMN "source" "image_generation_source" DEFAULT 'ai_generated'::"image_generation_source" NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ALTER COLUMN "voice_preset_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ALTER COLUMN "idempotency_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ALTER COLUMN "request_fingerprint" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ALTER COLUMN "provider" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ALTER COLUMN "model" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ALTER COLUMN "voice" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ALTER COLUMN "speed_scaled_percent" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ALTER COLUMN "style_preset_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ALTER COLUMN "prompt_template_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ALTER COLUMN "idempotency_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ALTER COLUMN "request_fingerprint" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ALTER COLUMN "model" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ALTER COLUMN "quality" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ALTER COLUMN "output_compression" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ALTER COLUMN "prompt_template_version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ALTER COLUMN "style_preset_version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ALTER COLUMN "final_prompt" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" DROP CONSTRAINT "scene_audio_generations_speed_range", ADD CONSTRAINT "scene_audio_generations_speed_range" CHECK ("speed_scaled_percent" is null or "speed_scaled_percent" between 25 and 400);--> statement-breakpoint
ALTER TABLE "scene_image_generations" DROP CONSTRAINT "scene_image_generations_compression_range", ADD CONSTRAINT "scene_image_generations_compression_range" CHECK ("output_compression" is null or "output_compression" between 1 and 100);