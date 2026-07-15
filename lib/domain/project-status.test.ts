import { describe, expect, it } from "vitest";
import { canTransitionProjectStatus } from "@/lib/domain/project-status";

describe("project status transitions", () => {
  it("allows configured forward and recovery transitions", () => {
    expect(canTransitionProjectStatus("draft", "planning")).toBe(true);
    expect(canTransitionProjectStatus("failed", "draft")).toBe(true);
  });

  it("rejects invalid and archived transitions", () => {
    expect(canTransitionProjectStatus("draft", "rendering")).toBe(false);
    expect(canTransitionProjectStatus("archived", "draft")).toBe(false);
  });
});
