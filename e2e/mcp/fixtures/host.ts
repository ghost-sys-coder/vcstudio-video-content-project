import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { preview, workspaceId, operationId } from "./data";
const frame = document.createElement("iframe");
frame.title = "VCStudio review";
frame.style.cssText = "width:100%;height:1200px;border:0";
document.body.append(frame);
const theme =
  new URLSearchParams(location.search).get("theme") === "dark"
    ? "dark"
    : "light";
const bridge = new AppBridge(
  null,
  { name: "Test MCP Apps host", version: "1.0.0" },
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
        operation: {
          id: operationId,
          workspaceId,
          status: "requires_approval",
        },
        preview,
        approvalUrl: `https://vcstudio.example/app/mcp/operations/${operationId}`,
      },
    },
    _meta: {
      approvalProof: new URLSearchParams(location.search).has("noProof")
        ? undefined
        : "private-user-interface-proof-123456789",
    },
  });
};
bridge.oncalltool = async (params) => {
  if (
    params.name !== "confirm_publication" ||
    params.arguments?.proof !== "private-user-interface-proof-123456789"
  )
    throw new Error("Invalid approval");
  document.body.dataset.approvals = String(
    Number(document.body.dataset.approvals ?? 0) + 1,
  );
  return {
    content: [],
    structuredContent: { ok: true, data: { status: "succeeded", error: null } },
  };
};
await bridge.connect(
  new PostMessageTransport(frame.contentWindow!, frame.contentWindow!),
);
frame.src = "/review.html";
