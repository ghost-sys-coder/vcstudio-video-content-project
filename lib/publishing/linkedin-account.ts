import { z } from "zod";

export const linkedInOrganizationUrnSchema = z
  .string()
  .regex(/^urn:li:organization:[1-9]\d*$/);
const personIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const personUrnSchema = z
  .string()
  .regex(/^urn:li:person:[A-Za-z0-9_-]{1,128}$/);

/** Canonical organization IDs also identify the dedicated Pages OAuth app. */
export function resolveLinkedInAccount(externalAccountId: string): {
  kind: "page" | "profile";
  authorUrn: string;
} {
  if (linkedInOrganizationUrnSchema.safeParse(externalAccountId).success)
    return { kind: "page", authorUrn: externalAccountId };
  if (personUrnSchema.safeParse(externalAccountId).success)
    return { kind: "profile", authorUrn: externalAccountId };
  if (personIdSchema.safeParse(externalAccountId).success)
    return { kind: "profile", authorUrn: `urn:li:person:${externalAccountId}` };
  throw new Error("The LinkedIn account identifier is invalid.");
}
