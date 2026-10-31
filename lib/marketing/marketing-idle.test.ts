import { beforeEach, describe, expect, it, vi } from "vitest";

const scheduledRuns = vi.hoisted(
  () => new Map<string, (payload: unknown, context: unknown) => unknown>(),
);
const work = vi.hoisted(() => ({
  claimRuns: vi.fn(),
  advanceRule: vi.fn(),
  failRun: vi.fn(),
  markRunning: vi.fn(),
  performanceSync: vi.fn(),
  listWorkspaces: vi.fn(),
  generateDigest: vi.fn(),
  listConnections: vi.fn(),
  syncBusiness: vi.fn(),
  recordAudit: vi.fn(),
  trigger: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
  schedules: {
    task: (definition: {
      id: string;
      run: (payload: unknown, context: unknown) => unknown;
    }) => {
      scheduledRuns.set(definition.id, definition.run);
      return definition;
    },
  },
  tasks: { trigger: work.trigger },
  logger: { error: vi.fn() },
}));
vi.mock("@/lib/env/server", () => ({
  getMarketingEnvironment: () => ({ ENABLE_MARKETING_STUDIO: false }),
}));
vi.mock("@/db/commands/marketing-schedule-commands", () => ({
  claimDueMarketingScheduleRuns: work.claimRuns,
  advanceMarketingScheduleRule: work.advanceRule,
  failMarketingScheduleRun: work.failRun,
  markMarketingScheduleRunRunning: work.markRunning,
}));
vi.mock("@/trigger/publication-performance-sync", () => ({
  runPublicationPerformanceSync: work.performanceSync,
}));
vi.mock("@/db/repositories/marketing-settings.repository", () => ({
  listMarketingEnabledWorkspaceIds: work.listWorkspaces,
}));
vi.mock("@/db/repositories/marketing-weekly-digests.repository", () => ({
  generateMarketingWeeklyDigest: work.generateDigest,
}));
vi.mock("@/db/repositories/google-business.repository", () => ({
  listActiveGoogleBusinessConnections: work.listConnections,
}));
vi.mock("@/lib/marketing/integrations/sync-google-business", () => ({
  syncGoogleBusiness: work.syncBusiness,
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: work.recordAudit,
}));

import "@/trigger/marketing-schedule-sweeper";
import "@/trigger/marketing-weekly-digest";
import "@/trigger/google-business-daily-sync";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("paused Marketing Studio", () => {
  it.each([
    ["marketing-schedule-sweeper", { claimed: 0, dispatched: 0 }],
    ["marketing-weekly-digest", { checked: 0, generated: 0, failed: 0 }],
    ["google-business-daily-sync", { checked: 0, succeeded: 0, failed: 0 }],
  ])(
    "%s performs no database, provider or dispatch work",
    async (taskId, result) => {
      const run = scheduledRuns.get(taskId);
      expect(run).toBeDefined();
      await expect(
        run!(undefined, { ctx: { run: { id: "disabled-schedule-test" } } }),
      ).resolves.toEqual(result);
      for (const operation of Object.values(work)) {
        expect(operation).not.toHaveBeenCalled();
      }
    },
  );
});
