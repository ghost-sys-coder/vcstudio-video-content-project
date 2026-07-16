import { describe, expect, it } from "vitest";
import { validateSceneImagePreflight } from "@/lib/domain/scene-image-preflight";

const now = new Date("2026-07-17T00:00:00.000Z");
const generation = {
  id: "generation-1",
  workspaceId: "workspace-1",
  projectId: "project-1",
  status: "queued" as const,
  estimatedCostCents: 8,
  requestFingerprint: "fingerprint",
  idempotencyKey: "idempotency-key",
};
const reservation = {
  workspaceId: generation.workspaceId,
  projectId: generation.projectId,
  operationType: "scene_image_generation" as const,
  imageGenerationId: generation.id,
  status: "pending" as const,
  reservedCostCents: generation.estimatedCostCents,
  expiresAt: new Date("2026-07-17T00:30:00.000Z"),
};
const references = [
  {
    workspaceId: generation.workspaceId,
    generationId: generation.id,
    referenceAssetIdSnapshot: "reference-a",
    position: 0,
  },
  {
    workspaceId: generation.workspaceId,
    generationId: generation.id,
    referenceAssetIdSnapshot: "reference-b",
    position: 1,
  },
];

type PreflightInput = Parameters<typeof validateSceneImagePreflight>[0];

function validate(
  overrides: {
    generation?: PreflightInput["generation"];
    reservation?: PreflightInput["reservation"];
    references?: PreflightInput["references"];
    expectedFingerprint?: string;
    expectedIdempotencyKey?: string;
    maximumReferenceAssets?: number;
    now?: Date;
  } = {},
) {
  return validateSceneImagePreflight({
    generation: overrides.generation ?? generation,
    reservation:
      overrides.reservation === undefined ? reservation : overrides.reservation,
    references: overrides.references ?? references,
    expectedScope: {
      workspaceId: generation.workspaceId,
      projectId: generation.projectId,
      generationId: generation.id,
    },
    expectedFingerprint: overrides.expectedFingerprint ?? "fingerprint",
    expectedIdempotencyKey:
      overrides.expectedIdempotencyKey ?? "idempotency-key",
    maximumReferenceAssets: overrides.maximumReferenceAssets ?? 8,
    now: overrides.now ?? now,
  });
}

describe("validateSceneImagePreflight", () => {
  it("accepts a scoped active generation with an intact reservation", () => {
    expect(validate()).toEqual({ ok: true });
  });

  it.each([
    ["missing", null, "reservation_missing"],
    [
      "wrong operation",
      { ...reservation, operationType: "scene_analysis" as const },
      "reservation_operation_mismatch",
    ],
    [
      "released",
      { ...reservation, status: "released" as const },
      "reservation_not_pending",
    ],
    ["expired", { ...reservation, expiresAt: now }, "reservation_expired"],
    [
      "cross-workspace",
      { ...reservation, workspaceId: "workspace-2" },
      "reservation_scope_mismatch",
    ],
    [
      "wrong amount",
      { ...reservation, reservedCostCents: 7 },
      "reservation_amount_mismatch",
    ],
  ])("rejects a %s reservation", (_label, candidate, category) => {
    const result = validate({ reservation: candidate });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe(category);
  });

  it("rejects a changed prompt or generation identity", () => {
    const fingerprint = validate({ expectedFingerprint: "changed" });
    expect(fingerprint.ok).toBe(false);
    if (!fingerprint.ok)
      expect(fingerprint.category).toBe("request_fingerprint_mismatch");

    const idempotency = validate({ expectedIdempotencyKey: "changed" });
    expect(idempotency.ok).toBe(false);
    if (!idempotency.ok)
      expect(idempotency.category).toBe("idempotency_key_mismatch");
  });

  it("rejects a terminal generation", () => {
    const result = validate({
      generation: { ...generation, status: "failed" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("generation_not_active");
  });

  it("rejects cross-workspace, duplicate, unsorted, and excess snapshots", () => {
    const crossWorkspace = validate({
      references: [
        ...references.slice(0, 1),
        { ...references[1], workspaceId: "workspace-2" },
      ],
    });
    expect(crossWorkspace.ok).toBe(false);
    if (!crossWorkspace.ok)
      expect(crossWorkspace.category).toBe("reference_scope_mismatch");

    const duplicate = validate({
      references: [
        references[0],
        { ...references[1], referenceAssetIdSnapshot: "reference-a" },
      ],
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok)
      expect(duplicate.category).toBe("reference_snapshot_invalid");

    expect(validate({ references: [references[1], references[0]] })).toEqual({
      ok: true,
    });

    const unsorted = validate({
      references: [
        { ...references[0], referenceAssetIdSnapshot: "reference-b" },
        { ...references[1], referenceAssetIdSnapshot: "reference-a" },
      ],
    });
    expect(unsorted.ok).toBe(false);
    if (!unsorted.ok)
      expect(unsorted.category).toBe("reference_snapshot_invalid");

    const excess = validate({ maximumReferenceAssets: 1 });
    expect(excess.ok).toBe(false);
    if (!excess.ok) expect(excess.category).toBe("reference_count_exceeded");
  });
});
