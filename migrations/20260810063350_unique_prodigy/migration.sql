ALTER TABLE "marketing_knowledge_document_chunks" ADD COLUMN "provider_request_id" text;--> statement-breakpoint
ALTER TABLE "marketing_knowledge_document_chunks" ADD COLUMN "input_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_knowledge_document_chunks" ADD COLUMN "output_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_knowledge_documents" ADD COLUMN "summary_provider_request_id" text;--> statement-breakpoint
ALTER TABLE "marketing_knowledge_documents" ADD COLUMN "summary_input_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_knowledge_documents" ADD COLUMN "summary_output_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_knowledge_document_chunks" DROP CONSTRAINT "marketing_knowledge_document_chunks_values_nonnegative", ADD CONSTRAINT "marketing_knowledge_document_chunks_values_nonnegative" CHECK ("chunk_index" >= 0 and "token_estimate" >= 0 and "input_tokens" >= 0 and "output_tokens" >= 0);