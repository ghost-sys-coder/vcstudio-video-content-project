ALTER TABLE "title_generation_runs" ADD COLUMN "generated_description" text;--> statement-breakpoint
ALTER TABLE "title_generation_runs" ADD COLUMN "generated_tags" jsonb;