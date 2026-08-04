import { NextResponse } from "next/server";
import { createPendingDocument } from "@/db/commands/marketing-document-commands";
import { countKnowledgeDocuments } from "@/db/repositories/marketing-documents.repository";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { getMarketingEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { requestDocumentUploadSchema } from "@/lib/schemas/marketing-document";
import { createDocumentUploadUrl } from "@/lib/storage/marketing-document-storage";
import { createMarketingDocumentObjectKey } from "@/lib/storage/object-key";

/**
 * Step one of a knowledge-document upload: authorize.
 *
 * Reserves the row first so the object key derives from a server-generated UUID
 * rather than anything the browser sent, then returns a signed PUT bound to the
 * exact content type and byte length that were approved.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const environment = getMarketingEnvironment();
  if (!environment.ENABLE_MARKETING_STUDIO)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  let user;
  let workspaceId: string;
  try {
    user = await requireAuthenticatedUser();
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

  const parsed = requestDocumentUploadSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Unsupported file." },
      { status: 400 },
    );

  if (parsed.data.sizeBytes > environment.MARKETING_MAX_DOCUMENT_BYTES)
    return NextResponse.json(
      { error: "That document is too large." },
      { status: 400 },
    );

  const existing = await countKnowledgeDocuments({ workspaceId });
  if (existing >= environment.MARKETING_MAX_DOCUMENTS)
    return NextResponse.json(
      {
        error: `This workspace already holds the maximum of ${environment.MARKETING_MAX_DOCUMENTS} documents.`,
      },
      { status: 400 },
    );

  const documentId = crypto.randomUUID();
  const objectKey = createMarketingDocumentObjectKey({
    workspaceId,
    documentId,
    contentType: parsed.data.contentType,
  });

  try {
    await createPendingDocument({
      id: documentId,
      workspaceId,
      title: parsed.data.title,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
      originalFileName: parsed.data.fileName,
      objectKey,
      createdByUserId: user.id,
    });
    const uploadUrl = await createDocumentUploadUrl({
      objectKey,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
    });
    return NextResponse.json({ documentId, objectKey, uploadUrl });
  } catch {
    return NextResponse.json(
      { error: "Document upload is unavailable right now." },
      { status: 503 },
    );
  }
}
