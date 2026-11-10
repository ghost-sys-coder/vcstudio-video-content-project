"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { elevenLabsVoicesPageSchema } from "@studio/contracts/voice-preset";
async function fetchVoicePage(cursor?: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/elevenlabs/voices${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    { signal },
  );
  const body: unknown = await response.json();
  if (!response.ok) {
    const failure = z.object({ error: z.string() }).safeParse(body);
    throw new Error(
      failure.success ? failure.data.error : "Voices could not be loaded.",
    );
  }
  return elevenLabsVoicesPageSchema.parse(body);
}
export function useElevenLabsVoices(
  onVoiceChange: (v: string) => void,
  onModelChange: (v: string) => void,
) {
  const [voices, setVoices] = useState<Array<{ id: string; name: string }>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const accept = useCallback(
    (page: z.infer<typeof elevenLabsVoicesPageSchema>, more: boolean) => {
      setVoices((current) =>
        more
          ? [
              ...current,
              ...page.voices.filter((v) => !current.some((c) => c.id === v.id)),
            ]
          : page.voices,
      );
      setCursor(page.nextCursor);
      onModelChange(page.model);
      if (!more && page.voices[0]) onVoiceChange(page.voices[0].id);
    },
    [onVoiceChange, onModelChange],
  );
  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    void fetchVoicePage(undefined, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) accept(page, false);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Voices could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false);
      });
    return () => controller.abort();
  }, [accept]);
  async function loadMore() {
    if (pending || !active.current || active.current.signal.aborted) return;
    const signal = active.current.signal;
    setPending(true);
    setError(null);
    try {
      const page = await fetchVoicePage(cursor ?? undefined, signal);
      if (!signal.aborted) accept(page, !!cursor);
    } catch (e) {
      if (!signal.aborted)
        setError(
          e instanceof Error ? e.message : "Voices could not be loaded.",
        );
    } finally {
      if (!signal.aborted) setPending(false);
    }
  }
  return { voices, cursor, pending, error, loadMore };
}
