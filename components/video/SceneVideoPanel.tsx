"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, LoaderCircle, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/ui/badge";
import { VideoSelectField } from "./VideoSelectField";
import { VideoAssetPicker } from "./VideoAssetPicker";
import {
  sceneVideoViewAction,
  saveSceneVideoAction,
  reviewSceneVideoAction,
  previewSceneVideoAction,
} from "@/app/(authenticated)/app/video/actions";
import type { SceneVideoView } from "@/lib/video-generation/scene-video-service";
export function SceneVideoPanel({
  workspaceId,
  projectId,
  sceneId,
  canEdit,
}: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<SceneVideoView | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"inherit" | "image" | "video">("inherit"),
    [asset, setAsset] = useState<{ id: string; title: string } | null>(null),
    [fit, setFit] = useState<"contain" | "cover">("contain"),
    [trim, setTrim] = useState(0),
    [loop, setLoop] = useState(false),
    [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void sceneVideoViewAction(workspaceId, { projectId, sceneId })
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          const next = result.value;
          setView(next);
          setKind(next.selection?.kind ?? "inherit");
          setFit(next.selection?.fit ?? "contain");
          setTrim((next.selection?.trimStartMilliseconds ?? 0) / 1000);
          setLoop(next.selection?.loop ?? false);
          if (next.selection?.sourceAssetId)
            setAsset({
              id: next.selection.sourceAssetId,
              title: "Saved scene footage",
            });
        } else setError(result.error);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError(
            "Scene footage could not be loaded. Reopen this tab to try again.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [workspaceId, projectId, sceneId]);
  async function save() {
    if (!view) return;
    setBusy(true);
    setError(null);
    try {
      const result = await saveSceneVideoAction(workspaceId, {
        projectId,
        sceneId,
        sceneVersionId: view.sceneVersionId,
        expectedRevision: view.selection?.revision ?? 0,
        kind,
        assetId: kind === "video" ? (asset?.id ?? null) : null,
        fit,
        trimStartMilliseconds: Math.round(trim * 1000),
        loop,
      });
      if (result.ok) {
        setView(result.value);
        setUrl(null);
        router.refresh();
      } else setError(result.error);
    } catch {
      setError(
        "Footage could not be saved. Your choices are preserved; refresh the saved state before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refreshSaved() {
    setBusy(true);
    setError(null);
    try {
      const result = await sceneVideoViewAction(workspaceId, {
        projectId,
        sceneId,
      });
      if (result.ok) {
        setView(result.value);
        setUrl(null);
      } else setError(result.error);
    } catch {
      setError("The saved scene state could not be refreshed. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function review(reviewStatus: "approved" | "rejected") {
    if (!view?.selection) return;
    setBusy(true);
    setError(null);
    try {
      const result = await reviewSceneVideoAction(workspaceId, {
        projectId,
        sceneId,
        expectedRevision: view.selection.revision,
        reviewStatus,
      });
      if (result.ok) {
        setView(result.value);
        router.refresh();
      } else setError(result.error);
    } catch {
      setError("The review could not be saved. Refresh before retrying.");
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    setBusy(true);
    setError(null);
    try {
      const result = await previewSceneVideoAction(workspaceId, {
        projectId,
        sceneId,
      });
      if (result.ok) setUrl(result.value);
      else setError(result.error);
    } catch {
      setError("The preview could not be opened. Try again.");
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <p
        role="status"
        className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
      >
        <LoaderCircle className="size-4 animate-spin" />
        Loading scene footage…
      </p>
    );
  return (
    <section className="space-y-5 font-[family-name:var(--font-geist-sans,Arial,sans-serif)]">
      <div className="app-page-header">
        <div className="app-heading">
          <h3 className="font-semibold">Scene visuals</h3>
          <p className="text-sm text-muted-foreground">
            Choose still images or moving footage. Project default:{" "}
            {view?.projectDefault === "video"
              ? "video footage"
              : "still images"}
            . Narration stays with the project.
          </p>
        </div>
        <Button
          nativeButton={false}
          variant="outline"
          render={
            <Link
              href={`/app/video?projectId=${projectId}&sceneId=${sceneId}`}
            />
          }
        >
          <Clapperboard className="size-4" />
          Generate video
        </Button>
      </div>
      {view ? (
        <>
          <VideoSelectField
            id={`scene-visual-${sceneId}`}
            label="Visual source"
            value={kind}
            disabled={!canEdit || busy}
            options={[
              {
                value: "inherit",
                label: `Inherit project default (${view.projectDefault})`,
              },
              { value: "image", label: "Still images" },
              { value: "video", label: "Video footage" },
            ]}
            onChange={(value) => {
              if (value === "inherit" || value === "image" || value === "video")
                setKind(value);
            }}
          />
          {kind === "video" ? (
            <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm">
                  {asset?.title ?? "Choose inspected footage from the library."}
                </p>
                <VideoAssetPicker
                  kind="video"
                  disabled={!canEdit || busy}
                  onSelect={(selected) =>
                    setAsset({ id: selected.id, title: selected.title })
                  }
                />
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <VideoSelectField
                  id={`scene-video-fit-${sceneId}`}
                  label="Framing"
                  value={fit}
                  disabled={!canEdit || busy}
                  options={[
                    { value: "contain", label: "Fit whole video (contain)" },
                    { value: "cover", label: "Fill frame (crop)" },
                  ]}
                  onChange={(value) => {
                    if (value === "contain" || value === "cover") setFit(value);
                  }}
                />
                <div className="space-y-2">
                  <Label htmlFor={`scene-video-trim-${sceneId}`}>
                    Start at (seconds)
                  </Label>
                  <Input
                    id={`scene-video-trim-${sceneId}`}
                    type="number"
                    min={0}
                    step={0.1}
                    value={trim}
                    disabled={!canEdit || busy}
                    onChange={(event) => setTrim(Number(event.target.value))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={loop}
                  disabled={!canEdit || busy}
                  onCheckedChange={(value) => setLoop(value === true)}
                />
                Loop short footage to cover narration
              </label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Without looping, the clip must cover the entire narrated scene.
                Project footage plays muted. The original library file is
                preserved.
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={!canEdit || busy || (kind === "video" && !asset)}
              onClick={() => void save()}
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {busy ? "Working…" : "Save visual selection"}
            </Button>
            {view.selection?.kind === "video" ? (
              <Badge
                variant={
                  view.selection.reviewStatus === "approved"
                    ? "default"
                    : "secondary"
                }
              >
                Saved footage: {view.selection.reviewStatus}
              </Badge>
            ) : null}
          </div>
          {view.selection?.kind === "video" ? (
            <div className="space-y-4 border-t pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => void preview()}
                >
                  <Play className="size-4" />
                  Preview saved footage
                </Button>
                <span className="text-xs text-muted-foreground">
                  {view.selection.width} × {view.selection.height} ·{" "}
                  {((view.selection.durationMilliseconds ?? 0) / 1000).toFixed(
                    1,
                  )}
                  s · {view.selection.fit}
                </span>
              </div>
              {url ? (
                <video
                  aria-label="Saved scene footage"
                  src={url}
                  controls
                  muted
                  preload="metadata"
                  className="aspect-video w-full rounded-2xl border bg-black object-contain"
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={
                    !canEdit ||
                    busy ||
                    view.selection.reviewStatus === "approved"
                  }
                  onClick={() => void review("approved")}
                >
                  Approve saved footage
                </Button>
                <Button
                  disabled={
                    !canEdit ||
                    busy ||
                    view.selection.reviewStatus === "rejected"
                  }
                  variant="outline"
                  onClick={() => void review("rejected")}
                >
                  Reject footage
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Approval applies to the saved copy and framing. Saving another
                selection requires review again.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-destructive/20 p-3 text-sm text-destructive"
        >
          <p>{error}</p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void refreshSaved()}
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {busy ? "Refreshing…" : "Refresh saved state"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
