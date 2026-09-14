-- A scene may hold several approved images ("shots"): approval is keyed on
-- (scene version, size, shot). The carry-forward that preserves approved media
-- across a revision predates that change and was never widened with it.
-- `scene_revision_media` is unique on (scene_version_id, slot) where slot holds
-- only a size, so a scene with two shots at one size could bind only one of
-- them. Every edit to such a scene silently dropped the rest, and merging
-- inherited the same loss.
ALTER TABLE "scene_revision_media"
  ADD COLUMN IF NOT EXISTS "shot_index" integer NOT NULL DEFAULT 0;

-- Existing bindings already point at a generation that knows which shot it is,
-- so the true value is recovered rather than assumed to be the first shot.
UPDATE "scene_revision_media" b
SET "shot_index" = g."shot_index"
FROM "scene_image_generations" g
WHERE g."id" = b."image_generation_id"
  AND b."shot_index" <> g."shot_index";

-- Safe in either order: the old index cannot be violated by adding a column,
-- and the rows were unique on (version, slot) already, so widening the key
-- cannot collide.
DROP INDEX IF EXISTS "scene_revision_media_version_slot_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "scene_revision_media_version_slot_shot_unique"
  ON "scene_revision_media" ("scene_version_id", "slot", "shot_index");

-- Narration has no shots. Pinning it to zero keeps exactly one audio binding
-- per version, which the old two-column index used to guarantee on its own.
DO $$
BEGIN
  ALTER TABLE "scene_revision_media"
    ADD CONSTRAINT "scene_revision_media_shot_index_valid"
    CHECK ("shot_index" >= 0 AND ("slot" <> 'audio' OR "shot_index" = 0));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
