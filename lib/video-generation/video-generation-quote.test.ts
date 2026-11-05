import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  createVideoQuote,
  verifyVideoQuote,
  videoRequestDigest,
} from "./video-generation-quote";
import {
  syntheticVideoModel,
  syntheticVideoPricing,
  syntheticVideoRequest,
} from "./video-generation-fixtures";

const context = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  request: syntheticVideoRequest,
  model: syntheticVideoModel,
  pricing: syntheticVideoPricing,
  assetsDigest: videoRequestDigest([]),
  maximumCostCents: 11,
  secret: "synthetic-signing-secret-of-at-least-32-characters",
  now: new Date("2026-11-05T10:00:00Z"),
};
describe("signed generation estimate", () => {
  it("binds the user/workspace/request/assets/model/pricing and exact reservation", () => {
    const quote = createVideoQuote(context);
    expect(
      verifyVideoQuote({ ...context, token: quote.token }).maximumCostCents,
    ).toBe(11);
    for (const changed of [
      { workspaceId: context.userId },
      { userId: context.workspaceId },
      { request: { ...context.request, prompt: "Different cinematic scene" } },
      { assetsDigest: videoRequestDigest(["changed"]) },
      { model: { ...context.model, version: "changed" } },
      { pricing: { ...context.pricing, revision: "changed" } },
      { maximumCostCents: 1 },
    ])
      expect(() =>
        verifyVideoQuote({ ...context, ...changed, token: quote.token }),
      ).toThrow();
  });
  it("rejects expired, modified and unsigned estimates", () => {
    const quote = createVideoQuote(context);
    expect(() =>
      verifyVideoQuote({
        ...context,
        token: quote.token,
        now: new Date("2026-11-05T10:10:00Z"),
      }),
    ).toThrow("expired");
    expect(() =>
      verifyVideoQuote({ ...context, token: quote.token + "x" }),
    ).toThrow();
    expect(() =>
      verifyVideoQuote({ ...context, token: "confirmed:true" }),
    ).toThrow();
    expect(() =>
      verifyVideoQuote({
        ...context,
        token: quote.token,
        secret: "different-signing-secret-of-32-characters",
      }),
    ).toThrow();
  });
  it("does not put raw prompts, asset keys or pricing configuration in tokens", () => {
    const quote = createVideoQuote(context);
    const payload = Buffer.from(
      quote.token.split(".")[0]!,
      "base64url",
    ).toString("utf8");
    expect(payload).not.toContain(context.request.prompt);
    expect(payload).not.toContain("providerModelId");
    expect(payload).not.toContain(context.secret);
    expect(videoRequestDigest({ b: 2, a: 1 })).toBe(
      videoRequestDigest({ a: 1, b: 2 }),
    );
  });
});
