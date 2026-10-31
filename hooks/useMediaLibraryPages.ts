"use client";

import { useRef, useState } from "react";
import { getMediaLibraryPageAction } from "@/app/(authenticated)/app/social/library-actions";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import { mergeMediaAssets } from "@/lib/media/merge-media-assets";

/** No mount-time fetch: a dialog explicitly requests its first or next page. */
export function useMediaLibraryPages(kind?: "image" | "video") {
  const [state, setState] = useState<{
    assets: MediaAssetView[];
    nextCursor: string | null;
    loading: boolean;
    loaded: boolean;
    error: string | null;
  }>({
    assets: [],
    nextCursor: null,
    loading: false,
    loaded: false,
    error: null,
  });
  const sequence = useRef(0);
  const busy = useRef(false);

  async function load(reset: boolean) {
    if (busy.current && !reset) return;
    busy.current = true;
    const requestId = ++sequence.current;
    const cursor = reset ? undefined : (state.nextCursor ?? undefined);
    setState((current) => ({
      ...current,
      ...(reset ? { assets: [], loaded: false, nextCursor: null } : {}),
      loading: true,
      error: null,
    }));
    try {
      const result = await getMediaLibraryPageAction({ kind, cursor });
      if (requestId !== sequence.current) return;
      if (!result.ok) {
        setState((current) => ({
          ...current,
          loading: false,
          error: result.error,
        }));
        return;
      }
      setState((current) => ({
        assets: reset
          ? result.view.assets
          : mergeMediaAssets(current.assets, result.view.assets),
        nextCursor: result.view.nextCursor ?? null,
        loading: false,
        loaded: true,
        error: null,
      }));
    } catch {
      if (requestId === sequence.current)
        setState((current) => ({
          ...current,
          loading: false,
          error: "The media library could not be loaded. Please try again.",
        }));
    } finally {
      if (requestId === sequence.current) busy.current = false;
    }
  }

  return {
    ...state,
    loadFirst: () => load(true),
    loadMore: () => load(false),
    cancel: () => {
      sequence.current++;
      busy.current = false;
    },
  };
}
