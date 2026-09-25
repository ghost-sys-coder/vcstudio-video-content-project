-- A creator may start a project by authoring scenes without a script or AI run.
ALTER TABLE "scenes" ALTER COLUMN "script_version_id" DROP NOT NULL;
ALTER TABLE "scenes" ALTER COLUMN "analysis_run_id" DROP NOT NULL;

ALTER TABLE "scenes" ADD CONSTRAINT "scenes_origin_pair"
  CHECK (("script_version_id" IS NULL AND "analysis_run_id" IS NULL)
      OR ("script_version_id" IS NOT NULL AND "analysis_run_id" IS NOT NULL));

-- PostgreSQL treats NULL analysis run ids as distinct in the existing unique
-- index. Manual scenes need project-scoped scene numbers under concurrent adds.
CREATE UNIQUE INDEX "scenes_manual_project_number_unique"
  ON "scenes" ("project_id", "scene_number")
  WHERE "analysis_run_id" IS NULL;
