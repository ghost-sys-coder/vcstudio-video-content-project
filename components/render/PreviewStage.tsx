"use client";

import { useCallback, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreviewLoadingOverlay } from "@/components/render/PreviewLoadingOverlay";
import { useRenderPreloadWindow } from "@/hooks/use-render-preload-window";
import {
  VideoComposition,
  type VideoCompositionProps,
} from "@/remotion/VideoComposition";

/**
 * Hosts the Remotion Player for a ready preview. It owns the player ref and
 * drives the rolling asset preloader, which gates playback: controls stay
 * disabled and a loading overlay is shown until the initial window is ready,
 * and Remotion's buffer state pauses playback (showing a poster) whenever an
 * upcoming asset is not yet loaded. The Player never autoplays.
 */
export function PreviewStage({ props }: { props: VideoCompositionProps }) {
  const playerRef = useRef<PlayerRef>(null);
  const [showSafeAreaGuides, setShowSafeAreaGuides] = useState(false);

  const preload = useRenderPreloadWindow({
    scenes: props.scenes,
    framesPerSecond: props.framesPerSecond,
    fontFamily: props.captionStyle.fontFamily,
    playerRef,
  });

  const renderPoster = useCallback(
    () => (
      <div className="flex size-full items-center justify-center bg-black/60">
        <Loader2Icon aria-hidden className="size-6 animate-spin text-white" />
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border bg-black">
        <Player
          ref={playerRef}
          component={VideoComposition}
          compositionHeight={props.height}
          compositionWidth={props.width}
          controls={preload.ready}
          durationInFrames={props.durationInFrames}
          fps={props.framesPerSecond}
          inputProps={{ ...props, showSafeAreaGuides }}
          loop
          posterFillMode="composition-size"
          renderPoster={renderPoster}
          showPosterWhenBuffering
          style={{ width: "100%" }}
        />
        {preload.ready ? null : (
          <PreviewLoadingOverlay
            loadedCount={preload.loadedCount}
            totalCount={preload.totalCount}
          />
        )}
      </div>
      <div className="flex justify-end">
        <Button
          disabled={!preload.ready}
          onClick={() => setShowSafeAreaGuides((value) => !value)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {showSafeAreaGuides ? "Hide safe area" : "Show safe area"}
        </Button>
      </div>
    </div>
  );
}
