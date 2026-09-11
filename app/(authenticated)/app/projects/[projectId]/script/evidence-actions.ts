"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  findProject,
  findProjectScriptDraft,
} from "@/db/repositories/projects.repository";
import { listScriptClaims } from "@/db/repositories/editorial-evidence.repository";
import {
  archiveProjectSource,
  citeSourceForClaim,
  createProjectSource,
  createScriptClaim,
  deleteScriptClaim,
  recordEditorialSignoff,
  removeClaimCitation,
  reviewScriptClaim,
} from "@/db/commands/editorial-evidence-commands";
import { normalizeNarrationText } from "@/lib/domain/narration-normalization";
import {
  MAX_CLAIM_NOTE_LENGTH,
  MAX_CLAIM_QUOTE_LENGTH,
  MAX_SOURCE_NOTE_LENGTH,
  MAX_SOURCE_TITLE_LENGTH,
  normalizeSourceUrl,
  sanitizeSourceText,
} from "@/lib/editorial/source-input";
import {
  addClaimInputSchema,
  addSourceInputSchema,
  archiveSourceInputSchema,
  citeSourceInputSchema,
  deleteClaimInputSchema,
  removeCitationInputSchema,
  reviewClaimInputSchema,
  signoffInputSchema,
} from "@/lib/schemas/editorial-evidence";

export type EditorialActionResult =
  { status: "ok" } | { status: "error"; message: string };

const INVALID: EditorialActionResult = {
  status: "error",
  message: "That request was not valid.",
};

/**
 * Resolves the caller and confirms they may edit this project.
 *
 * Authorization is resolved from the session and the database, never from the
 * submitted payload: the browser supplies only a project id, and the workspace
 * comes from the authenticated membership.
 */
async function authorize(projectId: string) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  requireCapability(context.activeMembership.role, "mutateWorkspaceData");
  const scope = {
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  };
  const project = await findProject(scope);
  if (!project || project.status === "archived") return null;
  return { scope, userId: context.user.id };
}

function refreshScript(projectId: string) {
  revalidatePath(`/app/projects/${projectId}/script`);
}

export async function addProjectSourceAction(
  value: unknown,
): Promise<EditorialActionResult> {
  const parsed = addSourceInputSchema.safeParse(value);
  if (!parsed.success) return INVALID;
  const input = parsed.data;
  let url: string | null = null;
  let host: string | null = null;
  if (input.kind === "link") {
    const link = normalizeSourceUrl(input.url);
    if (!link.ok) return { status: "error", message: link.message };
    url = link.url;
    host = link.host;
  }
  const title = sanitizeSourceText(input.title, MAX_SOURCE_TITLE_LENGTH);
  if (title.length === 0)
    return { status: "error", message: "Give this source a title." };
  try {
    const authorized = await authorize(input.projectId);
    if (!authorized)
      return { status: "error", message: "This project is unavailable." };
    await createProjectSource({
      ...authorized.scope,
      userId: authorized.userId,
      kind: input.kind,
      title,
      url,
      host,
      notes: sanitizeSourceText(input.notes, MAX_SOURCE_NOTE_LENGTH),
    });
    refreshScript(input.projectId);
    return { status: "ok" };
  } catch {
    return { status: "error", message: "The source could not be saved." };
  }
}

export async function archiveProjectSourceAction(
  value: unknown,
): Promise<EditorialActionResult> {
  const parsed = archiveSourceInputSchema.safeParse(value);
  if (!parsed.success) return INVALID;
  try {
    const authorized = await authorize(parsed.data.projectId);
    if (!authorized)
      return { status: "error", message: "This project is unavailable." };
    const archived = await archiveProjectSource({
      ...authorized.scope,
      sourceId: parsed.data.sourceId,
    });
    if (!archived)
      return { status: "error", message: "That source no longer exists." };
    refreshScript(parsed.data.projectId);
    return { status: "ok" };
  } catch {
    return { status: "error", message: "The source could not be archived." };
  }
}

export async function addScriptClaimAction(
  value: unknown,
): Promise<EditorialActionResult> {
  const parsed = addClaimInputSchema.safeParse(value);
  if (!parsed.success) return INVALID;
  const quotedText = sanitizeSourceText(
    parsed.data.quotedText,
    MAX_CLAIM_QUOTE_LENGTH,
  );
  if (quotedText.length === 0)
    return { status: "error", message: "Select the sentence to review." };
  try {
    const authorized = await authorize(parsed.data.projectId);
    if (!authorized)
      return { status: "error", message: "This project is unavailable." };
    await createScriptClaim({
      ...authorized.scope,
      userId: authorized.userId,
      quotedText,
    });
    refreshScript(parsed.data.projectId);
    return { status: "ok" };
  } catch {
    return { status: "error", message: "The claim could not be added." };
  }
}

export async function reviewScriptClaimAction(
  value: unknown,
): Promise<EditorialActionResult> {
  const parsed = reviewClaimInputSchema.safeParse(value);
  if (!parsed.success) return INVALID;
  const input = parsed.data;
  try {
    const authorized = await authorize(input.projectId);
    if (!authorized)
      return { status: "error", message: "This project is unavailable." };
    const updated = await reviewScriptClaim({
      ...authorized.scope,
      claimId: input.claimId,
      userId: authorized.userId,
      reviewState: input.reviewState,
      reviewNote: sanitizeSourceText(input.reviewNote, MAX_CLAIM_NOTE_LENGTH),
    });
    if (!updated)
      return { status: "error", message: "That claim no longer exists." };
    refreshScript(input.projectId);
    return { status: "ok" };
  } catch {
    return { status: "error", message: "The verdict could not be saved." };
  }
}

export async function deleteScriptClaimAction(
  value: unknown,
): Promise<EditorialActionResult> {
  const parsed = deleteClaimInputSchema.safeParse(value);
  if (!parsed.success) return INVALID;
  try {
    const authorized = await authorize(parsed.data.projectId);
    if (!authorized)
      return { status: "error", message: "This project is unavailable." };
    await deleteScriptClaim({
      ...authorized.scope,
      claimId: parsed.data.claimId,
    });
    refreshScript(parsed.data.projectId);
    return { status: "ok" };
  } catch {
    return { status: "error", message: "The claim could not be removed." };
  }
}

export async function citeSourceForClaimAction(
  value: unknown,
): Promise<EditorialActionResult> {
  const parsed = citeSourceInputSchema.safeParse(value);
  if (!parsed.success) return INVALID;
  const input = parsed.data;
  try {
    const authorized = await authorize(input.projectId);
    if (!authorized)
      return { status: "error", message: "This project is unavailable." };
    const cited = await citeSourceForClaim({
      ...authorized.scope,
      claimId: input.claimId,
      sourceId: input.sourceId,
      userId: authorized.userId,
      stance: input.stance,
      excerpt: sanitizeSourceText(input.excerpt, MAX_SOURCE_NOTE_LENGTH),
    });
    if (!cited)
      return {
        status: "error",
        message: "That claim or source is no longer available.",
      };
    refreshScript(input.projectId);
    return { status: "ok" };
  } catch {
    return { status: "error", message: "The citation could not be saved." };
  }
}

export async function removeClaimCitationAction(
  value: unknown,
): Promise<EditorialActionResult> {
  const parsed = removeCitationInputSchema.safeParse(value);
  if (!parsed.success) return INVALID;
  try {
    const authorized = await authorize(parsed.data.projectId);
    if (!authorized)
      return { status: "error", message: "This project is unavailable." };
    await removeClaimCitation({
      workspaceId: authorized.scope.workspaceId,
      claimId: parsed.data.claimId,
      sourceId: parsed.data.sourceId,
    });
    refreshScript(parsed.data.projectId);
    return { status: "ok" };
  } catch {
    return { status: "error", message: "The citation could not be removed." };
  }
}

/**
 * Records a sign-off on the review as the reviewer saw it.
 *
 * The fingerprint they were shown is compared against the saved draft, and a
 * mismatch is refused rather than reconciled. Recording a sign-off against text
 * the reviewer never read is exactly the failure this slice exists to prevent,
 * and the draft autosaves every second, so the race is real rather than
 * theoretical. Unsaved typing does not block it: the comparison is against what
 * has been saved, which is what the next reader will load.
 */
export async function signOffEditorialReviewAction(
  value: unknown,
): Promise<EditorialActionResult> {
  const parsed = signoffInputSchema.safeParse(value);
  if (!parsed.success) return INVALID;
  const input = parsed.data;
  try {
    const authorized = await authorize(input.projectId);
    if (!authorized)
      return { status: "error", message: "This project is unavailable." };
    const draft = await findProjectScriptDraft(authorized.scope);
    if (!draft)
      return { status: "error", message: "This project has no script yet." };
    if (normalizeNarrationText(draft.content) !== input.scriptFingerprint)
      return {
        status: "error",
        message:
          "The script changed while you were reviewing. Reload, check the claims again, then sign off.",
      };
    const claims = await listScriptClaims(authorized.scope);
    await recordEditorialSignoff({
      ...authorized.scope,
      userId: authorized.userId,
      scriptFingerprint: input.scriptFingerprint,
      coveredClaims: claims.map((claim) => ({
        id: claim.id,
        reviewState: claim.reviewState,
      })),
      note: sanitizeSourceText(input.note, MAX_CLAIM_NOTE_LENGTH),
    });
    refreshScript(input.projectId);
    return { status: "ok" };
  } catch {
    return { status: "error", message: "The sign-off could not be recorded." };
  }
}
