"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { prefetch } from "remotion";
import type { PlayerRef } from "@remotion/player";
import { ensurePreviewFontsReady } from "@/lib/render/preview-fonts";
import {
  buildPreviewAssets,
  initialPreloadUrls,
  selectPreloadUrls,
  type PreviewAsset,
} from "@/lib/render/preview-preload-plan";
import { recordPreviewEvent } from "@/lib/render/preview-telemetry";
import type { VideoCompositionScene } from "@/lib/render/video-composition-data";

interface PrefetchEntry {
  free: () => void;
  asset: PreviewAsset | undefined;
}

export interface PreloadWindowState {
  /** True once the initial window and fonts are ready so playback may begin. */
  ready: boolean;
  /** Assets loaded so far in the initial window, for the loading indicator. */
  loadedCount: number;
  /** Total assets required for the initial window. */
  totalCount: number;
}

function assetByUrl(
  assets: readonly PreviewAsset[],
  url: string,
): PreviewAsset | undefined {
  return assets.find((asset) => asset.url === url);
}

/**
 * Drives the preview player's asset readiness: it prefetches the initial window
 * (plus fonts) before reporting `ready`, then maintains a rolling prefetch
 * window around the playhead during playback — fetching upcoming assets and
 * freeing ones far behind — instead of downloading the whole project. All work
 * is recorded through the preview telemetry so first-play buffering is
 * observable.
 */
export function useRenderPreloadWindow(input: {
  scenes: readonly VideoCompositionScene[];
  framesPerSecond: number;
  fontFamily: string;
  playerRef: RefObject<PlayerRef | null>;
}): PreloadWindowState {
  const { scenes, framesPerSecond, fontFamily, playerRef } = input;

  const assets = useMemo(
    () => buildPreviewAssets(scenes, framesPerSecond),
    [scenes, framesPerSecond],
  );
  const initialUrls = useMemo(() => initialPreloadUrls(assets), [assets]);
  const totalCount = initialUrls.size;

  const prefetchesRef = useRef<Map<string, PrefetchEntry>>(new Map());
  const keepUrlsRef = useRef<Set<string>>(new Set());
  const lastSignatureRef = useRef<string>("");

  // Playback gate. This hook is mounted fresh per preview (the stage is keyed on
  // the preview identity), so initial state re-gates playback on every refresh
  // without an in-render or in-effect reset — both of which the lint rules for
  // this codebase forbid.
  const [progress, setProgress] = useState<{
    ready: boolean;
    loadedCount: number;
  }>({ ready: false, loadedCount: 0 });

  // Prime the initial window (assets + fonts), then report ready.
  useEffect(() => {
    const prefetches = prefetchesRef.current;
    keepUrlsRef.current = initialUrls;
    lastSignatureRef.current = "";

    let cancelled = false;

    const ensure = (url: string): Promise<unknown> => {
      if (prefetches.has(url)) return Promise.resolve();
      const asset = assetByUrl(assets, url);
      recordPreviewEvent({
        type: "load-start",
        assetUrl: url,
        assetType: asset?.type,
        sceneId: asset?.sceneId,
      });
      const handle = prefetch(url, { method: "blob-url" });
      prefetches.set(url, { free: handle.free, asset });
      return handle
        .waitUntilDone()
        .then(() =>
          recordPreviewEvent({
            type: "load-complete",
            assetUrl: url,
            assetType: asset?.type,
            sceneId: asset?.sceneId,
          }),
        )
        .catch((error: unknown) =>
          recordPreviewEvent({
            type: "asset-error",
            assetUrl: url,
            assetType: asset?.type,
            sceneId: asset?.sceneId,
            detail: error instanceof Error ? error.message : "prefetch failed",
          }),
        );
    };

    let loaded = 0;
    const bump = () => {
      loaded += 1;
      if (!cancelled)
        setProgress((previous) => ({ ...previous, loadedCount: loaded }));
    };

    const initialLoads = [...initialUrls].map((url) => ensure(url).then(bump));

    void Promise.all([
      Promise.all(initialLoads),
      ensurePreviewFontsReady(fontFamily).then(() =>
        recordPreviewEvent({ type: "load-complete", assetType: "font" }),
      ),
    ]).then(() => {
      if (cancelled) return;
      recordPreviewEvent({ type: "initial-ready", detail: `${loaded} assets` });
      setProgress((previous) => ({ ...previous, ready: true }));
    });

    return () => {
      cancelled = true;
      for (const entry of prefetches.values()) entry.free();
      prefetches.clear();
    };
  }, [assets, initialUrls, fontFamily]);

  // Maintain the rolling window and report buffering as the playhead moves.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const fps = framesPerSecond > 0 ? framesPerSecond : 1;

    const reconcile = (currentFrame: number) => {
      if (assets.length === 0) return;
      const currentSeconds = currentFrame / fps;
      const desired = selectPreloadUrls({ assets, currentSeconds });

      const signature = [...desired].sort().join("|");
      if (signature === lastSignatureRef.current) return;
      lastSignatureRef.current = signature;

      const prefetches = prefetchesRef.current;
      for (const url of desired) {
        if (prefetches.has(url)) continue;
        const asset = assetByUrl(assets, url);
        recordPreviewEvent({
          type: "load-start",
          assetUrl: url,
          assetType: asset?.type,
          sceneId: asset?.sceneId,
          currentFrame,
        });
        const handle = prefetch(url, { method: "blob-url" });
        prefetches.set(url, { free: handle.free, asset });
        void handle
          .waitUntilDone()
          .then(() =>
            recordPreviewEvent({
              type: "load-complete",
              assetUrl: url,
              assetType: asset?.type,
              sceneId: asset?.sceneId,
              currentFrame,
            }),
          )
          .catch((error: unknown) =>
            recordPreviewEvent({
              type: "asset-error",
              assetUrl: url,
              assetType: asset?.type,
              sceneId: asset?.sceneId,
              detail:
                error instanceof Error ? error.message : "prefetch failed",
            }),
          );
      }
      for (const [url, entry] of prefetches) {
        if (desired.has(url) || keepUrlsRef.current.has(url)) continue;
        entry.free();
        prefetches.delete(url);
      }
      recordPreviewEvent({ type: "window-updated", currentFrame });
    };

    const onFrameUpdate = (event: { detail: { frame: number } }) => {
      reconcile(event.detail.frame);
    };
    const onWaiting = () => {
      recordPreviewEvent({
        type: "buffering-start",
        currentFrame: player.getCurrentFrame(),
      });
    };
    const onResume = () => {
      recordPreviewEvent({
        type: "buffering-end",
        currentFrame: player.getCurrentFrame(),
      });
    };

    player.addEventListener("frameupdate", onFrameUpdate);
    player.addEventListener("waiting", onWaiting);
    player.addEventListener("resume", onResume);
    reconcile(player.getCurrentFrame());

    return () => {
      player.removeEventListener("frameupdate", onFrameUpdate);
      player.removeEventListener("waiting", onWaiting);
      player.removeEventListener("resume", onResume);
    };
  }, [playerRef, framesPerSecond, assets, progress.ready]);

  return {
    ready: progress.ready,
    loadedCount: progress.loadedCount,
    totalCount,
  };
}
