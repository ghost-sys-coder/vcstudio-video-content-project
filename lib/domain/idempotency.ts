import { createHmac } from "node:crypto";

function hash(secret: string, parts: string[]): string {
  return createHmac("sha256", secret)
    .update(parts.join("\u001f"))
    .digest("hex");
}

export function createSceneAnalysisIdempotencyKey(input: {
  secret: string;
  workspaceId: string;
  projectId: string;
  scriptVersionId: string;
  model: string;
  promptVersion: string;
}): string {
  return hash(input.secret, [
    input.workspaceId,
    input.projectId,
    input.scriptVersionId,
    "scene-analysis",
    input.model,
    input.promptVersion,
  ]);
}

export function createRequestFingerprint(
  secret: string,
  prompt: string,
): string {
  return hash(secret, [prompt]);
}
