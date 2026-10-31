# Publishing connections

Accounts & connections at `/app/social/accounts` is the shared account-management page. Workspace owners can connect or disconnect accounts; editors can review their status and posting requirements. Every disconnect action resolves the authenticated workspace and owner capability on the server, validates the connection identifier, and scopes the lookup and update by both workspace and connection.

## Disconnect behavior

Use `DisconnectChannelDialog` for account disconnection in both the shared page and project publishing. Opening the dialog, cancelling it, or dismissing it must not call a server action. The dialog names the account and platform, explains that publication history is retained, and warns that scheduled posts may fail until reconnection. Focus starts on Cancel. Confirmation disables repeat submissions and dismissal until the request settles. Failure stays in the dialog with a retry option; success closes it, refreshes account data, and shows one Sonner success toast naming the platform and account. Cancellation and failed requests must not show a success toast. Transport failures display safe text without exposing internal errors.

The server service uses `createConnectionOAuthProvider` for connection lifecycle operations. It resolves the stored account identity so LinkedIn Pages use their dedicated app and profiles retain the personal app. Do not use `createVideoPublishProvider` here: LinkedIn and X support social posts without implementing rendered-video publishing. That mismatch previously threw `UnsupportedPlatformError` before disconnection reached the database, regardless of LinkedIn developer-app verification.

Where supported, remote authorization revocation is attempted. Provider construction, decryption, and revocation failure must not prevent clearing this workspace's credentials. A safe warning identifies the platform without logging tokens, encrypted credentials, app secrets, or raw provider errors. The database command clears both saved tokens and their expiry, marks the connection revoked, and retains the row for publication history. A database failure must still report failure. Successful shared-page mutations record the existing audit event and refresh the shared page.

LinkedIn's current OAuth adapter does not implement remote revocation. Disconnecting it removes this workspace's saved credentials; it does not claim to revoke the member's LinkedIn-side app consent. Adding remote revocation would need a separately verified provider implementation. No new scopes or app credentials are required for this local-disconnection fix.

## LinkedIn profile and company-page support

LinkedIn personal profiles and company/business Pages use separate developer applications. The profile app retains `LINKEDIN_CLIENT_ID`/`LINKEDIN_CLIENT_SECRET`, requests `openid`, `profile`, and `w_member_social`, and reads `/v2/userinfo`. The Pages app must have Community Management API access as its only provisioned product and uses `LINKEDIN_PAGES_CLIENT_ID`/`LINKEDIN_PAGES_CLIENT_SECRET`. It requests only `rw_organization_admin` and `w_organization_social`; it never calls OpenID userinfo. Credentials do not imply approved product access.

Both credential pairs belong in the web and worker runtimes: Vercel handles authorization/code exchange, while Trigger.dev refreshes expiring stored tokens before publishing. `LINKEDIN_API_VERSION` is also shared because both Page discovery and post/media APIs are versioned. Local `.env`, `.env.vercel`, and `.env.trigger` files have matching Pages credentials. On 2026-10-31 the user authorized supplying the three Page configuration variables to production: Vercel confirmed all three saved, and Trigger.dev confirmed the import and secret metadata for the two credentials, with the API version matching the local value. Secret values cannot be read back for comparison. These configuration updates did not deploy the new code. `.env.example` contains a safe key catalogue with no real credentials.

Register the exact callback URI on the **Pages app**:

```text
https://vcstudio.veilcode.studio/api/linkedin/pages/callback
```

The URI is derived from `{APP_BASE_URL}/api/linkedin/pages/callback` for each environment. Keep the profile app callback at `/api/linkedin/callback`. After configuring approved permissions and credentials, deploy the updated web app and `social-post-publish` worker before using Page connections in production. No deployment or worker start was performed during implementation; Marketing Studio and its schedules remain paused.

### Connection flow

1. An owner chooses **Connect LinkedIn Page** in Accounts & connections. The authorize route signs state with a Page-specific purpose, binds it to the user/workspace, and sets a short-lived HTTP-only state cookie. The callback checks this browser cookie, the signature/expiry/purpose, current membership, and the Social posting feature flag before exchanging a code.
2. Tokens remain in an encrypted, purpose-bound, user/workspace-bound selection cookie for at most ten minutes, capped by access-token expiry. They are never placed in a query string, form field, client prop, or provider-error message. Oversized cookies fail safely.
3. `/app/social/accounts/linkedin-pages` reads at most ten ACL records at a time. It requests and considers only approved Page administrators, matching the administered-organization lookup requirement and fetches names only for eligible identities. Pagination is explicit, bounded, and does not prefetch provider data. The shadcn selector supports keyboard input, empty results, pending guards, cancellation, duplicate-click protection, and retries that retain the selected Page.
4. On confirmation the server resolves the owner/workspace again, verifies the selection cookie before any provider request, reloads the relevant member ACL page, and checks `ORGANIC_SHARE_CREATE` for that exact member/Page through Organization Authorizations. It ignores browser-supplied names, roles, workspace IDs, and tokens.
5. The existing workspace-scoped encrypted-credential command stores the trusted Page identity, records the existing connection audit event, consumes the scoped selection cookie, and returns to Accounts & connections. Cancellation clears the cookie without storing credentials. Add another Page through another connection flow; all Page requests use the same scope set.

Page administrators are supported by this initial flow; content-only roles are not offered because the metadata endpoint requires administrator access. The later organic-posting check is still mandatory and can reject inactive or otherwise unauthorized Pages.

### Stored identity and publishing

Page connections store a canonical `urn:li:organization:{id}` in the existing external-account identifier. Legacy personal-profile IDs remain unchanged, including numeric member IDs. This intrinsic provider identity distinguishes the accounts and selects the correct OAuth app during refresh/disconnection; a browser never chooses the app credentials. No schema change or migration is required. Accounts, composer destinations, and publication history distinguish LinkedIn Pages from profiles.

The social-post provider uses the exact organization URN as post author and media owner; profiles retain their person URN. Text and image posts reuse the existing queue, publishing permissions, and publication history. Video uploads now follow LinkedIn multipart initialization, bounded byte-range transfer, ordered ETag finalization, and bounded processing checks before creating the post. A part buffers at most 4 MiB; an ignored or inconsistent storage range fails before upload/finalization. Upload destinations are restricted to LinkedIn/CDN HTTPS hosts. Processing waits use the worker's existing durable wait callback. Ambiguous post-creation responses, including HTTP 5xx or a missing post identifier, require human inspection and are never automatically retried.

Programmatic refresh tokens depend on LinkedIn approval. When no refresh token is issued, expiry requires the owner to reconnect; the application does not manufacture long-lived credentials. LinkedIn Page disconnection clears this workspace's stored credentials without claiming remote consent revocation or revoking other connected destinations. No rendered-project LinkedIn publishing or additional background task was added.

Provider contracts were checked against [API permissions](https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-10), [Organization ACLs](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role?view=li-lms-2026-03), [Organization Authorizations](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-authorizations/organization-authorizations?view=li-lms-2026-02), and the [Videos API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api?view=li-lms-2026-01). Live approval/consent/posting was not exercised.

## Verification

Use mocked database, authentication, and provider requests. Cover all six platforms through the real OAuth registry, missing provider configuration, decryption/revocation failures, local persistence failures, owner permissions, workspace scoping, confirmation cancellation, duplicate submissions, and retry behavior. Do not disconnect a production account merely to test the dialog. Keep Marketing Studio paused and do not start or deploy workers for verification.
