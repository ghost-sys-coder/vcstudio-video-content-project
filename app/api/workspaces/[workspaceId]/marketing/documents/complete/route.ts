import { NextResponse } from "next/server";
import { findKnowledgeDocument } from "@/db/repositories/marketing-documents.repository";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { getMarketingEnvironment } from "@/lib/env/server";
import { startDocumentExtraction } from "@/lib/marketing/documents/start-document-extraction";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { completeDocumentUploadSchema } from "@/lib/schemas/marketing-document";
import { isMarketingDocumentObjectKey } from "@/lib/storage/object-key";

/**
 * Step three: confirm, then enqueue extraction.
 *
 * Truth is re-derived from storage rather than trusted from the browser — the
 * real byte length comes from a HEAD, and the text comes from the stored bytes.
 * The object key is re-derived and compared, so a completion cannot be pointed
 * at somebody else's object.
 *
 * Extraction is inline because `.txt` and `.md` cost nothing to parse. PDF and
 * DOCX will move this to a Trigger task, which is exactly why the extraction
 * itself is a pure function taking bytes.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const environment = getMarketingEnvironment();
  if (!environment.ENABLE_MARKETING_STUDIO)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Deliberately NOT gated on the per-workspace switch, unlike the upload route
  // that precedes it. The bytes are already in R2 by the time this runs; if the
  // studio were switched off mid-upload, refusing here would strand the object
  // with its row stuck `pending` forever. Completion finishes work already
  // authorised and spends nothing — the gate that matters is the one on the
  // endpoint that hands out the writable URL.

  let workspaceId: string;
  try {
    const user = await requireAuthenticatedUser();
    ({ workspaceId } = await context.params);
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId,
    });
    requireCapability(membership.role, "manageBrandProfile");
  } catch {
    return NextResponse.json(
      { error: "You cannot add documents to this workspace." },
      { status: 403 },
    );
  }

  const parsed = completeDocumentUploadSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const document = await findKnowledgeDocument({
    workspaceId,
    documentId: parsed.data.documentId,
  });
  if (!document || !document.objectKey)
    return NextResponse.json(
      { error: "That document no longer exists." },
      { status: 404 },
    );

  if (
    !isMarketingDocumentObjectKey({
      workspaceId,
      documentId: document.id,
      contentType: parsed.data.contentType,
      objectKey: document.objectKey,
    })
  )
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await startDocumentExtraction({ workspaceId, documentId: document.id });
    return NextResponse.json(
      { documentId: document.id, status: "pending" },
      { status: 202 },
    );
  } catch {
    return NextResponse.json(
      { error: "That document could not be queued for processing." },
      { status: 503 },
    );
  }
}
