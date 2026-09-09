import { describe, expect, it } from "vitest";
import {
  productionQueueQuerySchema,
  setPlannedReleaseSchema,
} from "@/lib/schemas/production-queue";
import { PRODUCTION_QUEUE_MAX_PAGE_SIZE } from "@/lib/production/production-queue-filters";

describe("productionQueueQuerySchema", () => {
  it("applies bounded defaults for an empty query string", () => {
    const parsed = productionQueueQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.release).toBe("all");
    expect(parsed.attention).toBe("all");
    expect(parsed.channelProfileId).toBeNull();
    expect(parsed.includeArchived).toBe(false);
  });

  it("refuses to let a crafted URL request an unbounded page", () => {
    // The guard behind "dashboard queries remain bounded": an oversized or
    // nonsensical page size falls back to the default rather than reaching
    // the database.
    expect(
      productionQueueQuerySchema.parse({ pageSize: "100000" }).pageSize,
    ).toBe(20);
    expect(productionQueueQuerySchema.parse({ pageSize: "0" }).pageSize).toBe(
      20,
    );
    expect(productionQueueQuerySchema.parse({ pageSize: "-5" }).pageSize).toBe(
      20,
    );
    expect(productionQueueQuerySchema.parse({ pageSize: "abc" }).pageSize).toBe(
      20,
    );
    expect(
      productionQueueQuerySchema.parse({
        pageSize: String(PRODUCTION_QUEUE_MAX_PAGE_SIZE),
      }).pageSize,
    ).toBe(PRODUCTION_QUEUE_MAX_PAGE_SIZE);
  });

  it("falls back to page one for a nonsensical page", () => {
    expect(productionQueueQuerySchema.parse({ page: "0" }).page).toBe(1);
    expect(productionQueueQuerySchema.parse({ page: "-3" }).page).toBe(1);
    expect(productionQueueQuerySchema.parse({ page: "nope" }).page).toBe(1);
    expect(productionQueueQuerySchema.parse({ page: "4" }).page).toBe(4);
  });

  it("ignores an unknown filter instead of failing the page", () => {
    expect(
      productionQueueQuerySchema.parse({ release: "invented" }).release,
    ).toBe("all");
    expect(
      productionQueueQuerySchema.parse({ attention: "invented" }).attention,
    ).toBe("all");
  });

  it("treats an empty channel as no filter and rejects a malformed one", () => {
    expect(
      productionQueueQuerySchema.parse({ channelProfileId: "" })
        .channelProfileId,
    ).toBeNull();
    expect(
      productionQueueQuerySchema.safeParse({ channelProfileId: "not-a-uuid" })
        .success,
    ).toBe(false);
    const id = "11111111-1111-4111-8111-111111111111";
    expect(
      productionQueueQuerySchema.parse({ channelProfileId: id })
        .channelProfileId,
    ).toBe(id);
  });

  it("keeps archived projects out unless they are asked for explicitly", () => {
    expect(productionQueueQuerySchema.parse({}).includeArchived).toBe(false);
    expect(
      productionQueueQuerySchema.parse({ includeArchived: "false" })
        .includeArchived,
    ).toBe(false);
    expect(
      productionQueueQuerySchema.parse({ includeArchived: "true" })
        .includeArchived,
    ).toBe(true);
  });
});

describe("setPlannedReleaseSchema", () => {
  const projectId = "22222222-2222-4222-8222-222222222222";

  it("parses a release date", () => {
    const parsed = setPlannedReleaseSchema.parse({
      projectId,
      plannedReleaseAt: "2026-10-01T09:00:00.000Z",
    });
    expect(parsed.plannedReleaseAt?.toISOString()).toBe(
      "2026-10-01T09:00:00.000Z",
    );
  });

  it("treats an empty value as clearing the plan", () => {
    expect(
      setPlannedReleaseSchema.parse({ projectId, plannedReleaseAt: "" })
        .plannedReleaseAt,
    ).toBeNull();
    expect(
      setPlannedReleaseSchema.parse({ projectId }).plannedReleaseAt,
    ).toBeNull();
  });

  it("rejects an unparseable date and a malformed project", () => {
    expect(
      setPlannedReleaseSchema.safeParse({
        projectId,
        plannedReleaseAt: "sometime soon",
      }).success,
    ).toBe(false);
    expect(
      setPlannedReleaseSchema.safeParse({ projectId: "nope" }).success,
    ).toBe(false);
  });
});
