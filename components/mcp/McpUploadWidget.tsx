"use client";
import { useState } from "react";
import { UploadIcon, ShieldCheckIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/Progress";
import { useMcpUpload } from "@/hooks/useMcpUpload";
export function McpUploadWidget() {
  const state = useMcpUpload(),
    [file, setFile] = useState<File | null>(null),
    [inputKey, setInputKey] = useState(0);
  const transferred =
    state.session &&
    ["queued", "running", "succeeded"].includes(state.session.status);
  const terminal =
    state.session &&
    (["failed", "expired", "cancelled"].includes(state.session.status) ||
      state.session.mediaStatus === "failed");
  return (
    <main className="app-panel app-section min-w-0">
      <header className="app-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <UploadIcon aria-hidden className="size-5" />
            Upload media
          </h1>
          <Badge variant="secondary">Inside your chat</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Bring an original image or video into your private library. No browser
          tab or R2 network permission is needed.
        </p>
      </header>
      {!state.context ? (
        <p role="status">{state.error || "Connecting the MCP upload panel…"}</p>
      ) : (
        <>
          <div className="app-heading">
            <Label htmlFor="mcp-media-file">Original file</Label>
            <Input
              key={inputKey}
              id="mcp-media-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm,.mov,.webm"
              disabled={
                state.pending || Boolean(transferred) || Boolean(terminal)
              }
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Images up to{" "}
              {Math.floor(state.context.limits.maxImageBytes / 1024 / 1024)} MB
              · Videos up to{" "}
              {Math.floor(state.context.limits.maxVideoBytes / 1024 / 1024)} MB.
              Select the same original file to resume an interrupted upload.
            </p>
          </div>
          {file ? (
            <p className="break-all text-sm">
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          ) : null}
          {state.pending || state.progress > 0 ? (
            <Progress
              aria-label="Media upload progress"
              value={state.progress}
            />
          ) : null}
          {state.message ? (
            <p role="status" className="text-sm">
              {state.message}
            </p>
          ) : null}
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state.session ? (
            <p className="break-all text-xs text-muted-foreground">
              Upload ID: {state.session.uploadId}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!transferred && !terminal ? (
              <Button
                disabled={!file || state.pending}
                onClick={() => {
                  if (file) void state.upload(file);
                }}
              >
                {state.pending ? (
                  <Loader2Icon aria-hidden className="animate-spin" />
                ) : (
                  <UploadIcon aria-hidden />
                )}
                {state.session ? "Resume upload" : "Upload to library"}
              </Button>
            ) : null}
            {state.action === "upload" && file ? (
              <Button variant="outline" onClick={state.pause}>
                Pause upload
              </Button>
            ) : null}
            {state.session ? (
              <Button
                variant="outline"
                disabled={state.pending}
                onClick={() => void state.checkStatus()}
              >
                {state.action === "status" ? (
                  <Loader2Icon aria-hidden className="animate-spin" />
                ) : null}
                {state.action === "status" ? "Checking…" : "Check status"}
              </Button>
            ) : null}
            {state.session?.status === "awaiting_upload" ? (
              <Button
                variant="outline"
                disabled={state.pending}
                onClick={() => void state.cancel()}
              >
                {state.action === "cancel" ? (
                  <Loader2Icon aria-hidden className="animate-spin" />
                ) : null}
                {state.action === "cancel" ? "Cancelling…" : "Cancel upload"}
              </Button>
            ) : null}
            {terminal ||
            state.session?.mediaStatus === "ready" ||
            (state.error && !state.session) ? (
              <Button
                variant="outline"
                disabled={state.pending}
                onClick={() => {
                  state.newUpload();
                  setFile(null);
                  setInputKey((value) => value + 1);
                }}
              >
                Upload another file
              </Button>
            ) : null}
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheckIcon aria-hidden className="size-4 shrink-0" />
            Uploads are checked before use. This panel never approves, publishes
            or schedules content.
          </p>
        </>
      )}
    </main>
  );
}
