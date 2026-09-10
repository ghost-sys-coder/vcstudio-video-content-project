CREATE TYPE "public"."release_schedule_status" AS ENUM('scheduled', 'claimed', 'dispatched', 'cancelled', 'failed');--> statement-breakpoint
CREATE TABLE "release_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"release_package_id" uuid NOT NULL,
	"render_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"platform" "content_platform" NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"time_zone" text NOT NULL,
	"status" "release_schedule_status" DEFAULT 'scheduled'::"release_schedule_status" NOT NULL,
	"publication_id" uuid,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"safe_error_message" text,
	"claimed_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"requested_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_schedules_dispatch_fields" CHECK ((
		"release_schedules"."status" = 'dispatched'
		and "release_schedules"."publication_id" is not null
		and "release_schedules"."dispatched_at" is not null
	) or (
		"release_schedules"."status" <> 'dispatched'
		and "release_schedules"."publication_id" is null
	)),
	CONSTRAINT "release_schedules_cancelled_fields" CHECK ("release_schedules"."status" <> 'cancelled' or "release_schedules"."cancelled_at" is not null),
	CONSTRAINT "release_schedules_attempts_nonnegative" CHECK ("release_schedules"."attempt_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "release_schedules" ADD CONSTRAINT "release_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_schedules" ADD CONSTRAINT "release_schedules_connection_id_platform_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."platform_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_schedules" ADD CONSTRAINT "release_schedules_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_schedules" ADD CONSTRAINT "release_schedules_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_schedules" ADD CONSTRAINT "release_schedules_tenant_package_fkey" FOREIGN KEY ("release_package_id","workspace_id") REFERENCES "public"."release_packages"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_schedules" ADD CONSTRAINT "release_schedules_tenant_render_fkey" FOREIGN KEY ("render_id","project_id","workspace_id") REFERENCES "public"."video_renders"("id","project_id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_schedules" ADD CONSTRAINT "release_schedules_tenant_publication_fkey" FOREIGN KEY ("publication_id","workspace_id") REFERENCES "public"."video_publications"("id","workspace_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "release_schedules_id_workspace_unique" ON "release_schedules" USING btree ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "release_schedules_due_index" ON "release_schedules" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "release_schedules_workspace_project_index" ON "release_schedules" USING btree ("workspace_id","project_id","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "release_schedules_one_pending_per_target" ON "release_schedules" USING btree ("release_package_id","render_id","connection_id") WHERE status in ('scheduled', 'claimed');
