import { describe, expect, it } from "vitest";
import { storedResearchSnapshotSchema } from "@/lib/schemas/marketing-research";

const document = {
  summary: "A current summary",
  findings: [
    {
      statement: "A supported finding",
      sourceIndexes: [0],
      confidence: "high" as const,
    },
  ],
  opportunities: [],
  risks: [],
  contentAngles: [],
};

describe("storedResearchSnapshotSchema", () => {
  it("accepts findings backed by a supplied citation", () => {
    expect(
      storedResearchSnapshotSchema.safeParse({
        document,
        citations: [
          {
            title: "Source",
            url: "https://example.com/source",
            snippet: "Evidence",
            publishedAt: null,
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects citation indexes outside the supplied result set", () => {
    expect(
      storedResearchSnapshotSchema.safeParse({
        document: {
          ...document,
          findings: [{ ...document.findings[0], sourceIndexes: [1] }],
        },
        citations: [
          {
            title: "Source",
            url: "https://example.com/source",
            snippet: "Evidence",
            publishedAt: null,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
