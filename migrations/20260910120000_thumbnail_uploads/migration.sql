-- Let a creator upload a thumbnail they already have instead of paying to
-- generate one.
--
-- Hand written rather than generated. Two reasons: `drizzle-kit push` skips a
-- CHECK whose expression changed, so the headline rule below would silently
-- keep its old definition, and the widening of the provider columns must be
-- ordered so that no existing row is ever invalid at any point.
--
-- Every statement is additive or widening. No existing row changes value: the
-- new column defaults to 'ai_generated', which is what every row already is.

ALTER TABLE "thumbnail_generations"
	ADD COLUMN "source" "image_generation_source" DEFAULT 'ai_generated' NOT NULL;--> statement-breakpoint

-- The columns that describe a paid provider call. An upload has none of them,
-- and inventing values would corrupt both the usage ledger and the guarantee
-- that a generation can be reproduced from what was stored.
ALTER TABLE "thumbnail_generations" ALTER COLUMN "text_mode" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ALTER COLUMN "prompt_template_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ALTER COLUMN "prompt_template_version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ALTER COLUMN "final_prompt" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ALTER COLUMN "idempotency_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ALTER COLUMN "request_fingerprint" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ALTER COLUMN "model" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ALTER COLUMN "quality" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ALTER COLUMN "output_compression" DROP NOT NULL;--> statement-breakpoint

-- "size" and "output_format" stay NOT NULL on purpose. Both are meaningful for
-- an upload: the size is the platform shape the file is validated against, and
-- the format is the file the creator actually supplied, which the object key is
-- built from.

-- A null text mode is now legal, and means "nobody asked a model for text", so
-- it carries no headline either.
ALTER TABLE "thumbnail_generations"
	DROP CONSTRAINT "thumbnail_generations_headline_matches_text_mode";--> statement-breakpoint
ALTER TABLE "thumbnail_generations"
	ADD CONSTRAINT "thumbnail_generations_headline_matches_text_mode" CHECK (
		("thumbnail_generations"."text_mode" = 'baked' AND "thumbnail_generations"."headline_text" IS NOT NULL AND length(btrim("thumbnail_generations"."headline_text")) > 0)
		OR ("thumbnail_generations"."text_mode" = 'clean' AND "thumbnail_generations"."headline_text" IS NULL)
		OR ("thumbnail_generations"."text_mode" IS NULL AND "thumbnail_generations"."headline_text" IS NULL)
	);--> statement-breakpoint

-- All of the provider columns together, or none of them. A half-filled row
-- would read either as a generation nobody can reproduce or as an upload that
-- appears to have cost money.
ALTER TABLE "thumbnail_generations"
	ADD CONSTRAINT "thumbnail_generations_source_fields" CHECK (
		("thumbnail_generations"."source" = 'ai_generated'
			AND "thumbnail_generations"."text_mode" IS NOT NULL
			AND "thumbnail_generations"."prompt_template_version_id" IS NOT NULL
			AND "thumbnail_generations"."prompt_template_version" IS NOT NULL
			AND "thumbnail_generations"."final_prompt" IS NOT NULL
			AND "thumbnail_generations"."idempotency_key" IS NOT NULL
			AND "thumbnail_generations"."request_fingerprint" IS NOT NULL
			AND "thumbnail_generations"."model" IS NOT NULL
			AND "thumbnail_generations"."quality" IS NOT NULL
			AND "thumbnail_generations"."output_compression" IS NOT NULL)
		OR ("thumbnail_generations"."source" = 'user_uploaded'
			AND "thumbnail_generations"."text_mode" IS NULL
			AND "thumbnail_generations"."prompt_template_version_id" IS NULL
			AND "thumbnail_generations"."prompt_template_version" IS NULL
			AND "thumbnail_generations"."final_prompt" IS NULL
			AND "thumbnail_generations"."idempotency_key" IS NULL
			AND "thumbnail_generations"."request_fingerprint" IS NULL
			AND "thumbnail_generations"."model" IS NULL
			AND "thumbnail_generations"."quality" IS NULL
			AND "thumbnail_generations"."output_compression" IS NULL
			AND "thumbnail_generations"."estimated_cost_cents" = 0
			AND ("thumbnail_generations"."actual_cost_cents" IS NULL OR "thumbnail_generations"."actual_cost_cents" = 0))
	);
