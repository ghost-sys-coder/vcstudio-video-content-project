import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { GeminiVoiceCloningClient } from "@/lib/speech/providers/gemini-voice-cloning";
import { SpeechProviderRequestError } from "@/lib/speech/speech-provider";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function client(fetcher: typeof fetch) {
  return new GeminiVoiceCloningClient({
    apiKey: "test-key",
    model: "gemini-3.8-flash-tts",
    fetcher,
  });
}

const recordings = {
  displayName: "Frank narration",
  sourceAudio: { bytes: Buffer.from("sample-audio"), contentType: "audio/wav" },
  consentAudio: {
    bytes: Buffer.from("consent-audio"),
    contentType: "audio/wav",
  },
};

function body(fetcher: ReturnType<typeof vi.fn>, call = 0) {
  const init = (
    fetcher.mock.calls[call] as unknown as [string, RequestInit]
  )[1];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("createReplicatedVoice", () => {
  it("sends both recordings, base64 encoded, with their types", async () => {
    const fetcher = vi.fn(async () => json({ id: "voice_abc123" }));
    await client(fetcher as unknown as typeof fetch).createReplicatedVoice(
      recordings,
    );

    const sent = body(fetcher) as {
      voice: {
        replicated: Record<string, { data: string; mime_type: string }>;
      };
    };
    expect(sent.voice.replicated.source_audio?.data).toBe(
      Buffer.from("sample-audio").toString("base64"),
    );
    expect(sent.voice.replicated.consent_audio?.data).toBe(
      Buffer.from("consent-audio").toString("base64"),
    );
    expect(sent.voice.replicated.consent_audio?.mime_type).toBe("audio/wav");
  });

  it("asks Google to keep the voice by default", async () => {
    const fetcher = vi.fn(async () => json({ id: "voice_abc123" }));
    const voice = await client(
      fetcher as unknown as typeof fetch,
    ).createReplicatedVoice(recordings);
    expect(body(fetcher).store).toBe(true);
    expect(voice.stored).toBe(true);
    expect(voice.id).toBe("voice_abc123");
  });

  // A stateless key stops working after a week, which would silently break
  // every scene narrated with it, so it has to be asked for explicitly.
  it("only goes stateless when asked", async () => {
    const fetcher = vi.fn(async () => json({ key: "voicekey_xyz" }));
    const voice = await client(
      fetcher as unknown as typeof fetch,
    ).createReplicatedVoice({ ...recordings, store: false });
    expect(body(fetcher).store).toBe(false);
    expect(voice.id).toBe("voicekey_xyz");
    expect(voice.stored).toBe(false);
  });

  it("reads the identifier out of a resource name when that is all there is", async () => {
    const fetcher = vi.fn(async () => json({ name: "voices/voice_from_name" }));
    const voice = await client(
      fetcher as unknown as typeof fetch,
    ).createReplicatedVoice(recordings);
    expect(voice.id).toBe("voice_from_name");
  });

  it("fails loudly when a voice comes back with no identifier", async () => {
    const fetcher = vi.fn(async () => json({ display_name: "Nameless" }));
    await expect(
      client(fetcher as unknown as typeof fetch).createReplicatedVoice(
        recordings,
      ),
    ).rejects.toThrow(/no identifier/i);
  });

  // The most likely real failure, and the one where a generic message would
  // send someone re-recording the wrong clip.
  it("explains a refused consent clip in terms of the recordings", async () => {
    const fetcher = vi.fn(async () => new Response("bad", { status: 400 }));
    const error = await client(fetcher as unknown as typeof fetch)
      .createReplicatedVoice(recordings)
      .catch((caught: unknown) => caught);
    expect((error as Error).message).toMatch(/consent clip/i);
    expect((error as Error).message).toMatch(/same voice and setting/i);
  });

  it("never lets the provider body reach the message", async () => {
    const fetcher = vi.fn(
      async () => new Response("audio blob and account id", { status: 403 }),
    );
    const error = await client(fetcher as unknown as typeof fetch)
      .createReplicatedVoice(recordings)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SpeechProviderRequestError);
    expect((error as Error).message).not.toContain("account id");
  });

  it("refuses to be built without a key", () => {
    expect(
      () =>
        new GeminiVoiceCloningClient({
          apiKey: "",
          model: "gemini-3.8-flash-tts",
        }),
    ).toThrow(RangeError);
  });
});

describe("listVoices", () => {
  it("returns the stored voices with their identifiers", async () => {
    const fetcher = vi.fn(async () =>
      json({
        voices: [
          { id: "voice_a", display_name: "One" },
          { name: "voices/voice_b" },
          { display_name: "No id at all" },
        ],
      }),
    );
    const voices = await client(
      fetcher as unknown as typeof fetch,
    ).listVoices();
    expect(voices.map((voice) => voice.id)).toEqual(["voice_a", "voice_b"]);
  });

  it("copes with an account that has none", async () => {
    const fetcher = vi.fn(async () => json({}));
    await expect(
      client(fetcher as unknown as typeof fetch).listVoices(),
    ).resolves.toEqual([]);
  });
});

describe("deleteVoice", () => {
  it("asks Google to forget it", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    await client(fetcher as unknown as typeof fetch).deleteVoice("voice_abc");
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/voices/voice_abc");
    expect(init.method).toBe("DELETE");
  });

  // The outcome the caller asked for is the outcome they have.
  it("treats an already-deleted voice as deleted", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 404 }));
    await expect(
      client(fetcher as unknown as typeof fetch).deleteVoice("voice_gone"),
    ).resolves.toBeUndefined();
  });

  it("still reports a real failure", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 500 }));
    await expect(
      client(fetcher as unknown as typeof fetch).deleteVoice("voice_abc"),
    ).rejects.toBeInstanceOf(SpeechProviderRequestError);
  });
});
