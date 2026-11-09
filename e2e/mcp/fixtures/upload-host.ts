import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import {
  mcpUploadSessionSchema,
  MCP_UPLOAD_CHUNK_BYTES,
} from "@studio/contracts/mcp-upload";
const workspaceId = "11111111-1111-4111-8111-111111111111",
  uploadId = "22222222-2222-4222-8222-222222222222";
const frame = document.createElement("iframe");
frame.title = "VCStudio MCP upload";
frame.style.cssText = "width:100%;height:960px;border:0";
document.body.append(frame);
const theme =
  new URLSearchParams(location.search).get("theme") === "dark"
    ? "dark"
    : "light";
let session: ReturnType<typeof mcpUploadSessionSchema.parse> | null = null;
const received = new Set<number>();
const bridge = new AppBridge(
  null,
  { name: "Upload test host", version: "1.0.0" },
  { serverTools: {} },
  { hostContext: { theme } },
);
bridge.oninitialized = async () => {
  await bridge.sendToolInput({ arguments: { workspaceId } });
  await bridge.sendToolResult({
    content: [],
    structuredContent: {
      ok: true,
      data: {
        workspaceId,
        limits: {
          maxImageBytes: 25 * 1024 * 1024,
          maxVideoBytes: 512 * 1024 * 1024,
        },
      },
    },
  });
};
bridge.oncalltool = async (params) => {
  const counts = JSON.parse(document.body.dataset.calls ?? "[]");
  counts.push(params.name);
  document.body.dataset.calls = JSON.stringify(counts);
  if (params.name === "start_media_upload") {
    const args = params.arguments ?? {};
    session = mcpUploadSessionSchema.parse({
      uploadId,
      workspaceId,
      status: "awaiting_upload",
      expiresAt: "2026-11-10T10:00:00Z",
      fileName: args.fileName,
      sizeBytes: args.sizeBytes,
      fileFingerprint: args.fileFingerprint,
      chunkBytes: MCP_UPLOAD_CHUNK_BYTES,
      chunkCount: Math.ceil(Number(args.sizeBytes) / MCP_UPLOAD_CHUNK_BYTES),
      receivedIndices: [],
      receivedBytes: 0,
      mediaAssetId: null,
      mediaStatus: null,
      inspectionStatus: null,
      error: null,
    });
  } else if (params.name === "append_media_upload") {
    if (localStorage.getItem("upload-fixture-delay"))
      await new Promise((resolve) => setTimeout(resolve, 500));
    if (localStorage.getItem("upload-fixture-error"))
      return {
        content: [],
        isError: true,
        structuredContent: {
          ok: false,
          code: "interrupted",
          message: "Transfer interrupted. Resume with the same original file.",
        },
      };
    const index = Number(params.arguments?.index);
    received.add(index);
    document.body.dataset.chunks = JSON.stringify([...received]);
    return {
      content: [],
      structuredContent: { ok: true, data: { index, reused: false } },
    };
  } else if (params.name === "complete_media_upload") {
    if (!session) throw new Error("missing session");
    session = {
      ...session,
      status: "queued",
      receivedIndices: [...received],
      receivedBytes: session.sizeBytes,
    };
  } else if (params.name === "get_media_upload") {
    if (!session) throw new Error("missing session");
    session = {
      ...session,
      receivedIndices: [...received],
      receivedBytes: Math.min(
        received.size * MCP_UPLOAD_CHUNK_BYTES,
        session.sizeBytes,
      ),
      ...(session.status === "queued"
        ? {
            status: "succeeded",
            mediaAssetId: uploadId,
            mediaStatus: localStorage.getItem("upload-fixture-inspection-error")
              ? "failed"
              : "ready",
            inspectionStatus: localStorage.getItem(
              "upload-fixture-inspection-error",
            )
              ? "failed"
              : "succeeded",
            error: localStorage.getItem("upload-fixture-inspection-error")
              ? "Video inspection failed."
              : null,
          }
        : {}),
    };
  } else if (params.name === "cancel_media_upload") {
    if (!session) throw new Error("missing session");
    session = {
      ...session,
      status: "cancelled",
      receivedIndices: [],
      receivedBytes: 0,
    };
    received.clear();
  } else throw new Error("Unexpected tool: " + params.name);
  return { content: [], structuredContent: { ok: true, data: session } };
};
bridge.onupdatemodelcontext = async () => ({});
bridge.onmessage = async () => ({});
await bridge.connect(
  new PostMessageTransport(frame.contentWindow!, frame.contentWindow!),
);
frame.src = "/upload.html";
