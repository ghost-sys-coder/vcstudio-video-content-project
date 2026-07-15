import type { ProjectScriptVersion } from "@/db/schema";

export function assertScriptVersionDeletable(input: {
  status: ProjectScriptVersion["status"];
  referenceCount: number;
}): void {
  if (input.status === "approved") throw new Error("SCRIPT_VERSION_APPROVED");
  if (input.referenceCount > 0) throw new Error("SCRIPT_VERSION_REFERENCED");
}
