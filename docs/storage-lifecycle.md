# Storage lifecycle

This document describes how binary assets are stored, served, and reconciled.
All objects live in a single **private** Cloudflare R2 bucket; PostgreSQL is
authoritative for metadata and ownership. No object is ever exposed as a
permanent public URL.

## Object layout

Every key is workspace-scoped so a tenant can never address another tenant's
objects:

| Asset           | Key pattern                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Workspace logo  | `workspaces/{workspaceId}/branding/logos/{assetId}.png`                                                               |
| Character ref   | `workspaces/{workspaceId}/characters/{characterId}/references/{referenceType}/{assetId}.webp`                         |
| Scene image     | `workspaces/{workspaceId}/projects/{projectId}/scenes/{sceneId}/versions/{sceneVersionId}/images/{generationId}.webp` |
| Scene narration | `workspaces/{workspaceId}/projects/{projectId}/scenes/{sceneId}/audio/{generationId}.{ext}`                           |
| Video export    | `workspaces/{workspaceId}/projects/{projectId}/renders/{renderId}.mp4`                                                |

## Signed URL lifetimes

- **Uploads** use short-lived signed `PUT` URLs (`R2_SIGNED_UPLOAD_EXPIRY_SECONDS`, 60–900s).
- **Downloads** use short-lived signed `GET` URLs (`R2_SIGNED_DOWNLOAD_EXPIRY_SECONDS`, 60–3600s), minted per request through an authorized route that resolves the object by workspace + project first.
- **Preview playback** uses a longer session lifetime (`VIDEO_PREVIEW_URL_EXPIRY_SECONDS`, 900–3600s) so a multi-minute preview never fetches an expired URL. Persisted render snapshots store **object keys**, never signed URLs, so a stored record can never leak credentials.

Signed URLs, tokens, and raw object bytes are never logged.

## Deterministic cleanup

- Replacing or deleting a workspace logo or character reference removes the superseded R2 object in the same operation.
- Each explicit generation creates a new versioned object; superseded generations are retained for review history rather than deleted inline.
- Destructive operations are recorded in the audit log (`audit_log_events`) with sanitized metadata (never secrets or signed URLs).

## Reconciliation

Because generation and rendering are durable background operations, three
reconciliation mechanisms keep storage and the money-safe ledger consistent.
All selection is **bounded and non-destructive** — a candidate is only acted on
after it is explicitly selected, and nothing is deleted without a selection.

1. **Expired reservations** — the per-operation scheduled reconcilers
   (`trigger/reconcile-scene-images.ts`, `reconcile-scene-audio.ts`,
   `reconcile-video-render.ts`) convert crashed/cancelled/expired runs into
   terminal application states and release or reconcile their reservations.
2. **Stale runs** — `selectStaleRuns` ([lib/reconciliation/stale-workflow.ts](../lib/reconciliation/stale-workflow.ts))
   purely selects operations left in an active status with no progress past a
   cutoff, so a future scheduled sweep can fail-and-release them uniformly.
3. **Orphan assets** — `selectOrphanAssetCandidates` ([lib/reconciliation/orphan-assets.ts](../lib/reconciliation/orphan-assets.ts))
   purely partitions rows into `leakedAssets` (terminal-failed/cancelled rows
   that still reference a stored object → remove from R2) and `missingAssets`
   (succeeded rows with no stored object → re-reconcile/flag).

The stale-run and orphan-asset **selectors are unit-tested pure functions**;
wiring them to a scheduled, audited cleanup task is a deploy-time follow-up (the
worker is only exercised in the deployed Trigger.dev environment).

## Rate limiting

Billable/mutating operations are additionally protected by a per-workspace
fixed-window rate limiter (`rate_limit_counters`, enforced in the web runtime
before any reservation) so a single workspace cannot flood the generation or
render pipelines. See `RATE_LIMIT_*` in the environment reference.
