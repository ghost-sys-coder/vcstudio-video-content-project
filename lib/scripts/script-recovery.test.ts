import { describe, expect, it } from "vitest";
import {
  createScriptRecoveryStore,
  clearScriptRecovery,
  SCRIPT_RECOVERY_TTL_MS,
} from "./script-recovery";

class MemoryStorage implements Storage {
  private rows = new Map<string, string>();
  get length() {
    return this.rows.size;
  }
  key(index: number) {
    return [...this.rows.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.rows.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.rows.set(key, value);
  }
  removeItem(key: string) {
    this.rows.delete(key);
  }
  clear() {
    this.rows.clear();
  }
}
const scope = {
  userId: "user",
  workspaceId: "workspace",
  projectId: "project",
  tabId: "tab",
};
describe("local script recovery", () => {
  it("isolates user, workspace, project and tab while retaining the base revision", () => {
    const storage = new MemoryStorage();
    const store = createScriptRecoveryStore(storage, scope);
    store.write({ content: "Private draft", revision: 7 });
    expect(createScriptRecoveryStore(storage, scope).read()).toMatchObject({
      content: "Private draft",
      revision: 7,
    });
    for (const key of Object.keys(scope) as (keyof typeof scope)[])
      expect(
        createScriptRecoveryStore(storage, { ...scope, [key]: "other" }).read(),
      ).toBeNull();
  });
  it("expires drafts after seven days and bounds retention to twenty entries", () => {
    const storage = new MemoryStorage();
    let now = 1000;
    for (let i = 0; i < 25; i++) {
      now++;
      createScriptRecoveryStore(
        storage,
        { ...scope, projectId: String(i) },
        () => now,
      ).write({ content: "Draft", revision: 1 });
    }
    expect(storage.length).toBe(20);
    now += SCRIPT_RECOVERY_TTL_MS + 1;
    expect(
      createScriptRecoveryStore(storage, scope, () => now).read(),
    ).toBeNull();
    expect(storage.length).toBe(0);
  });
  it("clears only script recovery on sign-out and reports unavailable storage", () => {
    const storage = new MemoryStorage();
    storage.setItem("unrelated", "keep");
    const store = createScriptRecoveryStore(storage, scope);
    store.write({ content: "Draft", revision: 1 });
    clearScriptRecovery(storage);
    expect(storage.length).toBe(1);
    expect(store.read()).toBeNull();
    storage.setItem = () => {
      throw new Error("quota");
    };
    expect(store.write({ content: "Draft", revision: 1 })).toBe(false);
  });
});
