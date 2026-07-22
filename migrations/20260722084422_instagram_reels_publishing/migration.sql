ALTER TYPE "video_publication_status" ADD VALUE 'processing' BEFORE 'succeeded';--> statement-breakpoint
ALTER TABLE "video_publications" ADD COLUMN "caption" text;--> statement-breakpoint
ALTER TABLE "video_publications" ADD COLUMN "share_to_feed" boolean;--> statement-breakpoint
ALTER TABLE "video_publications" ADD COLUMN "provider_operation_id" text;--> statement-breakpoint
ALTER TABLE "video_publications" ADD COLUMN "provider_operation_stage" text;--> statement-breakpoint
ALTER TABLE "video_publications" ADD CONSTRAINT "video_publications_instagram_metadata_valid" CHECK ((
        "platform" = 'instagram'
        and "caption" is not null
        and "share_to_feed" is not null
        and "visibility" = 'public'
      ) or (
        "platform" <> 'instagram'
        and "caption" is null
        and "share_to_feed" is null
      ));