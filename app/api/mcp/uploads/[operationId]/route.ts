import { z } from "zod";
import { loadBrowserMcpOperation } from "@/lib/mcp/browser-operation";
import { authorizeMcpUpload, finishMcpImport } from "@/lib/mcp/import-service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ operationId: string }> },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Origin is not allowed." }, { status: 403 });
  try {
    const { operationId } = await params;
    const workspaceId = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("workspaceId"));
    const { context } = await loadBrowserMcpOperation(operationId, workspaceId);
    const body: unknown = await request.json();
    const step = z
      .object({ step: z.enum(["authorize", "complete"]) })
      .parse(body).step;
    const result =
      step === "authorize"
        ? await authorizeMcpUpload(context, operationId, body)
        : await finishMcpImport(context, operationId);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      {
        error:
          "Upload is unavailable. Check the request, file and connection permissions.",
      },
      { status: 400 },
    );
  }
}
