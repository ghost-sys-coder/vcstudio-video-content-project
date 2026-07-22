ALTER TYPE "publication_visibility" ADD VALUE 'platform_default';--> statement-breakpoint
ALTER TABLE "video_publications" ADD COLUMN "provider_operation_secret_sealed" text;--> statement-breakpoint
ALTER TABLE "video_publications" ADD COLUMN "consent_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "video_publications" ADD CONSTRAINT "video_publications_tiktok_metadata_valid" CHECK ((
        "platform" = 'tiktok'
        and "visibility" = 'platform_default'
        and "consent_confirmed_at" is not null
      ) or (
        "platform" <> 'tiktok'
        and "visibility" <> 'platform_default'
        and "consent_confirmed_at" is null
      ));