import { afterEach, describe, expect, it, vi } from "vitest";
import { ScriptDraftController } from "./script-draft-controller";
import type { ScriptDraftResult } from "./script-draft-contract";
import type { ScriptRecoveryRecord } from "./script-recovery";

function setup(canEdit = true, recovery: ScriptRecoveryRecord | null = null) {
  const persist = vi
    .fn<
      (input: {
        content: string;
        revision: number;
        approve: boolean;
      }) => Promise<ScriptDraftResult>
    >()
    .mockImplementation(async (input) => ({
      status: "saved",
      draft: { content: input.content, revision: input.revision + 1 },
      ...(input.approve ? { approvedVersionId: "approved" } : {}),
    }));
  const store = {
    read: () => recovery,
    write: vi.fn(() => true),
    clear: vi.fn(),
  };
  const approved = vi.fn();
  const controller = new ScriptDraftController({
    initial: { content: "Original", revision: 1 },
    maximumCharacters: 1000,
    canEdit,
    persist,
    approved,
  });
  controller.start(store);
  return { controller, persist, store, approved };
}
afterEach(() => {
  vi.useRealTimers();
});
describe("script autosave controller", () => {
  it("ends a stalled confirmation and retains the recovery copy", async () => {
    vi.useFakeTimers();
    const { controller, persist, store } = setup();
    persist.mockImplementationOnce(() => new Promise(() => {}));
    controller.edit("Keep writing");
    const saving = controller.save();
    await vi.advanceTimersByTimeAsync(15_000);
    await saving;
    expect(controller.getSnapshot()).toMatchObject({
      status: "error",
      saving: false,
      content: "Keep writing",
    });
    expect(store.write).toHaveBeenLastCalledWith({
      content: "Keep writing",
      revision: 1,
    });
    controller.stop();
  });
  it("retains a revert typed during an ambiguously failed save and permits retry", async () => {
    const { controller, persist, store } = setup();
    let reject: (error: Error) => void = () => {};
    persist.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    controller.edit("Submitted");
    const saving = controller.save();
    controller.edit("Original");
    expect(store.write).toHaveBeenLastCalledWith({
      content: "Original",
      revision: 1,
    });
    reject(new Error("lost response"));
    await saving;
    await controller.save();
    expect(persist).toHaveBeenCalledTimes(2);
    controller.stop();
  });
  it("debounces typing and persists local recovery immediately", async () => {
    vi.useFakeTimers();
    const { controller, persist, store } = setup();
    controller.edit("A");
    controller.edit("AB");
    expect(store.write).toHaveBeenLastCalledWith({
      content: "AB",
      revision: 1,
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(persist).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      content: "AB",
      revision: 2,
      status: "saved",
    });
    controller.stop();
  });
  it("does not replace newer typing with an old save response", async () => {
    const { controller, persist } = setup();
    let finish: (result: ScriptDraftResult) => void = () => {};
    persist.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    controller.edit("First");
    const saving = controller.save();
    controller.edit("Newer");
    finish({ status: "saved", draft: { content: "First", revision: 2 } });
    await saving;
    expect(controller.getSnapshot()).toMatchObject({
      content: "Newer",
      savedContent: "First",
      revision: 2,
      status: "unsaved",
    });
    await controller.save();
    expect(persist).toHaveBeenLastCalledWith({
      content: "Newer",
      revision: 2,
      approve: false,
    });
    controller.stop();
  });
  it("waits for an in-flight autosave then approves the latest text exactly once", async () => {
    const { controller, persist, approved } = setup();
    let finish: (result: ScriptDraftResult) => void = () => {};
    persist.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    controller.edit("First");
    const saving = controller.save();
    controller.edit("Final");
    const approving = controller.save(true);
    void controller.save(true);
    controller.edit("Too late");
    finish({ status: "saved", draft: { content: "First", revision: 2 } });
    await saving;
    await approving;
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenLastCalledWith({
      content: "Final",
      revision: 2,
      approve: true,
    });
    expect(approved).toHaveBeenCalledOnce();
    controller.stop();
  });
  it("retains text on network loss and retries explicitly", async () => {
    const { controller, persist } = setup();
    persist.mockRejectedValueOnce(new Error("offline"));
    controller.edit("Keep me");
    await controller.save();
    expect(controller.getSnapshot()).toMatchObject({
      content: "Keep me",
      status: "error",
    });
    await controller.save();
    expect(controller.getSnapshot().status).toBe("saved");
    controller.stop();
  });
  it("blocks conflicting saves until the user chooses a revision", async () => {
    const { controller, persist } = setup();
    persist.mockResolvedValueOnce({
      status: "conflict",
      draft: { content: "Other tab", revision: 5 },
    });
    controller.edit("Mine");
    await controller.save();
    await controller.save(true);
    expect(persist).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().content).toBe("Mine");
    controller.keepLocalOverRemote();
    await controller.save();
    expect(persist).toHaveBeenLastCalledWith({
      content: "Mine",
      revision: 5,
      approve: false,
    });
    controller.stop();
  });
  it("offers recovery before writing and exposes a changed server revision", async () => {
    const { controller, persist } = setup(true, {
      content: "Recovered",
      revision: 0,
      savedAt: Date.now(),
    });
    controller.edit("Blocked");
    await controller.save();
    expect(persist).not.toHaveBeenCalled();
    controller.recover();
    expect(controller.getSnapshot()).toMatchObject({
      content: "Recovered",
      status: "conflict",
      remote: { content: "Original", revision: 1 },
    });
    controller.discard();
    expect(controller.getSnapshot().content).toBe("Original");
    controller.stop();
  });
  it("stages generated text without replacing unsaved writing", () => {
    const { controller } = setup();
    controller.edit("My writing");
    controller.offerGenerated("Generated");
    expect(controller.getSnapshot().content).toBe("My writing");
    controller.dismissGenerated();
    expect(controller.getSnapshot().content).toBe("My writing");
    controller.offerGenerated("Generated");
    controller.acceptGenerated();
    expect(controller.getSnapshot().content).toBe("Generated");
    controller.stop();
  });
  it("prevents viewer writes and stops timers after sign-out/unmount", async () => {
    vi.useFakeTimers();
    const viewer = setup(false);
    viewer.controller.edit("No");
    await viewer.controller.save(true);
    expect(viewer.persist).not.toHaveBeenCalled();
    const editor = setup();
    editor.controller.edit("Pending");
    editor.controller.stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(editor.persist).not.toHaveBeenCalled();
  });
});
