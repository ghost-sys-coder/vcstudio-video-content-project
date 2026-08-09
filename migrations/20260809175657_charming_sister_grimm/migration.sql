CREATE TABLE "storage_reconciliation_checkpoints" (
	"sweep" text PRIMARY KEY,
	"last_object_key" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
