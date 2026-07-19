import {
  usageOperationTypeEnum,
  usageReservationStatusEnum,
} from "@/db/schema";

export type UsageOperationType =
  (typeof usageOperationTypeEnum.enumValues)[number];
export type UsageReservationStatus =
  (typeof usageReservationStatusEnum.enumValues)[number];

/**
 * A single unified ledger entry, derived by joining a `usage_reservations` row
 * to its operation table (never stored as its own row). This is the read model
 * that satisfies the Phase 10 ledger contract without touching the money-safe
 * write path.
 */
export type UsageLedgerEntry = {
  reservationId: string;
  workspaceId: string;
  projectId: string;
  operationType: UsageOperationType;
  requestedByUserId: string | null;
  requestedByName: string | null;
  provider: string | null;
  model: string | null;
  estimatedCostCents: number;
  reservedCostCents: number;
  actualCostCents: number | null;
  inputUnits: number | null;
  outputUnits: number | null;
  status: UsageReservationStatus;
  providerRequestId: string | null;
  workflowRunId: string | null;
  createdAt: Date;
  settledAt: Date | null;
};

export const USAGE_OPERATION_LABELS: Record<UsageOperationType, string> = {
  scene_analysis: "Scene analysis",
  scene_image_generation: "Scene image",
  scene_audio_generation: "Scene narration",
  video_render: "Video render",
  script_generation: "Script generation",
};

export const USAGE_STATUS_LABELS: Record<UsageReservationStatus, string> = {
  pending: "Reserved",
  reconciled: "Settled",
  released: "Released",
};

export const USAGE_OPERATION_PROVIDERS: Record<UsageOperationType, string> = {
  scene_analysis: "openai",
  scene_image_generation: "openai",
  scene_audio_generation: "openai",
  video_render: "remotion",
  script_generation: "openai",
};

/** Deterministic `YYYY-MM-DD HH:MM` (UTC) timestamp for ledger/audit tables. */
export function formatLedgerTimestamp(value: Date): string {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

/**
 * The amount a reservation currently commits against a budget: its reserved
 * estimate while pending, its actual once settled, and nothing once released.
 * Mirrors the committed-cost logic in the reservation SQL.
 */
export function committedCents(entry: {
  status: UsageReservationStatus;
  reservedCostCents: number;
  actualCostCents: number | null;
}): number {
  if (entry.status === "pending") return entry.reservedCostCents;
  if (entry.status === "released") return 0;
  return entry.actualCostCents ?? 0;
}
