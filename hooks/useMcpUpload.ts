"use client";
import { useEffect, useRef, useState } from "react";
import { App } from "@modelcontextprotocol/ext-apps";
import { z } from "zod";
import {
  mcpUploadKey,
  mcpUploadSessionSchema,
  MCP_SERVER_VERSION,
  type McpUploadSession,
} from "@studio/contracts/mcp-upload";
import {
  callUploadTool,
  uploadFileViaMcp,
  uploadFileContentType,
} from "@/lib/mcp/upload-file-via-mcp";
const contextSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    workspaceId: z.uuid(),
    resumeUploadId: z.uuid().optional(),
    resumeSession: mcpUploadSessionSchema.optional(),
    limits: z.object({ maxImageBytes: z.number(), maxVideoBytes: z.number() }),
  }),
});
export function useMcpUpload() {
  const appRef = useRef<App | null>(null),
    abortRef = useRef<AbortController | null>(null),
    uploadIdRef = useRef<string | null>(null),
    keyRef = useRef(crypto.randomUUID()),
    busy = useRef(false);
  const [context, setContext] = useState<
      z.infer<typeof contextSchema>["data"] | null
    >(null),
    [session, setSession] = useState<McpUploadSession | null>(null),
    [action, setAction] = useState<"upload" | "status" | "cancel" | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(0);
  const pending = action !== null;
  useEffect(() => {
    const app = new App(
      { name: "VCStudio media upload", version: MCP_SERVER_VERSION },
      {},
    );
    appRef.current = app;
    const theme = () =>
      document.documentElement.classList.toggle(
        "dark",
        app.getHostContext()?.theme === "dark",
      );
    app.ontoolresult = (result) => {
      const parsed = contextSchema.safeParse(result.structuredContent);
      if (parsed.success) {
        setContext(parsed.data.data);
        uploadIdRef.current = parsed.data.data.resumeUploadId ?? null;
        if (parsed.data.data.resumeSession)
          setSession(parsed.data.data.resumeSession);
      }
    };
    app.onhostcontextchanged = theme;
    void app
      .connect()
      .then(() => {
        theme();
      })
      .catch(() =>
        setError(
          "This client could not open the MCP upload panel. Refresh the connector; programmatic clients can use the start/append/complete upload tools.",
        ),
      );
    return () => {
      abortRef.current?.abort();
      appRef.current = null;
      void app.close().catch(() => undefined);
    };
  }, []);
  const call = async (name: string, args: Record<string, unknown>) => {
    if (!appRef.current)
      throw new Error(
        "The MCP connection is unavailable. Refresh the connector.",
      );
    return appRef.current.callServerTool({ name, arguments: args });
  };
  function remember(value: McpUploadSession) {
    uploadIdRef.current = value.uploadId;
    setSession(value);
    void appRef.current
      ?.updateModelContext({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              event: "media_upload_status",
              workspaceId: value.workspaceId,
              uploadId: value.uploadId,
              status: value.status,
              mediaAssetId: value.mediaAssetId,
              mediaStatus: value.mediaStatus,
              inspectionStatus: value.inspectionStatus,
            }),
          },
        ],
      })
      .catch(() => undefined);
  }
  async function upload(file: File) {
    if (!context || busy.current) return;
    busy.current = true;
    setAction("upload");
    setError("");
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const type = uploadFileContentType(file),
        max = type.startsWith("image/")
          ? context.limits.maxImageBytes
          : context.limits.maxVideoBytes;
      if (file.size === 0 || file.size > max)
        throw new Error(
          `Choose a nonempty file up to ${Math.floor(max / 1024 / 1024)} MB.`,
        );
      const result = await uploadFileViaMcp({
        workspaceId: context.workspaceId,
        file,
        uploadId: uploadIdRef.current,
        idempotencyKey: keyRef.current,
        call,
        signal: controller.signal,
        onSession: remember,
        onProgress: (stage, bytes) => {
          setMessage(
            stage === "checking"
              ? "Checking original file…"
              : stage === "uploading"
                ? `Uploading ${Math.round((bytes / file.size) * 100)}%…`
                : "File transferred. Starting import and inspection…",
          );
          setProgress(
            stage === "checking"
              ? Math.round((bytes / file.size) * 15)
              : stage === "uploading"
                ? 15 + Math.round((bytes / file.size) * 80)
                : 95,
          );
        },
      });
      setProgress(100);
      setMessage(
        result.mediaStatus === "ready"
          ? "Media is ready in your library."
          : "Transfer complete. Import and media inspection are processing; check status before using the asset.",
      );
      try {
        await appRef.current?.sendMessage({
          role: "user",
          content: [
            {
              type: "text",
              text: `My media transfer through MCP is complete. Check get_media_upload/get_operation for upload ${result.uploadId} in workspace ${result.workspaceId} before using the asset. Nothing has been published or scheduled.`,
            },
          ],
        });
      } catch {
        /* Model context already contains the durable operation ID. */
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The upload was interrupted. Resume with the same file.",
      );
    } finally {
      busy.current = false;
      setAction(null);
      abortRef.current = null;
    }
  }
  async function checkStatus() {
    if (!context || !uploadIdRef.current || busy.current) return;
    busy.current = true;
    setAction("status");
    setError("");
    try {
      const state = mcpUploadSessionSchema.parse(
        await callUploadTool(call, "get_media_upload", {
          workspaceId: context.workspaceId,
          uploadId: uploadIdRef.current,
        }),
      );
      remember(state);
      if (state.mediaStatus === "failed")
        setError(
          state.error ??
            "Media inspection failed. This asset cannot be published.",
        );
      setMessage(
        state.mediaStatus === "ready"
          ? "Media is ready in your library."
          : state.mediaStatus === "failed"
            ? "Transfer complete, but media inspection failed. This asset cannot be published."
            : (state.error ?? `Upload status: ${state.status}.`),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Status is unavailable. Try again.",
      );
    } finally {
      busy.current = false;
      setAction(null);
    }
  }
  async function cancel() {
    if (!context || !uploadIdRef.current || busy.current) return;
    busy.current = true;
    setAction("cancel");
    setError("");
    try {
      remember(
        mcpUploadSessionSchema.parse(
          await callUploadTool(call, "cancel_media_upload", {
            workspaceId: context.workspaceId,
            uploadId: uploadIdRef.current,
            idempotencyKey: mcpUploadKey(uploadIdRef.current, "cancel"),
          }),
        ),
      );
      setMessage("Upload cancelled. Library assets and posts are unchanged.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Cancellation failed. Check status before retrying.",
      );
    } finally {
      busy.current = false;
      setAction(null);
    }
  }
  function newUpload() {
    if (busy.current) return;
    uploadIdRef.current = null;
    keyRef.current = crypto.randomUUID();
    setSession(null);
    setMessage("");
    setError("");
    setProgress(0);
  }
  return {
    context,
    session,
    pending,
    action,
    message,
    error,
    progress,
    upload,
    checkStatus,
    cancel,
    newUpload,
    pause: () => abortRef.current?.abort(),
  };
}
