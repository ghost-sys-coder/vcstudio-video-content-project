# Browser-free MCP media upload

The VCStudio MCP server version `1.1.0` adds a file-transfer path for clients that cannot supply a downloadable original file. It uses the existing Clerk OAuth identity, Media grant, private R2 storage, durable MCP operations, import worker and media inspection. No browser session, R2 network allowlist or storage credential is required on the client.

## Using it in Claude or ChatGPT

Refresh the VCStudio connector and begin a new conversation so it discovers the new tools and current autonomous-publication instructions. Older cached tools cannot be replaced from the remote server. `get_connection` reports the server version and required tool names; `get_capabilities` reports the current publication approval mode. If tools are missing, refresh discovery rather than automating Chrome.

Ask the assistant to call `open_media_upload` with the authorized workspace ID. Select the original image/video inside the embedded MCP panel, then choose **Upload to library**. The panel reads the file in bounded chunks and sends each through `append_media_upload`, over the host's MCP channel. It makes no direct R2 or browser-upload-route request. Upload progress, pause/resume, cancellation and inspection status stay in chat. Once the operation and asset are ready, the assistant can attach it using `save_post` and continue the requested workflow.

Selecting a file gives the panel access to that selected original; a remote connector still cannot open an unshared local or sandbox path. This does not grant arbitrary filesystem access or automatic access to every attachment in a chat. A programmatic MCP client with file access can use the upload tools below without the picker. Do not pass large base64 strings through model reasoning or ask a model to recreate file bytes. Native ChatGPT `import_chat_file` and authorized HTTPS `import_asset` remain preferred when real references are available.

The embedded panel requires MCP Apps support. Unsupported clients retain the programmatic tool path; they must report missing file access rather than silently switching to Chrome. No new local desktop extension or filesystem permission is installed by this release. Existing uploads and the optional, explicitly requested signed-in browser handoff remain compatible.

## Transfer protocol

| Tool                    | Behavior                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `open_media_upload`     | Opens the in-chat picker; optional `uploadId` resumes the same owned upload. No asset or worker is created merely by opening it.                       |
| `start_media_upload`    | Saves immutable metadata, the file fingerprint and one expiring operation. Returns the upload ID, chunk size/count and resume state.                   |
| `append_media_upload`   | Accepts one original binary chunk as canonical base64 with its SHA-256 digest; matching retries are reused and changed bytes conflict.                 |
| `get_media_upload`      | Reads received indices, operation state and current asset inspection status. It does not poll or fetch the video.                                      |
| `complete_media_upload` | Checks every expected part and queues the existing import worker using a fixed idempotency identity. Repeating completion cannot duplicate the import. |
| `cancel_media_upload`   | Cancels only an unprocessed temporary upload and cleans its staging chunks. It cannot delete a ready library asset, project or post.                   |

All requests carry `workspaceId`, resolved against current membership, OAuth scopes and saved grants. Upload IDs are additionally bound to the initiating user and OAuth connection. All mutations require idempotency keys. The start key is caller-generated; subsequent keys are derived from the immutable upload and action:

```text
append:   mcp-upload:{uploadId}:{zeroBasedIndex}:{chunkSha256}
complete: mcp-upload:{uploadId}:complete
cancel:   mcp-upload:{uploadId}:cancel
```

Chunks are exactly 524,288 bytes, except the final remainder. The maximum is the existing per-kind workspace media limit, capped at 512 MiB. Base64 plus the tool envelope fits below the existing 1 MiB MCP request limit. Session lifetime is one hour. The client checksums the file using one chunk at a time, without loading the entire video into memory. It then uploads serially with pacing and reuses already-received chunks after an interruption.

For a file with size `N`, chunk size `C` and ordered lowercase SHA-256 chunk digests `H`, the file fingerprint is:

```text
SHA256(UTF8("vcstudio-mcp-upload-v1:" + N + ":" + C + ":" + H.join(":")))
```

This is a versioned chunk-manifest fingerprint, not a conventional whole-file SHA-256. Start inputs include `fileName`, `contentType`, `sizeBytes`, `fileFingerprint`, optional title/attribution, workspace ID and an idempotency key. A chunk request includes `uploadId`, `index`, `sha256`, canonical `dataBase64` and the derived key. The in-chat helper implements these details in `lib/mcp/upload-file-via-mcp.ts`.

## Integrity, completion and cleanup

The database holds metadata and operation state only. Binary chunks live under a derived, private workspace/upload prefix in R2. Conditional create-only writes make accepted chunks immutable; retries check the original length, checksum and request identity. The worker streams chunks into the existing multipart importer, verifies their actual lengths and SHA-256 digests, and verifies the ordered file fingerprint before committing the final object. A different file cannot silently resume an older upload.

The final private library copy uses the existing image decoding or background video inspection. Pending/failed inspection remains unpublishable. An import response is not media approval, publication or scheduling. An unavailable worker preserves queued data with actionable completion retry; temporary failures cannot silently produce a usable asset. Current connection/workspace permission is checked again by the worker before completion.

Cancellation is audited and cannot delete library media. Late requests after cancellation/expiry clean up their own staging part, with failed cleanup left eligible for recovery. Successful assembly removes staging chunks. Terminal sessions remain eligible for a grace-period recheck because an ambiguous conditional PUT may commit after its caller loses the response. The existing six-hour storage cleanup also processes a bounded set of old terminal chunk sessions, including sessions with no media row; it preserves completed asset results when recording cleanup. The 30-minute recovery and six-hour cleanup frequencies are unchanged. No idle polling, extra scheduled task, schema migration, environment variable or dependency was added.

The old browser-upload authorization explicitly refuses chunk-upload operations, so it cannot mint an overwrite URL for the immutable completed copy. No token, presigned URL or raw binary is returned in ordinary upload results.

## Publication and rollout

For an owner-authorized autonomous connection, a ready video follows `create_post` / `save_post` → `prepare_publication` → `execute_publication`, using the exact preparation operation ID and same idempotency key. Manual connections still require their human review proof. Client-side tool confirmations remain independent. TikTok remains inbox-only; Marketing, LinkedIn Pages and paid video generation stay on hold.

Deploy the matching existing import/cleanup worker before exposing the new web tools. Keep worker environment synchronization disabled; no new configuration is needed. Verification must use mocked storage/providers/workers and isolated PostgreSQL. Actual Claude/ChatGPT client acceptance is distinct from SDK/browser-harness verification and must be recorded separately, without posting test content to real accounts.

Local verification passed 455 tests across 60 files (three existing opt-in tests skipped), including isolated PostgreSQL cleanup checks, and all 28 browser journeys across upload, approval/autonomy and YouTube settings. Light/Dark phone/desktop screenshots were inspected. TypeScript, environment placement, production build and changed-file formatting passed. Full lint has only three existing warnings. One large-buffer comparison timed out during concurrent build load; using native byte equality retained the integrity assertion and the full standalone regression rerun passed. Both embedded HTML files were confirmed in the production route's file trace. No live upload or publication was run for these implementation checks. Worker and web release status is recorded below once deployed.
