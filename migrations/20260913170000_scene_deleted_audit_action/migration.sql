-- Deleting a scene destroys paid work: its generated images, its narration
-- audio, and any clip made from it all cascade away with the row. `AGENTS.md`
-- requires destructive operations to be recorded, and the audit vocabulary had
-- no word for this one.
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'scene_deleted';
