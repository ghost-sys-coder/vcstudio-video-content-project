import "server-only";

import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  sceneAnalysisRuns,
  sceneAudioGenerations,
  sceneImageGenerations,
  usageReservations,
  users,
  videoRenders,
} from "@/db/schema";
import { calculatePagination } from "@/lib/domain/pagination";
import {
  USAGE_OPERATION_PROVIDERS,
  type UsageLedgerEntry,
  type UsageOperationType,
} from "@/lib/usage/usage-ledger";

type Enrichment = {
  requestedByUserId: string | null;
  provider: string | null;
  model: string | null;
  estimatedCostCents: number;
  inputUnits: number | null;
  outputUnits: number | null;
  providerRequestId: string | null;
  workflowRunId: string | null;
};

/**
 * Paginated, workspace-scoped unified ledger. The `usage_reservations` spine
 * provides reserved/actual/status/created/settled; each page's rows are then
 * enriched with user/provider/model/units/workflow-run from the matching
 * operation table via a bounded query per operation type (never N+1). The
 * money-safe write path is not touched.
 */
export async function listUsageLedgerEntries(input: {
  workspaceId: string;
  page: number;
  pageSize: number;
  operationType?: UsageOperationType | null;
  since?: Date | null;
  until?: Date | null;
}): Promise<{
  items: UsageLedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const filters = [eq(usageReservations.workspaceId, input.workspaceId)];
  if (input.operationType)
    filters.push(eq(usageReservations.operationType, input.operationType));
  if (input.since) filters.push(gte(usageReservations.createdAt, input.since));
  if (input.until) filters.push(lte(usageReservations.createdAt, input.until));
  const where = and(...filters);
  const offset = calculatePagination({ ...input, total: 0 }).offset;

  const [reservations, totals] = await Promise.all([
    getDatabase()
      .select()
      .from(usageReservations)
      .where(where)
      .orderBy(desc(usageReservations.createdAt), desc(usageReservations.id))
      .limit(input.pageSize)
      .offset(offset),
    getDatabase()
      .select({ value: count() })
      .from(usageReservations)
      .where(where),
  ]);
  const total = totals[0]?.value ?? 0;

  const analysisIds: string[] = [];
  const imageIds: string[] = [];
  const audioIds: string[] = [];
  const renderIds: string[] = [];
  for (const reservation of reservations) {
    if (reservation.analysisRunId) analysisIds.push(reservation.analysisRunId);
    if (reservation.imageGenerationId)
      imageIds.push(reservation.imageGenerationId);
    if (reservation.audioGenerationId)
      audioIds.push(reservation.audioGenerationId);
    if (reservation.videoRenderId) renderIds.push(reservation.videoRenderId);
  }

  const enrichment = new Map<string, Enrichment>();
  const database = getDatabase();
  await Promise.all([
    analysisIds.length === 0
      ? Promise.resolve()
      : database
          .select({
            id: sceneAnalysisRuns.id,
            requestedByUserId: sceneAnalysisRuns.requestedByUserId,
            model: sceneAnalysisRuns.model,
            providerRequestId: sceneAnalysisRuns.providerRequestId,
            triggerRunId: sceneAnalysisRuns.triggerRunId,
            inputTokens: sceneAnalysisRuns.inputTokens,
            outputTokens: sceneAnalysisRuns.outputTokens,
            estimatedCostCents: sceneAnalysisRuns.estimatedCostCents,
          })
          .from(sceneAnalysisRuns)
          .where(
            and(
              eq(sceneAnalysisRuns.workspaceId, input.workspaceId),
              inArray(sceneAnalysisRuns.id, analysisIds),
            ),
          )
          .then((rows) => {
            for (const row of rows)
              enrichment.set(row.id, {
                requestedByUserId: row.requestedByUserId,
                provider: "openai",
                model: row.model,
                estimatedCostCents: row.estimatedCostCents,
                inputUnits: row.inputTokens,
                outputUnits: row.outputTokens,
                providerRequestId: row.providerRequestId,
                workflowRunId: row.triggerRunId,
              });
          }),
    imageIds.length === 0
      ? Promise.resolve()
      : database
          .select({
            id: sceneImageGenerations.id,
            requestedByUserId: sceneImageGenerations.requestedByUserId,
            model: sceneImageGenerations.model,
            triggerRunId: sceneImageGenerations.triggerRunId,
            estimatedCostCents: sceneImageGenerations.estimatedCostCents,
          })
          .from(sceneImageGenerations)
          .where(
            and(
              eq(sceneImageGenerations.workspaceId, input.workspaceId),
              inArray(sceneImageGenerations.id, imageIds),
            ),
          )
          .then((rows) => {
            for (const row of rows)
              enrichment.set(row.id, {
                requestedByUserId: row.requestedByUserId,
                provider: "openai",
                model: row.model,
                estimatedCostCents: row.estimatedCostCents,
                inputUnits: null,
                outputUnits: null,
                providerRequestId: null,
                workflowRunId: row.triggerRunId,
              });
          }),
    audioIds.length === 0
      ? Promise.resolve()
      : database
          .select({
            id: sceneAudioGenerations.id,
            requestedByUserId: sceneAudioGenerations.requestedByUserId,
            provider: sceneAudioGenerations.provider,
            model: sceneAudioGenerations.model,
            providerRequestId: sceneAudioGenerations.providerRequestId,
            triggerRunId: sceneAudioGenerations.triggerRunId,
            inputCharacterCount: sceneAudioGenerations.inputCharacterCount,
            estimatedCostCents: sceneAudioGenerations.estimatedCostCents,
          })
          .from(sceneAudioGenerations)
          .where(
            and(
              eq(sceneAudioGenerations.workspaceId, input.workspaceId),
              inArray(sceneAudioGenerations.id, audioIds),
            ),
          )
          .then((rows) => {
            for (const row of rows)
              enrichment.set(row.id, {
                requestedByUserId: row.requestedByUserId,
                provider: row.provider,
                model: row.model,
                estimatedCostCents: row.estimatedCostCents,
                inputUnits: row.inputCharacterCount,
                outputUnits: null,
                providerRequestId: row.providerRequestId,
                workflowRunId: row.triggerRunId,
              });
          }),
    renderIds.length === 0
      ? Promise.resolve()
      : database
          .select({
            id: videoRenders.id,
            requestedByUserId: videoRenders.requestedByUserId,
            preset: videoRenders.preset,
            providerRequestId: videoRenders.providerRequestId,
            triggerRunId: videoRenders.triggerRunId,
            estimatedCostCents: videoRenders.estimatedCostCents,
          })
          .from(videoRenders)
          .where(
            and(
              eq(videoRenders.workspaceId, input.workspaceId),
              inArray(videoRenders.id, renderIds),
            ),
          )
          .then((rows) => {
            for (const row of rows)
              enrichment.set(row.id, {
                requestedByUserId: row.requestedByUserId,
                provider: "remotion",
                model: row.preset,
                estimatedCostCents: row.estimatedCostCents,
                inputUnits: null,
                outputUnits: null,
                providerRequestId: row.providerRequestId,
                workflowRunId: row.triggerRunId,
              });
          }),
  ]);

  const userIds = [
    ...new Set(
      [...enrichment.values()]
        .map((detail) => detail.requestedByUserId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const userNames = new Map<string, string>();
  if (userIds.length > 0) {
    const userRows = await database
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const row of userRows) userNames.set(row.id, row.displayName);
  }

  const items: UsageLedgerEntry[] = reservations.map((reservation) => {
    const operationId =
      reservation.analysisRunId ??
      reservation.imageGenerationId ??
      reservation.audioGenerationId ??
      reservation.videoRenderId;
    const detail = operationId ? enrichment.get(operationId) : undefined;
    return {
      reservationId: reservation.id,
      workspaceId: reservation.workspaceId,
      projectId: reservation.projectId,
      operationType: reservation.operationType,
      requestedByUserId: detail?.requestedByUserId ?? null,
      requestedByName: detail?.requestedByUserId
        ? (userNames.get(detail.requestedByUserId) ?? null)
        : null,
      provider:
        detail?.provider ??
        USAGE_OPERATION_PROVIDERS[reservation.operationType],
      model: detail?.model ?? null,
      estimatedCostCents:
        detail?.estimatedCostCents ?? reservation.reservedCostCents,
      reservedCostCents: reservation.reservedCostCents,
      actualCostCents: reservation.actualCostCents,
      inputUnits: detail?.inputUnits ?? null,
      outputUnits: detail?.outputUnits ?? null,
      status: reservation.status,
      providerRequestId: detail?.providerRequestId ?? null,
      workflowRunId: detail?.workflowRunId ?? null,
      createdAt: reservation.createdAt,
      settledAt:
        reservation.status === "pending" ? null : reservation.updatedAt,
    };
  });

  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: calculatePagination({ ...input, total }).pageCount,
  };
}
