import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ trigger: vi.fn(), attach: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: m.trigger } }));
vi.mock("@/db/commands/scene-audio-commands", () => ({
  attachSceneAudioTriggerRun: m.attach,
}));
import { dispatchSceneAudioGeneration } from "./dispatch-scene-audio-generation";
const input = {
  workspaceId: "workspace",
  projectId: "project",
  generationId: "generation",
  idempotencyKey: "same-request",
};
beforeEach(() => {
  vi.resetAllMocks();
  m.trigger.mockResolvedValue({ id: "run_one" });
});
describe("MCP scene-audio handoff", () => {
  it("records the worker run for the exact generation and request key", async () => {
    expect(await dispatchSceneAudioGeneration(input)).toBe(true);
    expect(m.trigger).toHaveBeenCalledWith(
      "scene-audio-generation",
      {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        generationId: input.generationId,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    expect(m.attach).toHaveBeenCalledWith({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      generationId: input.generationId,
      triggerRunId: "run_one",
    });
  });
  it("keeps the request key stable when a handoff response is ambiguous", async () => {
    m.trigger.mockRejectedValueOnce(new Error("interrupted"));
    expect(await dispatchSceneAudioGeneration(input)).toBe(false);
    expect(await dispatchSceneAudioGeneration(input)).toBe(true);
    expect(m.trigger.mock.calls[0]).toEqual(m.trigger.mock.calls[1]);
  });
  it("does not pretend a lost run attachment was confirmed", async () => {
    m.attach.mockRejectedValue(new Error("database unavailable"));
    expect(await dispatchSceneAudioGeneration(input)).toBe(false);
  });
});
