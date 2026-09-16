-- How busy a project's finished video should feel.
--
-- Camera motion and scene transitions were derived from the scene's *number*:
-- a four-move cycle by position, and a fade into everything after the first
-- scene. Neither knew the scene's length, its content or where the video was
-- going, which is what made a finished video read as assembled rather than
-- timed. The profile is what those derivations consult instead.
--
-- Defaulted to 'explainer' deliberately: that profile reproduces the previous
-- behaviour exactly, so no existing project re-cuts itself because this column
-- appeared.
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "pacing_profile" text NOT NULL DEFAULT 'explainer';

-- Constrained rather than free text, because it names a finite set of
-- behaviours. Reads still fall back to the default for an unrecognised value,
-- which covers a profile retired from the code while rows still name it.
DO $$
BEGIN
  ALTER TABLE "projects"
    ADD CONSTRAINT "projects_pacing_profile_valid"
    CHECK ("pacing_profile" in ('documentary', 'explainer', 'short'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
