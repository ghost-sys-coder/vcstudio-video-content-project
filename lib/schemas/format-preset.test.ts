import { describe, expect, it } from "vitest";
import { createProjectSchema } from "@/lib/schemas/project";
import {
  createFormatPresetSlug,
  formatPresetVersionInputSchema,
  ideaBacklogSchema,
} from "@/lib/schemas/format-preset";

const VALID = { aspectRatio: "16:9" as const };

describe("formatPresetVersionInputSchema", () => {
  it("applies safe defaults", () => {
    const parsed = formatPresetVersionInputSchema.parse(VALID);
    expect(parsed.framesPerSecond).toBe(30);
    expect(parsed.captionsEnabled).toBe(true);
    expect(parsed.targetDurationSeconds).toBeNull();
    expect(parsed.defaultMaximumBudgetCents).toBeNull();
  });

  it("cannot raise a workspace's spending ceiling above the project limit", () => {
    // The guard behind "channel defaults never bypass maximum limits": a preset
    // is validated against the same cap the project form enforces, so it can
    // never seed a project with a budget the project itself would reject.
    const projectCap = createProjectSchema.safeParse({
      name: "Probe",
      aspectRatio: "16:9",
      framesPerSecond: 30,
      language: "en",
      maximumBudgetCents: 100001,
    });
    expect(projectCap.success).toBe(false);
    expect(
      formatPresetVersionInputSchema.safeParse({
        ...VALID,
        defaultMaximumBudgetCents: 100001,
      }).success,
    ).toBe(false);
    expect(
      formatPresetVersionInputSchema.safeParse({
        ...VALID,
        defaultMaximumBudgetCents: 100000,
      }).success,
    ).toBe(true);
  });

  it("rejects a negative budget and a zero-or-negative duration", () => {
    expect(
      formatPresetVersionInputSchema.safeParse({
        ...VALID,
        defaultMaximumBudgetCents: -1,
      }).success,
    ).toBe(false);
    expect(
      formatPresetVersionInputSchema.safeParse({
        ...VALID,
        targetDurationSeconds: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects an out-of-range frame rate and an unknown aspect ratio", () => {
    expect(
      formatPresetVersionInputSchema.safeParse({
        ...VALID,
        framesPerSecond: 240,
      }).success,
    ).toBe(false);
    expect(
      formatPresetVersionInputSchema.safeParse({ aspectRatio: "4:3" }).success,
    ).toBe(false);
  });

  it("requires an aspect ratio, since a project cannot be created without one", () => {
    expect(formatPresetVersionInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("ideaBacklogSchema", () => {
  const ideaId = "11111111-1111-4111-8111-111111111111";

  it("accepts backlog organisation with an empty channel and format", () => {
    const parsed = ideaBacklogSchema.parse({
      ideaId,
      channelProfileId: "",
      formatPresetId: "",
      priority: 5,
    });
    expect(parsed.priority).toBe(5);
    expect(parsed.plannedReleaseAt).toBeNull();
  });

  it("parses a planned release date", () => {
    const parsed = ideaBacklogSchema.parse({
      ideaId,
      plannedReleaseAt: "2026-10-01T09:00:00.000Z",
    });
    expect(parsed.plannedReleaseAt?.toISOString()).toBe(
      "2026-10-01T09:00:00.000Z",
    );
  });

  it("rejects an unparseable release date and an out-of-range priority", () => {
    expect(
      ideaBacklogSchema.safeParse({ ideaId, plannedReleaseAt: "not-a-date" })
        .success,
    ).toBe(false);
    expect(ideaBacklogSchema.safeParse({ ideaId, priority: -1 }).success).toBe(
      false,
    );
  });
});

describe("createFormatPresetSlug", () => {
  it("produces a stable url-safe handle and never an empty one", () => {
    expect(createFormatPresetSlug("Weekly Long Form")).toBe("weekly-long-form");
    expect(createFormatPresetSlug("Café Économie")).toBe("cafe-economie");
    expect(createFormatPresetSlug("???")).toBe("format");
  });
});

describe("createProjectSchema format selection", () => {
  it("treats an empty format as no format rather than an error", () => {
    const parsed = createProjectSchema.parse({
      name: "Blank",
      aspectRatio: "16:9",
      framesPerSecond: 30,
      language: "en",
      maximumBudgetCents: 1000,
      formatPresetId: "",
    });
    expect(parsed.formatPresetId).toBeNull();
  });

  it("still creates a project when no format is supplied at all", () => {
    expect(
      createProjectSchema.safeParse({
        name: "Blank",
        aspectRatio: "16:9",
        framesPerSecond: 30,
        language: "en",
        maximumBudgetCents: 1000,
      }).success,
    ).toBe(true);
  });
});
