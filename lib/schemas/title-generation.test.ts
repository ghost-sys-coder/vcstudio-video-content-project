import { describe, expect, it } from "vitest";
import { titleGenerationOutputSchema } from "@/lib/schemas/title-generation";

const validOutput = {
  titles: [
    {
      text: "The Debt Rule Wealthy People Understand",
      rationale: "Creates a defensible curiosity gap.",
      hookType: "curiosity-gap",
    },
  ],
  description:
    "Learn how productive debt differs from consumer debt and what to review before borrowing.",
  tags: ["productive debt", "personal finance", "wealth building"],
};

describe("publishing metadata output", () => {
  it("accepts complete editable platform metadata", () => {
    expect(titleGenerationOutputSchema.parse(validOutput)).toEqual(validOutput);
  });

  it("rejects missing descriptions and excessive tags", () => {
    expect(
      titleGenerationOutputSchema.safeParse({ ...validOutput, description: "" })
        .success,
    ).toBe(false);
    expect(
      titleGenerationOutputSchema.safeParse({
        ...validOutput,
        tags: Array.from({ length: 16 }, (_, index) => `tag ${index}`),
      }).success,
    ).toBe(false);
  });
});
