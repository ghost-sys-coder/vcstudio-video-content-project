import { describe, expect, it } from "vitest";
import type { ReadinessItem, ReadinessStatus } from "./readiness";
import {
  summarizeReadiness,
  formatReadinessCheckedAt,
} from "./readiness-presentation";
function checks(...statuses: ReadinessStatus[]): ReadinessItem[] {
  return statuses.map((status, i) => ({
    id: String(i),
    label: "Check",
    status,
    detail: "Reported state",
    action: null,
  }));
}
describe("readiness presentation", () => {
  it("does not present an intentionally disabled service as a failure", () => {
    expect(summarizeReadiness(checks("ready", "disabled"))).toMatchObject({
      status: "ready",
      attention: 0,
      counts: { ready: 1, disabled: 1 },
    });
    expect(summarizeReadiness(checks("disabled"))).toMatchObject({
      status: "disabled",
      attention: 0,
    });
  });
  it("keeps unavailable checks separate from successful checks", () => {
    expect(summarizeReadiness([]).status).toBe("unknown");
    expect(summarizeReadiness(checks("ready", "unknown"))).toMatchObject({
      status: "unknown",
      counts: { unknown: 1 },
    });
  });
  it("gives a blocked check precedence over degraded or unknown checks", () => {
    expect(
      summarizeReadiness(
        checks("ready", "blocked", "degraded", "unknown", "disabled"),
      ),
    ).toMatchObject({ status: "blocked", attention: 2, total: 5 });
    expect(summarizeReadiness(checks("ready", "degraded"))).toMatchObject({
      status: "degraded",
      attention: 1,
    });
  });
  it("labels its timestamp independently of the server timezone", () => {
    expect(formatReadinessCheckedAt("2026-11-05T00:30:00+03:00")).toBe(
      "4 Nov 2026, 21:30 UTC",
    );
  });
});
