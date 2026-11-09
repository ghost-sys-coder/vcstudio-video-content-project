"use client";
import { useEffect, useEffectEvent, useState } from "react";
import {
  checkLibraryInspectionsAction,
  retryLibraryInspectionAction,
} from "@/app/(authenticated)/app/social/inspection-actions";
import type { MediaAssetView } from "@/lib/media/media-asset-view";

export function useLibraryInspectionQueue(input: {
  initialAssets: MediaAssetView[];
  onReady: (assets: MediaAssetView[]) => void;
}) {
  const [items, setItems] = useState(input.initialAssets);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [until, setUntil] = useState(() => Date.now() + 120_000);
  const ids = items
    .filter((asset) => asset.inspectionPending)
    .map((asset) => asset.id)
    .slice(0, 12)
    .join(",");
  function apply(assets: MediaAssetView[]) {
    const ready = assets.filter(
      (asset) => !asset.inspectionPending && !asset.inspectionFailed,
    );
    setItems((current) =>
      current.flatMap((asset) => {
        const update = assets.find((a) => a.id === asset.id);
        return !update
          ? [asset]
          : ready.some((a) => a.id === asset.id)
            ? []
            : [update];
      }),
    );
    if (ready.length) input.onReady(ready);
  }
  async function check(assetIds: string[]) {
    setError(null);
    try {
      const result = await checkLibraryInspectionsAction(assetIds);
      if (result.ok) apply(result.assets);
      else setError(result.error);
    } catch {
      setError("Status could not be checked. Please try again.");
    }
  }
  const automaticCheck = useEffectEvent(async (assetIds: string[]) => {
    if (!busyId) await check(assetIds);
  });
  useEffect(() => {
    if (!ids) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      if (stopped || Date.now() >= until) return;
      if (document.visibilityState === "visible")
        await automaticCheck(ids.split(","));
      if (!stopped) timer = setTimeout(() => void tick(), 10_000);
    }
    timer = setTimeout(() => void tick(), 5000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [ids, until]);
  return {
    items,
    error,
    busyId,
    add: (assets: MediaAssetView[]) => {
      setUntil(Date.now() + 120_000);
      setItems((current) => [
        ...assets,
        ...current.filter((a) => !assets.some((b) => a.id === b.id)),
      ]);
    },
    check: async (id: string) => {
      if (busyId) return;
      setBusyId(id);
      try {
        await check([id]);
      } finally {
        setBusyId(null);
      }
    },
    retry: async (id: string) => {
      if (busyId) return;
      setBusyId(id);
      setError(null);
      try {
        const result = await retryLibraryInspectionAction(id);
        if (result.ok) {
          apply(result.assets);
          setUntil(Date.now() + 120_000);
        } else setError(result.error);
      } catch {
        setError(
          "Verification could not be restarted. Check status and try again.",
        );
      } finally {
        setBusyId(null);
      }
    },
  };
}
