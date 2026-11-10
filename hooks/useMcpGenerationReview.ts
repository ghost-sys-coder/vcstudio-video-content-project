"use client";
import { useEffect, useRef, useState } from "react";
import { App } from "@modelcontextprotocol/ext-apps";
import { z } from "zod";
import { generationPreviewSchema } from "@studio/contracts/mcp-generation";
const payload = z.object({
  ok: z.literal(true),
  data: z.object({
    operation: z.object({
      id: z.uuid(),
      workspaceId: z.uuid(),
      status: z.string(),
    }),
    preview: generationPreviewSchema,
    approvalUrl: z.url(),
  }),
});
export function useMcpGenerationReview() {
  const appRef = useRef<App | null>(null),
    proofRef = useRef<string | undefined>(undefined);
  const [data, setData] = useState<z.infer<typeof payload>["data"] | null>(
    null,
  );
  const [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    [complete, setComplete] = useState(false),
    [canApprove, setCanApprove] = useState(false);
  useEffect(() => {
    const app = new App(
      { name: "VCStudio generation review", version: "1.0.0" },
      {},
    );
    appRef.current = app;
    const theme = () =>
      document.documentElement.classList.toggle(
        "dark",
        app.getHostContext()?.theme === "dark",
      );
    app.ontoolresult = (result) => {
      const parsed = payload.safeParse(result.structuredContent);
      if (parsed.success) {
        setData(parsed.data.data);
        const meta = z
          .object({ approvalProof: z.string().optional() })
          .parse(result._meta ?? {});
        proofRef.current = meta.approvalProof;
        setCanApprove(!!meta.approvalProof);
        setComplete(false);
      } else if (result.isError)
        setMessage(
          "This review is unavailable. Open the signed-in VCStudio review page.",
        );
    };
    app.onhostcontextchanged = theme;
    void app
      .connect()
      .then(theme)
      .catch(() =>
        setMessage(
          "Interactive review is unavailable. Use the signed-in review link.",
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
        name: "confirm_generation",
        arguments: {
          operationId: data.operation.id,
          workspaceId: data.operation.workspaceId,
          proof: proofRef.current,
        },
      });
      if (result.isError) {
        setMessage(
          "Approval failed or became stale. Open VCStudio or prepare a fresh generation.",
        );
        return;
      }
      proofRef.current = undefined;
      setCanApprove(false);
      setComplete(true);
      setMessage(
        "Generation authorized. Ask the assistant to inspect generation progress.",
      );
    } catch {
      setMessage(
        "The response was interrupted. Inspect generation status before retrying.",
      );
    } finally {
      setPending(false);
    }
  }
  return { data, message, pending, complete, canApprove, approve };
}
