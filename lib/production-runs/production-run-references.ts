/**
 * The rows a run created, remembered so a later step reads exactly those rows
 * rather than "the latest" of their kind.
 *
 * Without this, a run would be unable to tell its own render from one a
 * creator started last week, or its own script generation from an earlier
 * attempt whose text was already rejected. Every id here points at a row the
 * stage services own; the run never duplicates their state.
 */
export interface ProductionRunReferences {
  scriptGenerationRunId?: string;
  sceneAnalysisRunId?: string;
  imageBatchIds?: string[];
  audioRequestNonces?: string[];
  renderId?: string;
  titleGenerationRunId?: string;
  thumbnailGenerationId?: string;
  releasePackageId?: string;
}
