import "server-only";

import { z } from "zod";
import {
  getPublishingEnvironment,
  getPublishingWebEnvironment,
} from "@/lib/env/server";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().default(""),
});

const accountSchema = z.object({
  name: z.string().min(1),
  accountName: z.string().default(""),
});

const accountsResponseSchema = z.object({
  accounts: z.array(accountSchema).default([]),
  nextPageToken: z.string().optional(),
});

const locationSchema = z.object({
  name: z.string().min(1),
  title: z.string().default(""),
  storeCode: z.string().default(""),
  websiteUri: z.string().default(""),
  phoneNumbers: z
    .object({
      primaryPhone: z.string().optional(),
      additionalPhones: z.array(z.string()).optional(),
    })
    .optional(),
  categories: z
    .object({
      primaryCategory: z
        .object({ displayName: z.string().optional() })
        .optional(),
      additionalCategories: z
        .array(z.object({ displayName: z.string().optional() }))
        .optional(),
    })
    .optional(),
  profile: z.object({ description: z.string().optional() }).optional(),
  storefrontAddress: z
    .object({
      addressLines: z.array(z.string()).optional(),
      locality: z.string().optional(),
      administrativeArea: z.string().optional(),
      postalCode: z.string().optional(),
      regionCode: z.string().optional(),
    })
    .optional(),
  regularHours: z
    .object({
      periods: z.array(
        z.object({
          openDay: z.string().optional(),
          openTime: z
            .object({
              hours: z.number().optional(),
              minutes: z.number().optional(),
            })
            .optional(),
          closeDay: z.string().optional(),
          closeTime: z
            .object({
              hours: z.number().optional(),
              minutes: z.number().optional(),
            })
            .optional(),
        }),
      ),
    })
    .optional(),
  serviceArea: z
    .object({
      places: z
        .object({
          placeInfos: z
            .array(z.object({ placeName: z.string().optional() }))
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

const locationsResponseSchema = z.object({
  locations: z.array(locationSchema).default([]),
  nextPageToken: z.string().optional(),
});

export type GoogleBusinessTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
};

export type GoogleBusinessLocationProfile = z.infer<typeof locationSchema> & {
  accountName: string;
  accountDisplayName: string;
};

export class GoogleBusinessProviderError extends Error {
  constructor(
    readonly category: "configuration" | "authorization" | "quota" | "provider",
    readonly safeMessage: string,
  ) {
    super(safeMessage);
    this.name = "GoogleBusinessProviderError";
  }
}

function configuredScope(): string {
  const environment = getPublishingEnvironment();
  const scope =
    environment.GOOGLE_BUSINESS_SCOPE ?? environment.GOOGLE_BUSINESS_SCOPES;
  if (
    !scope
      ?.split(/\s+/)
      .includes("https://www.googleapis.com/auth/business.manage")
  )
    throw new GoogleBusinessProviderError(
      "configuration",
      "Google Business Profile access is not configured correctly.",
    );
  return scope;
}

function credentials(): { clientId: string; clientSecret: string } {
  const environment = getPublishingEnvironment();
  if (
    !environment.GOOGLE_OAUTH_CLIENT_ID ||
    !environment.GOOGLE_OAUTH_CLIENT_SECRET
  )
    throw new GoogleBusinessProviderError(
      "configuration",
      "Google Business Profile OAuth credentials are not configured.",
    );
  return {
    clientId: environment.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: environment.GOOGLE_OAUTH_CLIENT_SECRET,
  };
}

async function providerJson(response: Response): Promise<unknown> {
  if (response.ok) return response.json();
  if (response.status === 401 || response.status === 403)
    throw new GoogleBusinessProviderError(
      "authorization",
      "Google Business Profile authorization expired or lacks access.",
    );
  if (response.status === 429)
    throw new GoogleBusinessProviderError(
      "quota",
      "Google Business Profile quota is temporarily exhausted.",
    );
  throw new GoogleBusinessProviderError(
    "provider",
    "Google Business Profile could not be reached.",
  );
}

export function createGoogleBusinessRedirectUri(): string {
  return new URL(
    "/api/google-business/callback",
    getPublishingWebEnvironment().APP_BASE_URL,
  ).toString();
}

export function createGoogleBusinessAuthorizationUrl(state: string): string {
  const { clientId } = credentials();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", createGoogleBusinessRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", configuredScope());
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleBusinessCode(
  code: string,
): Promise<GoogleBusinessTokens> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: createGoogleBusinessRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const parsed = tokenResponseSchema.parse(await providerJson(response));
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? null,
    expiresAt: new Date(Date.now() + parsed.expires_in * 1000),
    scopes: parsed.scope.split(/\s+/).filter(Boolean),
  };
}

export async function refreshGoogleBusinessToken(
  refreshToken: string,
): Promise<GoogleBusinessTokens> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const parsed = tokenResponseSchema.parse(await providerJson(response));
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + parsed.expires_in * 1000),
    scopes: parsed.scope.split(/\s+/).filter(Boolean),
  };
}

export async function listGoogleBusinessLocations(
  accessToken: string,
): Promise<GoogleBusinessLocationProfile[]> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-GOOG-API-FORMAT-VERSION": "2",
  };
  const accounts: z.infer<typeof accountSchema>[] = [];
  let accountPageToken: string | undefined;
  do {
    const accountsUrl = new URL(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    );
    accountsUrl.searchParams.set("pageSize", "20");
    if (accountPageToken)
      accountsUrl.searchParams.set("pageToken", accountPageToken);
    const accountPage = accountsResponseSchema.parse(
      await providerJson(await fetch(accountsUrl, { headers })),
    );
    accounts.push(...accountPage.accounts);
    accountPageToken = accountPage.nextPageToken;
  } while (accountPageToken);
  const profiles: GoogleBusinessLocationProfile[] = [];
  const readMask = [
    "name",
    "title",
    "storeCode",
    "phoneNumbers",
    "categories",
    "storefrontAddress",
    "websiteUri",
    "regularHours",
    "serviceArea",
    "profile",
  ].join(",");
  for (const account of accounts) {
    let pageToken: string | undefined;
    do {
      const url = new URL(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
      );
      url.searchParams.set("readMask", readMask);
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const page = locationsResponseSchema.parse(
        await providerJson(await fetch(url, { headers })),
      );
      profiles.push(
        ...page.locations.map((location) => ({
          ...location,
          accountName: account.name,
          accountDisplayName: account.accountName,
        })),
      );
      pageToken = page.nextPageToken;
    } while (pageToken);
  }
  return profiles;
}
