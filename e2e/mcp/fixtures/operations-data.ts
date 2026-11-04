import type { ReadinessView } from "@/lib/readiness/readiness";
import type { UsageDashboardView } from "@/lib/usage/usage-dashboard";
export const operationsWorkspaceId = "11111111-1111-4111-8111-111111111111";
export const readinessView: ReadinessView = {
  checkedAt: new Date("2026-11-05T08:15:00Z"),
  deployment: [
    {
      id: "schema",
      label: "Database schema",
      status: "ready",
      detail: "Required tables are present.",
      action: null,
    },
    {
      id: "r2",
      label: "Private object storage",
      status: "ready",
      detail: "The reported storage check succeeded.",
      action: null,
    },
    {
      id: "worker",
      label: "Trigger.dev worker",
      status: "unknown",
      detail: "No heartbeat has been recorded for this environment.",
      action: "Review the existing maintenance heartbeat.",
    },
  ],
  workspace: [
    {
      id: "connections",
      label: "Publishing authorizations",
      status: "degraded",
      detail: "One destination needs reconnection.",
      action:
        "Reconnect the affected destination from Accounts and connections.",
    },
    {
      id: "optional",
      label: "Optional service",
      status: "disabled",
      detail: "This optional service is disabled.",
      action: null,
    },
  ],
};
export const usageView: UsageDashboardView = {
  summary: {
    dayToDateCents: 430,
    monthToDateCents: 4573,
    pendingReservedCents: 1050,
    totalReconciledCents: 10924,
    byOperation: [
      {
        operationType: "scene_image_generation",
        committedCents: 8324,
        count: 9,
      },
      {
        operationType: "scene_audio_generation",
        committedCents: 2750,
        count: 6,
      },
      { operationType: "video_render", committedCents: 900, count: 3 },
    ],
    byProject: [
      {
        projectId: "22222222-2222-4222-8222-222222222222",
        projectName: "Building better creative habits",
        committedCents: 8324,
        count: 11,
      },
      {
        projectId: "33333333-3333-4333-8333-333333333333",
        projectName:
          "A practical guide to saving for your next project without losing momentum",
        committedCents: 3650,
        count: 7,
      },
    ],
  },
  settings: {
    dailyBudgetCents: 1000,
    monthlyBudgetCents: 12000,
    manualConfirmationThresholdCents: 500,
    maxImagesPerBatch: null,
    maxScenesPerAudioBatch: 4,
    maxRenderDurationSeconds: 180,
    maxRetryAttempts: null,
  },
  limitDefaults: {
    maxImagesPerBatch: 3,
    maxScenesPerAudioBatch: 5,
    maxRenderDurationSeconds: 300,
    maxRetryAttempts: 1,
  },
  ledger: {
    page: 1,
    pageCount: 3,
    total: 42,
    items: [
      {
        reservationId: "44444444-4444-4444-8444-444444444444",
        workspaceId: operationsWorkspaceId,
        projectId: "22222222-2222-4222-8222-222222222222",
        operationType: "scene_image_generation",
        requestedByUserId: null,
        requestedByName: "Studio owner",
        provider: "openai",
        model: "image-model",
        estimatedCostCents: 1050,
        reservedCostCents: 1050,
        actualCostCents: null,
        inputUnits: null,
        outputUnits: null,
        status: "pending",
        providerRequestId: null,
        workflowRunId: null,
        createdAt: new Date("2026-11-05T08:00:00Z"),
        settledAt: null,
      },
      {
        reservationId: "55555555-5555-4555-8555-555555555555",
        workspaceId: operationsWorkspaceId,
        projectId: "22222222-2222-4222-8222-222222222222",
        operationType: "scene_audio_generation",
        requestedByUserId: null,
        requestedByName: "Studio owner",
        provider: "openai",
        model: "speech-model",
        estimatedCostCents: 3000,
        reservedCostCents: 3000,
        actualCostCents: 2750,
        inputUnits: null,
        outputUnits: null,
        status: "reconciled",
        providerRequestId: null,
        workflowRunId: null,
        createdAt: new Date("2026-11-05T07:00:00Z"),
        settledAt: new Date("2026-11-05T07:01:00Z"),
      },
    ],
  },
  audit: {
    page: 1,
    pageCount: 3,
    total: 41,
    action: null,
    items: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        action: "budget_changed",
        actorUserId: null,
        actorName: "Studio owner",
        projectId: null,
        targetType: "workspace",
        targetId: operationsWorkspaceId,
        safeMetadata: { dailyBudgetCents: 1000, monthlyBudgetCents: 12000 },
        createdAt: new Date("2026-11-05T07:30:00Z"),
      },
    ],
  },
  marketing: null,
};
