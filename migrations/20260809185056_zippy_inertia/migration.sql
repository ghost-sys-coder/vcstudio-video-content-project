CREATE TABLE "task_heartbeats" (
	"task_id" text,
	"environment" text,
	"last_started_at" timestamp with time zone NOT NULL,
	"last_completed_at" timestamp with time zone,
	"outcome" text NOT NULL,
	"safe_message" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_heartbeats_pkey" PRIMARY KEY("task_id","environment")
);
