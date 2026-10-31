import "server-only";

import { z } from "zod";
import { linkedInOrganizationUrnSchema } from "@/lib/publishing/linkedin-account";
import type { PlatformAccount } from "@/lib/publishing/platform-oauth-provider";
import { LinkedInOAuthClient } from "@/lib/publishing/providers/linkedin-oauth-client";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";
import { linkedInPagesCursorSchema } from "@/lib/schemas/linkedin-pages";
import { LINKEDIN_PAGES_PAGE_SIZE } from "@/lib/publishing/linkedin-pages-navigation";

const memberUrnSchema = z
  .string()
  .regex(/^urn:li:person:[A-Za-z0-9_-]{1,128}$/);
const aclPageSchema = z.object({
  elements: z
    .array(
      z.object({
        role: z.string(),
        state: z.string(),
        organization: z.string().optional(),
        organizationTarget: z.string().optional(),
        roleAssignee: z.string(),
      }),
    )
    .max(LINKEDIN_PAGES_PAGE_SIZE),
  paging: z
    .object({
      links: z.array(z.object({ rel: z.string() })).optional(),
      total: z.number().int().nonnegative().optional(),
    })
    .optional(),
});
const organizationSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().regex(/^[1-9]\d*$/)]),
  localizedName: z.string().min(1),
  vanityName: z.string().optional(),
});
const authorizationSchema = z.object({
  impersonator: memberUrnSchema,
  organization: linkedInOrganizationUrnSchema,
  status: z.object({
    "com.linkedin.organization.Approved": z.object({}).optional(),
    "com.linkedin.organization.Denied": z.unknown().optional(),
  }),
});

export type LinkedInPage = PlatformAccount & { memberUrn: string };
export type LinkedInPagesResult = {
  pages: LinkedInPage[];
  start: number;
  nextStart: number | null;
};

function failure(): never {
  throw new PublishProviderError({
    category: "insufficient_permissions",
    safeMessage:
      "LinkedIn Pages could not be read. Check Community Management API access and your Page role, then reconnect.",
    retriable: false,
    mayHavePublished: false,
  });
}

/** Dedicated Community Management app: no Share on LinkedIn or OpenID product. */
export class LinkedInPagesProvider extends LinkedInOAuthClient {
  constructor(
    private readonly configuration: {
      clientId: string;
      clientSecret: string;
      apiVersion: string;
    },
  ) {
    super({
      ...configuration,
      scopes: ["rw_organization_admin", "w_organization_social"],
      requiredScopes: ["rw_organization_admin", "w_organization_social"],
    });
  }

  private async read(path: string, accessToken: string): Promise<unknown> {
    const response = await fetch(`https://api.linkedin.com/rest/${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "LinkedIn-Version": this.configuration.apiVersion,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) failure();
    return response.json().catch(() => failure());
  }

  async listPages(input: {
    accessToken: string;
    start?: number;
  }): Promise<LinkedInPagesResult> {
    const start = linkedInPagesCursorSchema.parse(input.start ?? 0);
    const query = new URLSearchParams({
      q: "roleAssignee",
      role: "ADMINISTRATOR",
      state: "APPROVED",
      count: String(LINKEDIN_PAGES_PAGE_SIZE),
      start: String(start),
    });
    const parsed = aclPageSchema.safeParse(
      await this.read(`organizationAcls?${query}`, input.accessToken),
    );
    if (!parsed.success) failure();
    const candidates = new Map<string, string>();
    for (const acl of parsed.data.elements) {
      const organization = acl.organizationTarget ?? acl.organization;
      if (
        acl.state === "APPROVED" &&
        acl.role === "ADMINISTRATOR" &&
        organization &&
        linkedInOrganizationUrnSchema.safeParse(organization).success &&
        memberUrnSchema.safeParse(acl.roleAssignee).success
      )
        candidates.set(organization, acl.roleAssignee);
    }
    const pages = await Promise.all(
      [...candidates].map(async ([urn, memberUrn]): Promise<LinkedInPage> => {
        const id = urn.slice("urn:li:organization:".length);
        const organization = organizationSchema.safeParse(
          await this.read(`organizations/${id}`, input.accessToken),
        );
        if (!organization.success || String(organization.data.id) !== id)
          failure();
        return {
          externalAccountId: urn,
          externalAccountName: organization.data.localizedName,
          externalAccountUrl: organization.data.vanityName
            ? `https://www.linkedin.com/company/${encodeURIComponent(organization.data.vanityName)}/`
            : `https://www.linkedin.com/company/${id}/`,
          memberUrn,
        };
      }),
    );
    const hasNext =
      parsed.data.paging?.links?.some((link) => link.rel === "next") ||
      (parsed.data.paging?.total ?? 0) > start + LINKEDIN_PAGES_PAGE_SIZE;
    return {
      pages,
      start,
      nextStart:
        hasNext && start < 10_000 ? start + LINKEDIN_PAGES_PAGE_SIZE : null,
    };
  }

  async assertCanPublish(input: {
    accessToken: string;
    page: LinkedInPage;
  }): Promise<void> {
    const organization = linkedInOrganizationUrnSchema.parse(
      input.page.externalAccountId,
    );
    const member = memberUrnSchema.parse(input.page.memberUrn);
    const path = `organizationAuthorizations/(impersonator:${encodeURIComponent(member)},organization:${encodeURIComponent(organization)},action:(organizationContentAuthorizationAction:(actionType:ORGANIC_SHARE_CREATE)))`;
    const result = authorizationSchema.safeParse(
      await this.read(path, input.accessToken),
    );
    if (
      !result.success ||
      result.data.organization !== organization ||
      result.data.impersonator !== member ||
      !Object.hasOwn(
        result.data.status,
        "com.linkedin.organization.Approved",
      ) ||
      Object.hasOwn(result.data.status, "com.linkedin.organization.Denied")
    )
      failure();
  }
}
