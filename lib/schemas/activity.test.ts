import { describe, expect, it } from "vitest";
import {
  acknowledgeActivitySchema,
  activityFilterSchema,
} from "@/lib/schemas/activity";

describe("activity schemas", () => {
  it("parses bounded filters", () => {
    expect(activityFilterSchema.parse({ state: "unread", page: "2" })).toEqual({
      state: "unread",
      page: 2,
    });
    expect(activityFilterSchema.safeParse({ page: "0" }).success).toBe(false);
  });

  it("accepts only a known source and UUID activity key", () => {
    expect(
      acknowledgeActivitySchema.safeParse({
        workspaceId: "69a9a87d-9785-4d4d-bc59-caf893287402",
        activityKey: "render:64e527f2-2c6b-43b4-84b7-bba3ef98be1a",
      }).success,
    ).toBe(true);
    expect(
      acknowledgeActivitySchema.safeParse({
        workspaceId: "69a9a87d-9785-4d4d-bc59-caf893287402",
        activityKey: "project:64e527f2-2c6b-43b4-84b7-bba3ef98be1a",
      }).success,
    ).toBe(false);
  });
});
