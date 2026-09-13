export interface SceneRevisionEstimateView {
  lines: string[];
  estimatedCostCents: number;
  unavailableCount: number;
  /**
   * Approved images and narration this edit invalidates.
   *
   * Deliberately separate from `estimatedCostCents`, because zero cost does not
   * mean nothing is at stake: an uploaded image or a recorded voice-over is
   * destroyed by the edit just the same, and neither can be priced. Anything
   * deciding whether to stop and ask must read this, not the money.
   */
  affectedMediaCount: number;
}
