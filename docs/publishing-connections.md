# Publishing connections

Accounts & connections at `/app/social/accounts` is the shared account-management page. Workspace owners can connect or disconnect accounts; editors can review their status and posting requirements. Every disconnect action resolves the authenticated workspace and owner capability on the server, validates the connection identifier, and scopes the lookup and update by both workspace and connection.

## Disconnect behavior

Use `DisconnectChannelDialog` for account disconnection in both the shared page and project publishing. Opening the dialog, cancelling it, or dismissing it must not call a server action. The dialog names the account and platform, explains that publication history is retained, and warns that scheduled posts may fail until reconnection. Focus starts on Cancel. Confirmation disables repeat submissions and dismissal until the request settles. Failure stays in the dialog with a retry option; success closes it and refreshes account data. Transport failures display safe text without exposing internal errors.

The server service uses `createPlatformOAuthProvider` for connection lifecycle operations. Do not use `createVideoPublishProvider` here: LinkedIn and X support social posts without implementing rendered-video publishing. That mismatch previously threw `UnsupportedPlatformError` before disconnection reached the database, regardless of LinkedIn developer-app verification.

Where supported, remote authorization revocation is attempted. Provider construction, decryption, and revocation failure must not prevent clearing this workspace's credentials. A safe warning identifies the platform without logging tokens, encrypted credentials, app secrets, or raw provider errors. The database command clears both saved tokens and their expiry, marks the connection revoked, and retains the row for publication history. A database failure must still report failure. Successful shared-page mutations record the existing audit event and refresh the shared page.

LinkedIn's current OAuth adapter does not implement remote revocation. Disconnecting it removes this workspace's saved credentials; it does not claim to revoke the member's LinkedIn-side app consent. Adding remote revocation would need a separately verified provider implementation. No new scopes or app credentials are required for this local-disconnection fix.

## Verification

Use mocked database, authentication, and provider requests. Cover all six platforms through the real OAuth registry, missing provider configuration, decryption/revocation failures, local persistence failures, owner permissions, workspace scoping, confirmation cancellation, duplicate submissions, and retry behavior. Do not disconnect a production account merely to test the dialog. Keep Marketing Studio paused and do not start or deploy workers for verification.
