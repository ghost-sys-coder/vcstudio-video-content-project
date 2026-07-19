CREATE TABLE "rate_limit_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope_key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_counters_count_nonnegative" CHECK ("count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_counters_scope_window_unique" ON "rate_limit_counters" ("scope_key","window_start");--> statement-breakpoint
CREATE INDEX "rate_limit_counters_window_index" ON "rate_limit_counters" ("window_start");