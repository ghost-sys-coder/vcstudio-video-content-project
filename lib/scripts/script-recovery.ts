import { z } from "zod";
import type { ScriptDraftSnapshot } from "./script-draft-contract";

const PREFIX = "vcstudio:script-recovery:";
export const SCRIPT_RECOVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const recordSchema = z.object({
  content: z.string().max(500_000),
  revision: z.number().int().nonnegative(),
  savedAt: z.number().finite(),
});
export type ScriptRecoveryRecord = z.infer<typeof recordSchema>;
export interface ScriptRecoveryStore {
  read(): ScriptRecoveryRecord | null;
  write(draft: ScriptDraftSnapshot): boolean;
  clear(): void;
}

/** Tab-specific keys prevent two editors from overwriting each other's recovery copy. */
export function createScriptRecoveryStore(
  storage: Storage,
  scope: {
    userId: string;
    workspaceId: string;
    projectId: string;
    tabId: string;
  },
  now = Date.now,
): ScriptRecoveryStore {
  const key =
    PREFIX +
    [scope.userId, scope.workspaceId, scope.projectId, scope.tabId]
      .map(encodeURIComponent)
      .join(":");
  function prune() {
    const records: { key: string; savedAt: number }[] = [];
    for (let index = 0; index < storage.length; index++) {
      const candidate = storage.key(index);
      if (!candidate?.startsWith(PREFIX)) continue;
      try {
        const parsed = recordSchema.safeParse(
          JSON.parse(storage.getItem(candidate) ?? "null"),
        );
        records.push({
          key: candidate,
          savedAt: parsed.success ? parsed.data.savedAt : 0,
        });
      } catch {
        records.push({ key: candidate, savedAt: 0 });
      }
    }
    records.sort((a, b) => b.savedAt - a.savedAt);
    records.forEach((record, index) => {
      if (
        index >= 20 ||
        now() - record.savedAt > SCRIPT_RECOVERY_TTL_MS ||
        record.savedAt > now()
      )
        storage.removeItem(record.key);
    });
  }
  return {
    read() {
      try {
        prune();
        const parsed = recordSchema.safeParse(
          JSON.parse(storage.getItem(key) ?? "null"),
        );
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    write(draft) {
      try {
        storage.setItem(
          key,
          JSON.stringify(recordSchema.parse({ ...draft, savedAt: now() })),
        );
        prune();
        return storage.getItem(key) !== null;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        storage.removeItem(key);
      } catch {
        /* Storage may be disabled. */
      }
    },
  };
}

export function clearScriptRecovery(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (key?.startsWith(PREFIX)) storage.removeItem(key);
  }
}
