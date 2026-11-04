# Private development access and public waitlist

VCStudio is currently available only to the owner's existing accounts. The
landing page stays public. Visitors can join `/waitlist` without receiving an
account, workspace, invitation or MCP access.

## Independent controls

1. Keep the existing Clerk instance in **Access mode → Waitlist**. This closes
   self-service email and social account registration while preserving existing
   sign-ins. The custom form uses Clerk's `useWaitlist()` API; review entries in
   Clerk's waitlist dashboard. No custom mail service or database table is used.
2. Keep `ENABLE_PRIVATE_ACCESS=true` in Vercel Production and Preview. Set
   `PRIVATE_ACCESS_CLERK_USER_IDS` to the two verified, existing owner Clerk user
   IDs, comma-separated. The same settings belong in local `.env` and the ignored
   `.env.vercel` deployment reference, never `.env.trigger` or client variables.
   The committed example leaves the list empty; private access then fails closed.

Both existing owner identities and their existing email login methods are
preserved. IDs are read from server configuration, never browser-submitted roles,
emails, workspace IDs or OAuth scopes. Email additions or changes on an approved
account do not require changing the gate. Do not delete or recreate owner accounts.

The proxy protects `/app`, `/onboarding`, `/invite` and `/api`. Anonymous page
requests go to owner sign-in; signed-in outsiders go to the custom waitlist.
Anonymous APIs return 401 and outsider APIs return 403 with the private-development
message. Shared server-action authentication checks the same identity before user
synchronization, including actions posted through a public URL. MCP validates its
OAuth token as usual, then applies the owner check before accessing user/workspace
state. Existing workspace policies and saved MCP grants remain required.

The landing, waitlist, sign-in, legal pages and OAuth discovery remain public.
`/sign-up` redirects to `/waitlist`. The exact `/api/webhooks/clerk` endpoint is
exempt from the owner-session gate and retains signature verification. Existing
security headers, framing restrictions and private media authorization remain in
force. This gate does not alter running workers, previously approved schedules or
existing owner data. Marketing remains paused and LinkedIn Pages remains on hold.

## Verification and operation

Production release `9ae2aa1` was deployed on 2026-11-04. Anonymous live checks
confirmed the public landing and waitlist, protected-page redirects, API rejection,
signup redirection, OAuth discovery/challenge and retained framing protection.
The live waitlist loaded without browser errors or mobile overflow; Dark theme
and landing waitlist links were also checked without submitting an email.

The user subsequently confirmed that their usual sign-in works, the waitlist
works, new users attempting to sign in are blocked with clear feedback, and their
existing MCP connection remains available. Accept these as user-verified live
results. This does not independently verify both owner sign-ins, additional MCP
clients or scheduling.

- `npm run env:check` checks that the web-only settings are placed correctly.
- `npm test` includes fail-closed/default behavior, exact identity matching,
  both approved identities, protected/public paths, API/redirect behavior,
  server-action denial before synchronization and MCP denial before database use.
- `npm run test:e2e:mcp` includes isolated Light/Dark mobile waitlist success and
  retry flows using mocked Clerk responses, alongside existing MCP review tests.
  Tests do not send real emails or register real waitlist entries.
- Check `/` and `/waitlist` anonymously after deployment; `/app` must lead to
  sign-in, a protected API must return 401, and `/sign-up` must lead to waitlist.
  Confirm both existing owner sign-ins and the existing MCP connection separately
  in their normal sessions. Do not capture their session tokens for testing.

Only the owner should approve waitlist entries. Clerk approval/invitation cannot
bypass the server owner list. Invitations may create an identity, but that identity
still cannot use the application while omitted from the list. New email entries
are interest registrations, not permission grants. The UI promises early-access
updates; it does not automatically send a marketing campaign.

To recover an accidentally omitted owner, verify the existing account ID in Clerk,
correct the Vercel server environment list and deploy the web app. Never disable
private access merely to repair an ID typo. Preview has the same restriction.

Reopening requires an explicit product decision. Review Clerk signup mode,
the owner gate, onboarding/invitation policies, budgets and operational readiness
together. `ENABLE_PRIVATE_ACCESS=false` removes this gate but does not itself
change Clerk waitlist mode, workspace authorization, MCP grants or feature flags.
