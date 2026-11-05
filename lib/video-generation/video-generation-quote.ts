import "server-only";
import {
  createHmac,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { z } from "zod";
import {
  type VideoGenerationRequest,
  type VideoModelDescriptor,
  type VideoModelPricing,
} from "@studio/contracts/video";

const MAX_QUOTE_SECONDS = 600;
const quoteSchema = z
  .object({
    version: z.literal(1),
    workspaceId: z.uuid(),
    userId: z.uuid(),
    quoteId: z.uuid(),
    requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
    assetsDigest: z.string().regex(/^[a-f0-9]{64}$/),
    modelDigest: z.string().regex(/^[a-f0-9]{64}$/),
    pricingDigest: z.string().regex(/^[a-f0-9]{64}$/),
    maximumCostCents: z.number().int().positive().max(100_000_000),
    issuedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .strict();

export class InvalidVideoQuoteError extends Error {
  constructor(
    readonly code: "quote_invalid" | "quote_expired" | "quote_changed",
  ) {
    super(
      code === "quote_expired"
        ? "This estimate expired. Get a new estimate before generating."
        : code === "quote_changed"
          ? "The request, assets or pricing changed. Get a fresh estimate."
          : "This estimate could not be verified.",
    );
    this.name = "InvalidVideoQuoteError";
  }
}

/** Stable structured digest; no credentials or object keys enter the token. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  return value;
}
export function videoRequestDigest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

type QuoteContext = {
  workspaceId: string;
  userId: string;
  request: VideoGenerationRequest;
  assetsDigest: string;
  model: VideoModelDescriptor;
  pricing: VideoModelPricing;
  maximumCostCents: number;
};
function contextDigests(input: QuoteContext) {
  return {
    workspaceId: input.workspaceId,
    userId: input.userId,
    requestDigest: videoRequestDigest(input.request),
    assetsDigest: input.assetsDigest,
    modelDigest: videoRequestDigest(input.model),
    pricingDigest: videoRequestDigest(input.pricing),
    maximumCostCents: input.maximumCostCents,
  };
}
function assertSecret(secret: string) {
  if (secret.length < 32)
    throw new Error("A signing secret of at least 32 characters is required.");
}

export function createVideoQuote(
  input: QuoteContext & { secret: string; now?: Date },
) {
  assertSecret(input.secret);
  const now = input.now ?? new Date();
  const quote = quoteSchema.parse({
    version: 1,
    quoteId: randomUUID(),
    ...contextDigests(input),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + MAX_QUOTE_SECONDS * 1000).toISOString(),
  });
  const payload = Buffer.from(JSON.stringify(quote)).toString("base64url");
  const signature = createHmac("sha256", input.secret)
    .update(payload)
    .digest("base64url");
  return {
    token: `${payload}.${signature}`,
    quoteId: quote.quoteId,
    expiresAt: quote.expiresAt,
    maximumCostCents: quote.maximumCostCents,
  };
}

export function verifyVideoQuote(
  input: QuoteContext & { secret: string; token: string; now?: Date },
) {
  assertSecret(input.secret);
  if (
    input.token.length > 12_000 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(input.token)
  )
    throw new InvalidVideoQuoteError("quote_invalid");
  const [payload, signature] = input.token.split(".");
  if (!payload || !signature) throw new InvalidVideoQuoteError("quote_invalid");
  const expected = createHmac("sha256", input.secret).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (
    received.toString("base64url") !== signature ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw new InvalidVideoQuoteError("quote_invalid");
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new InvalidVideoQuoteError("quote_invalid");
  }
  const parsed = quoteSchema.safeParse(value);
  if (!parsed.success) throw new InvalidVideoQuoteError("quote_invalid");
  const quote = parsed.data;
  const now = (input.now ?? new Date()).getTime();
  const issued = Date.parse(quote.issuedAt);
  const expires = Date.parse(quote.expiresAt);
  if (!Number.isFinite(now)) throw new InvalidVideoQuoteError("quote_invalid");
  if (expires <= now) throw new InvalidVideoQuoteError("quote_expired");
  if (
    issued > now + 30_000 ||
    expires <= issued ||
    expires - issued > MAX_QUOTE_SECONDS * 1000
  )
    throw new InvalidVideoQuoteError("quote_invalid");
  const signedContext = {
    workspaceId: quote.workspaceId,
    userId: quote.userId,
    requestDigest: quote.requestDigest,
    assetsDigest: quote.assetsDigest,
    modelDigest: quote.modelDigest,
    pricingDigest: quote.pricingDigest,
    maximumCostCents: quote.maximumCostCents,
  };
  if (
    videoRequestDigest(contextDigests(input)) !==
    videoRequestDigest(signedContext)
  )
    throw new InvalidVideoQuoteError("quote_changed");
  return quote;
}
