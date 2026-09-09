-- Hand-written. Drizzle cannot express this constraint.
--
-- `scene_image_generations_tenant_batch_fkey` is a composite foreign key on
-- (batch_id, workspace_id). PostgreSQL's bare ON DELETE SET NULL nulls *every*
-- column in the key, and workspace_id is NOT NULL, so deleting a batch fails
-- outright with a not-null violation instead of orphaning its generations.
--
-- The column list keeps the intended meaning of a batch delete: the generations
-- survive, batch_id becomes null, and the tenant column is left alone. Drizzle's
-- onDelete only accepts a bare action, so schema.ts cannot carry the list and
-- this migration is the source of truth. A guard test asserts the live shape.
ALTER TABLE "scene_image_generations"
	DROP CONSTRAINT "scene_image_generations_tenant_batch_fkey";--> statement-breakpoint
ALTER TABLE "scene_image_generations"
	ADD CONSTRAINT "scene_image_generations_tenant_batch_fkey"
	FOREIGN KEY ("batch_id", "workspace_id")
	REFERENCES "scene_image_batches"("id", "workspace_id")
	ON DELETE SET NULL ("batch_id");
