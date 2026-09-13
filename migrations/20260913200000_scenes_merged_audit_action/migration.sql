-- Merging destroys the absorbed scene: its row, its generated images, its
-- narration audio and its stored files all go. `AGENTS.md` requires destructive
-- operations to be recorded, and the audit vocabulary had no word for this one.
-- Distinct from 'scene_deleted' because the history has to say what a scene was
-- merged into, not merely that it disappeared.
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'scenes_merged';
