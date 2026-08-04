import { describe, expect, it } from "vitest";

import {
  marketingStudioAccessSchema,
  readMarketingStudioAccessForm,
} from "@/lib/schemas/marketing-settings";

function form(value: string | null): FormData {
  const data = new FormData();
  if (value !== null) data.set("enabled", value);
  return data;
}

describe("readMarketingStudioAccessForm", () => {
  it('reads "true" as on', () => {
    expect(readMarketingStudioAccessForm(form("true"))).toEqual({
      enabled: true,
    });
  });

  it('reads "false" as off', () => {
    expect(readMarketingStudioAccessForm(form("false"))).toEqual({
      enabled: false,
    });
  });

  it("treats a missing field as off", () => {
    // The toggle posts a literal target state. Anything else is a malformed
    // request, and defaulting a spend-enabling switch to on would be the wrong
    // way to fail.
    expect(readMarketingStudioAccessForm(form(null))).toEqual({
      enabled: false,
    });
  });

  it("treats an unrecognised value as off", () => {
    expect(readMarketingStudioAccessForm(form("on"))).toEqual({
      enabled: false,
    });
  });
});

describe("marketingStudioAccessSchema", () => {
  it("accepts the normalised form output", () => {
    expect(
      marketingStudioAccessSchema.parse(
        readMarketingStudioAccessForm(form("true")),
      ),
    ).toEqual({ enabled: true });
  });

  it("rejects a raw string that skipped the reader", () => {
    expect(
      marketingStudioAccessSchema.safeParse({ enabled: "true" }).success,
    ).toBe(false);
  });
});
