"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadMcpFile } from "@/lib/mcp/upload-client";
export function McpUploadPanel({
  operationId,
  workspaceId,
  destination,
}: {
  operationId: string;
  workspaceId: string;
  destination: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    if (!file) return;
    setPending(true);
    setMessage("");
    try {
      await uploadMcpFile(operationId, workspaceId, file);
      setMessage(
        "Upload saved. Videos must finish verification before use. Return to the assistant to continue with this operation ID.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Upload failed. Your file selection is preserved; try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="app-panel app-section">
      <div className="app-heading">
        <h2 className="text-lg font-semibold">Upload existing content</h2>
        <p className="text-muted-foreground">{destination}</p>
        <p className="text-sm">
          Uploading saves a private copy. It does not approve scene media or
          publish a post.
        </p>
      </div>
      <Label htmlFor="mcp-file">Image or video</Label>
      <Input
        id="mcp-file"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        disabled={pending}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <Button type="button" disabled={!file || pending} onClick={submit}>
        {pending ? "Uploading…" : "Upload to workspace"}
      </Button>
      {message && (
        <p role="status" className="break-words text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
