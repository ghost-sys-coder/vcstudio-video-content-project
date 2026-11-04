# VCStudio MCP capability proposal

Status: the user agreed to the MCP direction on 2026-11-04 and added external
content import, project reuse and publishing from AI clients as a core requirement.
MCP is the next product priority, ahead of the discussed video-generation expansion.
The original proposal is retained below as the product scope record. The approved
v1 endpoint, authentication boundary and tools are deployed for the owner-only
production pilot. ChatGPT import/reuse and scene-image approval, a real LinkedIn text-and-image publication
and continued MCP access after the private-access restriction are user-verified.
Remaining live acceptance is tracked in [MCP setup](mcp-setup.md).

The user approved implementation of the import/reuse/publish plan. Milestones 1-3 are deployed; see [MCP setup and verification](mcp-setup.md) for the implementation, migrations, tests and remaining acceptance checks. The broader proposal below records candidate future scope; it does not make generation, rendering or administration part of delivered v1.

## Connection model

Use one authenticated remote VCStudio MCP server with focused tools, shared by
compatible Claude and ChatGPT clients. A tool is a deliberate application action,
not direct database access or remote control of the application's interface.
Target a public HTTPS endpoint with MCP-compatible OAuth, user consent, revocation,
and workspace-scoped grants. Choose the supported protocol/SDK and confirm client
compatibility during implementation; do not assume every optional MCP capability
is available in every desktop or web client.

The current application resolves Clerk browser sessions and an active-workspace
cookie. Remote tools need their own authenticated principal and explicit authorized
workspace context, mapped to the existing application user and membership. Reuse
central policies and application services. Do not call a database command without
the validation, permissions, ownership checks, and audit behavior currently applied
by its server-action caller.

## Existing functionality that can be exposed

These are candidate tool families backed by existing application behavior, not a
claim that MCP tools are already implemented or that external accounts are ready.

| Area                         | Plausible tools                                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspaces and discovery     | List authorized workspaces, report effective permissions and enabled capabilities, select a workspace explicitly for an operation.                                                                 |
| Projects                     | Search/list projects, inspect production readiness and blockers, create a project, edit its brief/settings, archive it.                                                                            |
| Ideas and scripts            | Read/save/archive ideas, create a project from a saved idea, read/save script drafts, create/restore versions, approve an exact version, optionally request the application's paid generation.     |
| Editorial evidence           | Manage project sources, script claims and citations, record review decisions and editorial sign-off.                                                                                               |
| Scenes and storyboard        | List/read scenes, create manual scenes, import structured scenes, edit with revision checks, assign cast/staging, merge/delete with confirmation, approve exact versions, request script analysis. |
| Characters and visual styles | Manage character profiles, use existing references, request portraits/poses, run animation checks, manage versioned visual styles and project assignments.                                         |
| Images                       | Inspect generation history and approved assets, estimate/start single or bounded batch generation, approve/reject results, retry eligible failures and cancel queued work.                         |
| Audio                        | List voice presets, create supported presets, estimate/start narration, review/approve/reject results, cancel eligible work. Recording and voice enrollment retain a browser interaction.          |
| Media library                | Search/page reusable assets, read/edit titles, alt text and tags, attach existing assets, obtain authorized asset access, initiate validated uploads where client support permits.                 |
| Captions and assembly        | Read/edit captions and style, export SRT/WebVTT, configure supported scene framing, pacing, effects, music and Shorts, validate render readiness.                                                  |
| Rendering and outputs        | Estimate/start existing Remotion rendering, inspect progress/failures, cancel eligible work, retrieve authorized exports, plan/start supported paid reframing.                                     |
| Publishing preparation       | Prepare titles/descriptions/tags, request paid metadata/thumbnails/chapters, select favorites, prepare and confirm release packages, create Social drafts from renders.                            |
| Social and distribution      | Create/edit drafts, attach media, validate destinations, inspect the calendar, publish/schedule supported posts/releases, cancel unclaimed schedules, read publication results.                    |
| Usage and operations         | Read permitted usage/audit data, budget headroom and production status, inspect jobs through bounded status requests. Privileged readiness and administration retain their existing role rules.    |
| Administration               | As a separate privileged tool group, expose supported workspace profile, member/invitation/role, budget/limit and connection-disconnection operations with appropriate approval.                   |

Representative existing entry points include `lib/policies/workspace-policy.ts`,
`lib/auth/workspace-context.ts`, `db/commands`, `db/repositories`,
`lib/production/production-readiness.ts`, `lib/scenes`, `lib/social`,
`lib/publishing`, and the authenticated server actions under `app`.

The connected assistant can also write ideas, scripts, structured scenes and
Social copy in the conversation, then save them with non-generation tools. That
does not invoke VCStudio's separate text-generation provider. It still consumes
normal hosting/database resources and the assistant client's own allowance.
Calling an explicit VCStudio generation tool retains the application's provider
costs and limits.

## Core workflow: bring content from the AI conversation

Users must be able to bring existing or externally generated content into VCStudio
without generating it again. The user explicitly included images generated in
normal ChatGPT conversations, outputs of third-party tools used by Claude, and
images, videos or text the user already has. This workflow belongs in the initial
MCP delivery rather than waiting for VCStudio's new video-generation providers.

Representative requests:

- Save this image to my workspace and use it for scene 3 of this project.
- Import these third-party generated images as scene assets or references.
- Save the text written here as a project script or Social draft.
- Use this finished video and caption to prepare a post for my connected channels.
- Publish the approved image/video/text post now, or schedule it, without creating
  a project or running the production pipeline first.

The flow is: receive authorized content, validate and store a private workspace
copy, assign it to the chosen application destination, preview the intended action,
then execute with the required approval. Keep import, project assignment and public
publication as distinct operations. Importing does not approve scene media or
authorize a public post by itself.

Support three input paths, using the best supported path for each client:

1. Native client file references or transfers, when exposed to the connector.
   OpenAI documents tool file inputs with temporary download references and
   optional file-picker helpers. This is not proof that every image visible in
   every ChatGPT conversation, including every generated image, is transferable.
2. Downloadable output from another tool, when the user authorizes import and
   that service supplies a usable download reference. A provider-specific asset ID
   or preview alone is not file access; use the provider's supported export when
   available. Do not require a VCStudio generation integration for each source.
3. A secure upload handoff when the client cannot transfer the original file.
   Preserve the intended workspace/project/post destination across that handoff.

Validate actual file type, size and applicable media properties; apply bounded
downloads and SSRF protection to remote imports, including redirects. Never assume
a temporary external link is permanent storage. Avoid large base64 files in model
arguments, retain no credentials or signed URLs in provenance/logs, and make import
retries idempotent within the workspace. Record available source attribution without
claiming an external file was generated by VCStudio. Import itself incurs no new
model-generation charge; hosting, transfer/storage and any explicit processing or
later generation still consume their normal resources.

Existing library uploads, uploaded scene-image review and Social attachments provide
the foundation. Add explicit bindings/copying through those validated paths where a
library asset cannot currently be assigned to a scene directly; do not assume the
tables are interchangeable. Images can serve supported scene/reference/thumbnail
roles, and text can become scripts, scene briefs, captions or post copy. Finished
external videos can use the existing library-to-Social publishing path without
being rendered again. Arbitrary video footage inside project scenes depends on the
future video/assembly work and is not an existing complete capability.

Validate destinations against the existing platform capability matrix. Text-only,
images, image collections and videos are not supported uniformly across connected
channels. Preview per-destination content, refuse incompatible combinations and
report success/failure per target rather than promising universal cross-posting.
Connection permissions and publication/scheduling approvals remain necessary.

## Boundaries and dependencies

- Marketing Studio stays paused. Report the pause without querying Marketing
  data; expose no tool that enables the feature or starts Marketing work.
- LinkedIn company Page authorization remains on hold until the user reports
  approval and the required scopes are available. MCP cannot bypass it.
- The expanded project AI-video path and standalone multi-model generator remain
  future functionality. Existing scene-clip backend groundwork is not a complete
  integrated feature; no application caller of `startSceneClipGeneration` was
  found. Add MCP tools when those product paths are implemented.
- Connected-platform permissions, quotas, media requirements, token expiry and
  running-worker requirements still apply. TikTok retains inbox delivery and its
  required human completion; MCP does not turn it into automatic Direct Post.
- Account OAuth/consent, microphone recordings, voice consent and file selection
  may need secure browser handoffs. A remote tool cannot assume access to chat
  attachments or the user's local filesystem.
- Return only allowed application data, safe errors and authorized media access.
  Never expose provider keys, platform tokens, raw database access or shell tools.

## Permission and execution proposal

Effective access is the intersection of the current workspace role, the user's
connection grant, feature availability and approval for the particular action.
Recheck permissions when a tool executes; a remembered role or previous tool
listing does not authorize a later call. Viewer access remains read-only and does
not include owner/editor-only usage or operational data.

Separate read, edit, generate, review, publish and administration grants so that
permission to edit a script does not also authorize posting publicly. Offer a
connection-management screen to inspect grants, activity and revocation.

Use per-operation approval as the initial baseline for billable generation, public
publication/scheduling, destructive changes and privileged administration. Paid
approval shows the exact inputs, estimate and budget impact. Bind server-verified
approval to the user, workspace, operation, input/version and expiry; a model's
`confirmed: true` argument alone is not approval. Bounded spending authority has
not been granted; consider it separately if the user requests it later.

Keep long work in existing durable workflows and return a persisted operation ID
and application link. Expose bounded status and eligible cancellation tools;
avoid always-on monitoring or additional scheduled sweepers. Use pagination,
rate limits, idempotency, optimistic version checks and audit attribution to the
connected user/client. Cancellation reports which work was already incurred.

## Suggested delivery order

1. Build authentication, connection grants/revocation, workspace isolation,
   capability discovery, audit attribution and approval primitives. Deliver a
   useful first slice with project/script/scene reads and edits, external-content
   import, library reuse, Social drafts and production-status tools.
2. Complete the external-content workflow with project-media assignment and Social
   publishing/scheduling, destination previews and server-verified approvals.
   Test native chat files/generated outputs where available, third-party downloads,
   upload fallback and text-only requests on the target desktop and web clients.
3. Add cost-estimated generation, review, captions, assembly, rendering and export
   tools using the existing workflows, plus separately granted administration.
   Validate with mocked providers/workers before any live billable acceptance work.
4. Extend the same server when the two video-generation experiences are built.

## Official interoperability references

- [MCP authorization specification](https://modelcontextprotocol.io/specification/latest/basic/authorization)
- [MCP tools specification](https://modelcontextprotocol.io/specification/latest/server/tools)
- [Claude remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [OpenAI MCP/plugin quickstart](https://developers.openai.com/plugins/quickstart)
- [OpenAI MCP authentication](https://developers.openai.com/plugins/build/auth)
- [OpenAI file inputs and optional file helpers](https://developers.openai.com/plugins/reference)

These sources were reviewed on 2026-11-04. Validate support in the user's actual
accounts and client builds during setup rather than promising identical desktop
and web behavior.
