import { describe, expect, it } from "vitest";

import {
  MAX_DAILY_GENERATED_ITEMS,
  SELECTABLE_AUTONOMY_LEVELS,
  marketingSettingsFormSchema,
  marketingSettingsSchema,
} from "@/lib/schemas/marketing-settings";

function form(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    autonomyLevel: "manual",
    requireApprovalBeforePublish: "on",
    defaultTimezone: "Africa/Nairobi",
    defaultLanguage: "English",
    brandedDefault: "on",
    monthlyMarketingBudgetCents: "5000",
    dailyMaxGeneratedItems: "10",
    researchRefreshDays: "7",
    ...overrides,
  };
}

describe("marketingSettingsSchema", () => {
  it("does not offer autonomous until its enforcement exists", () => {
    // The column accepts it; the form must not, or the setting would claim more
    // than the system does.
    expect(SELECTABLE_AUTONOMY_LEVELS).toEqual(["manual", "assisted"]);
    expect(
      marketingSettingsSchema.safeParse({
        ...form(),
        autonomyLevel: "autonomous",
        requireApprovalBeforePublish: true,
        brandedDefault: true,
        monthlyMarketingBudgetCents: 1,
        dailyMaxGeneratedItems: 1,
        researchRefreshDays: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects a daily item cap above the ceiling", () => {
    const parsed = marketingSettingsFormSchema.safeParse(
      form({ dailyMaxGeneratedItems: String(MAX_DAILY_GENERATED_ITEMS + 1) }),
    );
    expect(parsed.success).toBe(false);
  });

  it("rejects a zero daily item cap", () => {
    expect(
      marketingSettingsFormSchema.safeParse(
        form({ dailyMaxGeneratedItems: "0" }),
      ).success,
    ).toBe(false);
  });
});

describe("marketingSettingsFormSchema", () => {
  it("reads an unticked checkbox as false rather than missing", () => {
    // FormData omits an unchecked box entirely; without the preprocess step a
    // user turning approval off would submit an invalid form instead.
    const parsed = marketingSettingsFormSchema.safeParse(
      form({ requireApprovalBeforePublish: "", brandedDefault: "" }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.requireApprovalBeforePublish).toBe(false);
      expect(parsed.data.brandedDefault).toBe(false);
    }
  });

  it("treats an empty budget as no ceiling, not as zero", () => {
    const parsed = marketingSettingsFormSchema.safeParse(
      form({ monthlyMarketingBudgetCents: "" }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success)
      expect(parsed.data.monthlyMarketingBudgetCents).toBeNull();
  });

  it("keeps a zero budget as a real ceiling of zero", () => {
    const parsed = marketingSettingsFormSchema.safeParse(
      form({ monthlyMarketingBudgetCents: "0" }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.monthlyMarketingBudgetCents).toBe(0);
  });

  it("trims a padded time zone", () => {
    const parsed = marketingSettingsFormSchema.safeParse(
      form({ defaultTimezone: "  UTC  " }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.defaultTimezone).toBe("UTC");
  });
});
