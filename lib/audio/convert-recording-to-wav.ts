"use client";

import { encodeMonoWav } from "@/lib/audio/encode-wav";

/** Google's recommended rate for a replication clip. */
export const VOICE_REPLICATION_SAMPLE_RATE = 24_000;

/**
 * Re-encodes a finished browser recording as 24 kHz mono 16-bit WAV.
 *
 * Decoding happens only once recording has stopped: Chromium cannot decode a
 * partial WebM, but reads a complete one. Mixing to one channel and
 * resampling are done by an `OfflineAudioContext`, which renders faster than
 * real time and never touches the speakers.
 */
export async function convertRecordingToWav(recording: Blob): Promise<Blob> {
  const decodingContext = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodingContext.decodeAudioData(
      await recording.arrayBuffer(),
    );
  } finally {
    await decodingContext.close().catch(() => undefined);
  }

  const frames = Math.max(
    1,
    Math.ceil(decoded.duration * VOICE_REPLICATION_SAMPLE_RATE),
  );
  const offline = new OfflineAudioContext(
    1,
    frames,
    VOICE_REPLICATION_SAMPLE_RATE,
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  return new Blob(
    [encodeMonoWav(rendered.getChannelData(0), VOICE_REPLICATION_SAMPLE_RATE)],
    { type: "audio/wav" },
  );
}
