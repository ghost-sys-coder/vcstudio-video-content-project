type SceneImageGeneration = {
  id: string;
  workspaceId: string;
  projectId: string;
  status:
    "pending" | "queued" | "running" | "succeeded" | "failed" | "cancelled";
  estimatedCostCents: number;
  requestFingerprint: string;
  idempotencyKey: string;
};

type SceneImageReservation = {
  workspaceId: string;
  projectId: string;
  operationType:
    | "scene_analysis"
    | "scene_image_generation"
    | "scene_audio_generation"
    | "video_render";
  imageGenerationId: string | null;
  status: "pending" | "reconciled" | "released";
  reservedCostCents: number;
  expiresAt: Date;
};

type SceneImageReferenceSnapshot = {
  workspaceId: string;
  generationId: string;
  referenceAssetIdSnapshot: string;
  position: number;
};

export type SceneImagePreflightFailureCategory =
  | "generation_scope_mismatch"
  | "generation_not_active"
  | "reservation_missing"
  | "reservation_scope_mismatch"
  | "reservation_operation_mismatch"
  | "reservation_not_pending"
  | "reservation_expired"
  | "reservation_amount_mismatch"
  | "request_fingerprint_mismatch"
  | "idempotency_key_mismatch"
  | "reference_scope_mismatch"
  | "reference_count_exceeded"
  | "reference_snapshot_invalid";

export type SceneImagePreflightResult =
  | { ok: true }
  | {
      ok: false;
      category: SceneImagePreflightFailureCategory;
      message: string;
    };

function failure(
  category: SceneImagePreflightFailureCategory,
  message: string,
): SceneImagePreflightResult {
  return { ok: false, category, message };
}

export function validateSceneImagePreflight(input: {
  generation: SceneImageGeneration;
  reservation: SceneImageReservation | null;
  references: SceneImageReferenceSnapshot[];
  expectedScope: {
    workspaceId: string;
    projectId: string;
    generationId: string;
  };
  expectedFingerprint: string;
  expectedIdempotencyKey: string;
  maximumReferenceAssets: number;
  now: Date;
}): SceneImagePreflightResult {
  const { generation, reservation } = input;
  if (
    generation.id !== input.expectedScope.generationId ||
    generation.workspaceId !== input.expectedScope.workspaceId ||
    generation.projectId !== input.expectedScope.projectId
  )
    return failure(
      "generation_scope_mismatch",
      "The image generation does not belong to the expected project.",
    );

  if (!new Set(["pending", "queued", "running"]).has(generation.status))
    return failure(
      "generation_not_active",
      "The image generation is no longer active.",
    );

  if (!reservation)
    return failure(
      "reservation_missing",
      "The image generation budget reservation is unavailable.",
    );

  if (
    reservation.workspaceId !== generation.workspaceId ||
    reservation.projectId !== generation.projectId ||
    reservation.imageGenerationId !== generation.id
  )
    return failure(
      "reservation_scope_mismatch",
      "The image generation budget reservation is invalid.",
    );

  if (reservation.operationType !== "scene_image_generation")
    return failure(
      "reservation_operation_mismatch",
      "The budget reservation is for a different operation.",
    );

  if (reservation.status !== "pending")
    return failure(
      "reservation_not_pending",
      "The image generation budget reservation is no longer pending.",
    );

  if (reservation.expiresAt.getTime() <= input.now.getTime())
    return failure(
      "reservation_expired",
      "The image generation budget reservation has expired.",
    );

  if (reservation.reservedCostCents !== generation.estimatedCostCents)
    return failure(
      "reservation_amount_mismatch",
      "The image generation budget reservation amount is invalid.",
    );

  if (generation.requestFingerprint !== input.expectedFingerprint)
    return failure(
      "request_fingerprint_mismatch",
      "The image prompt changed after cost confirmation.",
    );

  if (generation.idempotencyKey !== input.expectedIdempotencyKey)
    return failure(
      "idempotency_key_mismatch",
      "The image generation identity changed after confirmation.",
    );

  if (
    !Number.isInteger(input.maximumReferenceAssets) ||
    input.maximumReferenceAssets < 0 ||
    input.references.length > input.maximumReferenceAssets
  )
    return failure(
      "reference_count_exceeded",
      "The image generation has too many reference assets.",
    );

  const orderedReferences = [...input.references].sort(
    (left, right) => left.position - right.position,
  );
  if (
    orderedReferences.some(
      (reference) =>
        reference.workspaceId !== generation.workspaceId ||
        reference.generationId !== generation.id,
    )
  )
    return failure(
      "reference_scope_mismatch",
      "A selected image reference belongs to a different generation.",
    );

  const referenceAssetIds = orderedReferences.map(
    ({ referenceAssetIdSnapshot }) => referenceAssetIdSnapshot,
  );
  const expectedReferenceOrder = [...referenceAssetIds].sort();
  if (
    new Set(referenceAssetIds).size !== referenceAssetIds.length ||
    orderedReferences.some(
      (reference, index) => reference.position !== index,
    ) ||
    referenceAssetIds.some(
      (referenceAssetId, index) =>
        referenceAssetId !== expectedReferenceOrder[index],
    )
  )
    return failure(
      "reference_snapshot_invalid",
      "The selected image reference snapshot is invalid.",
    );

  return { ok: true };
}
