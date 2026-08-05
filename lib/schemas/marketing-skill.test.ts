import { describe, expect, it } from "vitest";
import {
  DELEGATABLE_MARKETING_SKILL_KEYS,
  marketingSkillInputFieldsSchema,
  marketingSkillMutationSchema,
  marketingSkillSlugSchema,
} from "@/lib/schemas/marketing-skill";
import { MARKETING_SKILL_KEYS } from "@/lib/marketing/skills/skill-key";

const field = {
  key: "topic",
  label: "Topic",
  type: "text" as const,
  required: true,
  defaultValue: "A practical website conversion lesson",
};

function skill(overrides: Record<string, unknown> = {}) {
  return {
    slug: "conversion-lesson",
    name: "Conversion lesson",
    description: "Write one practical website conversion lesson.",
    instructions:
      "Teach one concrete improvement and close with a restrained invitation.",
    baseSkillKey: "create_social_post",
    inputFields: [field],
    defaultPlatform: "linkedin",
    isEnabled: true,
    ...overrides,
  };
}

describe("marketing skill validation", () => {
  it.each(MARKETING_SKILL_KEYS)("rejects the built-in slug %s", (slug) => {
    expect(marketingSkillSlugSchema.safeParse(slug).success).toBe(false);
  });

  it("rejects a base executor outside the allow-list", () => {
    expect(
      marketingSkillMutationSchema.safeParse(
        skill({ baseSkillKey: "create_social_graphic" }),
      ).success,
    ).toBe(false);
    expect(DELEGATABLE_MARKETING_SKILL_KEYS).not.toContain(
      "create_social_graphic",
    );
  });

  it("rejects more than ten fields", () => {
    expect(
      marketingSkillInputFieldsSchema.safeParse(
        Array.from({ length: 11 }, (_, index) => ({
          ...field,
          key: `field${index}`,
        })),
      ).success,
    ).toBe(false);
  });

  it("rejects duplicate field keys", () => {
    expect(
      marketingSkillInputFieldsSchema.safeParse([field, field]).success,
    ).toBe(false);
  });

  it("strips unsafe control characters from instructions", () => {
    const parsed = marketingSkillMutationSchema.parse(
      skill({
        instructions:
          "Teach one concrete improvement.\u0000 Close with an invitation.",
      }),
    );
    expect(parsed.instructions).toBe(
      "Teach one concrete improvement. Close with an invitation.",
    );
  });
});
