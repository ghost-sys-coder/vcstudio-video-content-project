"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { PreviewStage } from "@/components/render/PreviewStage";
import type { VideoCompositionProps } from "@/remotion/VideoComposition";
import { videoCompositionInputSchema } from "@/lib/render/render-composition-input";

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; props: VideoCompositionProps }
  | { status: "invalid" }
  | { status: "error" };

/**
 * Live in-browser Remotion preview. It fetches the composition props the render
 * uses (with long-lived signed asset URLs) and, once ready, hands them to
 * {@link PreviewStage}, which owns the Player, the rolling asset preloader, and
 * playback gating. Rendering is deferred to the client because the Player is
 * not server-renderable.
 */
export function VideoPreviewPlayer({
  projectId,
  refreshToken,
}: {
  projectId: string;
  refreshToken: number;
}) {
  const [state, setState] = useState<PreviewState>({ status: "loading" });

  const fetchPreview = useCallback(async (): Promise<PreviewState> => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/renders/preview`,
        { cache: "no-store" },
      );
      const payload: unknown = await response.json();
      if (
        !payload ||
        typeof payload !== "object" ||
        !("data" in payload) ||
        !payload.data ||
        typeof payload.data !== "object" ||
        !("status" in payload.data)
      )
        return { status: "error" };
      const data = payload.data as { status: string; input?: unknown };
      if (data.status !== "ready") return { status: "invalid" };
      const parsed = videoCompositionInputSchema.safeParse(data.input);
      if (!parsed.success) return { status: "error" };
      return { status: "ready", props: parsed.data };
    } catch {
      return { status: "error" };
    }
  }, [projectId]);

  // Fetch happens in the effect; state is only set after the await resolves, so
  // the previous preview stays visible while a refresh loads.
  useEffect(() => {
    let cancelled = false;
    void fetchPreview().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPreview, refreshToken]);

  const retry = () => {
    setState({ status: "loading" });
    void fetchPreview().then(setState);
  };

  if (state.status === "loading")
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border bg-muted/30">
        <Loader2Icon
          aria-hidden
          className="size-6 animate-spin text-muted-foreground"
        />
      </div>
    );

  if (state.status === "invalid")
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Preview is available once every scene has an approved image and
          narration.
        </p>
      </div>
    );

  if (state.status === "error")
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          The preview could not be loaded.{" "}
          <button
            className="underline underline-offset-2"
            onClick={retry}
            type="button"
          >
            Retry
          </button>
        </p>
      </div>
    );

  // Key the stage on the preview identity (scene set + freshly signed first
  // asset) so a refreshed preview remounts, re-gating playback and re-priming
  // the preloader from scratch.
  const previewKey = `${state.props.scenes.length}:${state.props.durationInFrames}:${
    state.props.scenes[0]?.sceneId ?? ""
  }:${state.props.scenes[0]?.imageUrl ?? ""}`;

  return <PreviewStage key={previewKey} props={state.props} />;
}
