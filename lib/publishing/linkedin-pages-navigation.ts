export const LINKEDIN_PAGES_AUTHORIZE_PATH = "/api/linkedin/pages/authorize";
export const LINKEDIN_PAGES_CALLBACK_PATH = "/api/linkedin/pages/callback";
export const LINKEDIN_PAGES_SELECTION_PATH =
  "/app/social/accounts/linkedin-pages";
export const LINKEDIN_PAGES_STATE_PLATFORM = "linkedin-pages";
export const LINKEDIN_PAGES_PAGE_SIZE = 10;

export function linkedInPagesResultPath(
  status:
    "connected" | "cancelled" | "failed" | "forbidden" | "invalid" | "expired",
): string {
  return `/app/social/accounts?linkedinPages=${status}`;
}
