"use client";
import { useEffect, useRef, useState } from "react";
import { App } from "@modelcontextprotocol/ext-apps";
import { z } from "zod";
import { publicationPreviewSchema } from "@studio/contracts";
const payloadSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    operation: z.object({
      id: z.uuid(),
      workspaceId: z.uuid(),
      status: z.string(),
    }),
    preview: publicationPreviewSchema,
    approvalUrl: z.url(),
  }),
});
const privateSchema = z.object({
  approvalProof: z.string().optional(),
  mediaPreviews: z
    .array(z.object({ id: z.string(), kind: z.string(), url: z.url() }))
    .default([]),
});
export function useMcpReview() {
  const appRef = useRef<App | null>(null);
  const proofRef = useRef<string | undefined>(undefined);
  const [data, setData] = useState<
    z.infer<typeof payloadSchema>["data"] | null
  >(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [mediaPreviews, setMediaPreviews] = useState<
    z.infer<typeof privateSchema>["mediaPreviews"]
  >([]);
  useEffect(() => {
    const app = new App(
      { name: "VCStudio publication review", version: "1.0.0" },
      {},
    );
    appRef.current = app;
    function theme() {
      document.documentElement.classList.toggle(
        "dark",
        app.getHostContext()?.theme === "dark",
      );
    }
    app.ontoolresult = (result) => {
      const parsed = payloadSchema.safeParse(result.structuredContent);
      if (parsed.success) {
        setData(parsed.data.data);
        const meta = privateSchema.parse(result._meta ?? {});
        proofRef.current = meta.approvalProof;
        setCanApprove(!!meta.approvalProof);
        setMediaPreviews(meta.mediaPreviews);
        setComplete(false);
      } else if (result.isError)
        setMessage(
          "The review is unavailable. Open the VCStudio approval page.",
        );
    };
    app.onhostcontextchanged = theme;
    void app
      .connect()
      .then(theme)
      .catch(() =>
        setMessage(
          "Interactive review is unavailable in this client. Use the browser approval link from the tool result.",
        ),
      );
    return () => {
      appRef.current = null;
      void app.close().catch(() => undefined);
    };
  }, []);
  async function approve() {
    if (!data || !appRef.current || !proofRef.current || pending || complete)
      return;
    setPending(true);
    setMessage("");
    try {
      const result = await appRef.current.callServerTool({
        name: "confirm_publication",
        arguments: {
          workspaceId: data.operation.workspaceId,
          operationId: data.operation.id,
          proof: proofRef.current,
        },
      });
      if (result.isError) {
        setMessage(
          "Approval failed or became stale. Open VCStudio or prepare a fresh preview.",
        );
        return;
      }
      const state = z
        .object({
          ok: z.boolean(),
          data: z.object({ status: z.string(), error: z.string().nullable() }),
        })
        .parse(result.structuredContent);
      setComplete(true);
      proofRef.current = undefined;
      setCanApprove(false);
      setMessage(
        state.data.error ??
          "Approval recorded. Ask the assistant to inspect per-destination publication progress.",
      );
    } catch {
      setMessage(
        "The request was interrupted. Inspect its current status before retrying.",
      );
    } finally {
      setPending(false);
    }
  }
  return {
    data,
    mediaPreviews,
    message,
    pending,
    complete,
    canApprove,
    approve,
  };
}
