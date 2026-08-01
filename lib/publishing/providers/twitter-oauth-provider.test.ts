import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TwitterOAuthProvider } from "@/lib/publishing/providers/twitter-oauth-provider";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";

const REDIRECT_URI = "https://vcstudio.example/api/x/callback";

const provider = () =>
  new TwitterOAuthProvider({
    clientId: "client-id",
    clientSecret: "client-secret",
  });

afterEach(() => vi.restoreAllMocks());

describe("TwitterOAuthProvider", () => {
  it("requests the scopes posting actually needs, including offline access", () => {
    const url = new URL(
      provider().createAuthorizationUrl({
        state: "signed-state",
        redirectUri: REDIRECT_URI,
      }),
    );
    const scopes = url.searchParams.get("scope")?.split(" ") ?? [];
    expect(url.origin).toBe("https://x.com");
    expect(scopes).toContain("tweet.write");
    // Attaching media is a separate grant; without it every post with an image
    // fails at upload rather than at consent.
    expect(scopes).toContain("media.write");
    // Without offline access no refresh token is issued and the connection dies
    // after roughly two hours, taking every later scheduled post with it.
    expect(scopes).toContain("offline.access");
  });

  it("sends an S256 challenge, never the verifier itself", () => {
    const url = new URL(
      provider().createAuthorizationUrl({
        state: "signed-state",
        redirectUri: REDIRECT_URI,
      }),
    );
    const challenge = url.searchParams.get("code_challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(challenge).toBeTruthy();
    expect(url.searchParams.get("code_verifier")).toBeNull();
    // The challenge must be the hash of something, not the something.
    expect(challenge).not.toBe("signed-state");
  });

  it("derives a verifier that matches the challenge it advertised", async () => {
    const instance = provider();
    const authorizeUrl = new URL(
      instance.createAuthorizationUrl({
        state: "signed-state",
        redirectUri: REDIRECT_URI,
      }),
    );

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 7200,
          scope: "tweet.read tweet.write users.read media.write offline.access",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { id: "1234", name: "Studio", username: "vcstudio" },
        }),
      );

    await instance.exchangeCode({
      code: "code",
      redirectUri: REDIRECT_URI,
      state: "signed-state",
    });

    const body = fetchSpy.mock.calls[0]?.[1]?.body as URLSearchParams;
    const verifier = body.get("code_verifier") ?? "";
    // The whole point of PKCE: what is redeemed must hash to what was promised.
    expect(createHash("sha256").update(verifier).digest("base64url")).toBe(
      authorizeUrl.searchParams.get("code_challenge"),
    );
  });

  it("derives a different verifier for a different flow", () => {
    const instance = provider();
    const first = new URL(
      instance.createAuthorizationUrl({
        state: "state-one",
        redirectUri: REDIRECT_URI,
      }),
    ).searchParams.get("code_challenge");
    const second = new URL(
      instance.createAuthorizationUrl({
        state: "state-two",
        redirectUri: REDIRECT_URI,
      }),
    ).searchParams.get("code_challenge");
    expect(first).not.toBe(second);
  });

  it("refuses to exchange without the originating state", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      provider().exchangeCode({ code: "code", redirectUri: REDIRECT_URI }),
    ).rejects.toBeInstanceOf(PublishProviderError);
    // No verifier means no redeemable request; it must not be attempted.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolves the connected account and its public URL", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 7200,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { id: "1234", name: "Studio", username: "vcstudio" },
        }),
      );

    const result = await provider().exchangeCode({
      code: "code",
      redirectUri: REDIRECT_URI,
      state: "signed-state",
    });

    expect(result.account).toEqual({
      externalAccountId: "1234",
      externalAccountName: "Studio",
      externalAccountUrl: "https://x.com/vcstudio",
    });
    expect(result.tokens.refreshToken).toBe("refresh-token");
    expect(result.tokens.expiresAt).toBeInstanceOf(Date);
  });

  it("reports a refused authorization as non-retriable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ error: "invalid_grant" }, { status: 400 }),
    );
    const error = await provider()
      .exchangeCode({
        code: "code",
        redirectUri: REDIRECT_URI,
        state: "signed-state",
      })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PublishProviderError);
    expect((error as PublishProviderError).failure.retriable).toBe(false);
  });

  it("keeps the rotated refresh token X returns", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        access_token: "next-access",
        refresh_token: "next-refresh",
        expires_in: 7200,
      }),
    );
    const tokens = await provider().refreshTokens({
      refreshToken: "previous-refresh",
    });
    // X invalidates the old token on use, so carrying it forward would break
    // the refresh after this one.
    expect(tokens.refreshToken).toBe("next-refresh");
  });

  it("falls back to the presented refresh token when X returns none", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ access_token: "next-access", expires_in: 7200 }),
    );
    const tokens = await provider().refreshTokens({
      refreshToken: "previous-refresh",
    });
    expect(tokens.refreshToken).toBe("previous-refresh");
  });

  it("classifies a failed refresh as expired authorization", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ error: "invalid_request" }, { status: 400 }),
    );
    const error = await provider()
      .refreshTokens({ refreshToken: "dead" })
      .catch((caught: unknown) => caught);
    expect((error as PublishProviderError).failure.category).toBe(
      "authorization_expired",
    );
  });

  it("never lets a failed revoke block disconnecting", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("network down"),
    );
    await expect(
      provider().revokeAuthorization({ accessToken: "access-token" }),
    ).resolves.toBeUndefined();
  });
});
