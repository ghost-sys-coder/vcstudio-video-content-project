import { NextResponse } from "next/server";
import {
  markDocumentFailed,
  markDocumentReady,
} from "@/db/commands/marketing-document-commands";
import { findKnowledgeDocument } from "@/db/repositories/marketing-documents.repository";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { getMarketingEnvironment } from "@/lib/env/server";
import { extractDocumentText } from "@/lib/marketing/documents/extract-text";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { completeDocumentUploadSchema } from "@/lib/schemas/marketing-document";
import { readDocumentObject } from "@/lib/storage/marketing-document-storage";
import { isMarketingDocumentObjectKey } from "@/lib/storage/object-key";

/**
 * Step three: confirm, then extract.
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
    const stored = await readDocumentObject({
      objectKey: document.objectKey,
      maxBytes: environment.MARKETING_MAX_DOCUMENT_BYTES,
    });
    const extracted = extractDocumentText({
      bytes: stored.bytes,
      contentType: parsed.data.contentType,
    });

    if (extracted.characterCount === 0) {
      await markDocumentFailed({
        workspaceId,
        documentId: document.id,
        category: "empty_document",
        message: "That file contained no readable text.",
      });
      return NextResponse.json(
        { error: "That file contained no readable text." },
        { status: 400 },
      );
    }

    await markDocumentReady({
      workspaceId,
      documentId: document.id,
      sizeBytes: stored.sizeBytes,
      extracted,
    });

    return NextResponse.json({
      documentId: document.id,
      characterCount: extracted.characterCount,
      tokenEstimate: extracted.tokenEstimate,
    });
  } catch {
    await markDocumentFailed({
      workspaceId,
      documentId: document.id,
      category: "extraction_failed",
      message: "That document could not be read. Try uploading it again.",
    });
    return NextResponse.json(
      { error: "That document could not be read." },
      { status: 422 },
    );
  }
}
