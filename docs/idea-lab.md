# Niche Idea Lab (`/app/ideas`) — design

## What it is

A top-level, workspace-scoped page (outside the projects tree) where a user generates
**idea cards** for a niche in one shot, saves the good ones grouped by niche, and later
pulls an idea into a project's script screen — which auto-fills the brief that already
exists. No chat, no Trigger.dev task, no reservation ledger, no second AI provider.

An "idea" is deliberately a **pre-project brief**: it carries the exact six fields the
`briefSchema` already defines (`lib/schemas/project.ts`), so "use this idea" is just a
copy into `project_briefs`.

Decisions locked with the user:

- Drop the Claude Agent SDK for now (Vercel-live rules out subscription auth, which was
  its only cost advantage). Reuse the existing OpenAI `TextGenerationProvider`; keep the
  interface swappable so Claude can be added later behind it.
- One-shot idea cards, not a chat.
- Bring-your-own-key is deferred to the monetization phase; build the seam later.
- Niche is free text (indexed), not a fixed enum.
- Idea-generation cost is recorded in a run table but kept off `/app/usage` (like
  publishing) because it is sub-cent.

## Cost profile

At the configured text rates (`OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS=100`,
`OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS=600`), a 5-card batch (~800 input + ~600
output tokens) costs ≈0.44¢. Runs as a plain server action (no Trigger run compute).
Bounded by `MAX_IDEAS_PER_BATCH` and rate-limited via `enforce-rate-limit`.

## Data model (one migration)

`content_ideas` (workspace-scoped):

- `id` (uuid pk), `workspaceId` (uuid, FK), `niche` (text — grouping key)
- Six brief fields: `topic`, `targetAudience`, `tone`, `targetDurationSeconds`
  (nullable int), `primaryPlatform` (`content_platform` enum, already exists),
  `hookAngle`
- `rationale` (text), `hookType` (short label)
- `source` (`ai` | `manual`), `isArchived` (bool), `createdByUserId`, `createdAt`,
  `updatedAt`
- Index on `(workspaceId, niche)`.

`content_idea_generation_runs` (lightweight, off-ledger cost record):

- `id`, `workspaceId`, `niche`, requested `count`, input knobs
- `model`, `promptVersion`, `inputTokens`, `outputTokens`, `actualCostCents`,
  `status`, `createdByUserId`, timestamps

## Provider + prompt + schema

- Add `generateIdeas(input: { model, prompt })` to `TextGenerationProvider`
  (`lib/openai/text-generation-provider.ts`) + the OpenAI impl, using `responses.parse`
  - `zodTextFormat`, mirroring `generateTitles`.
- Output schema `lib/schemas/idea-generation.ts`:
  `{ ideas: [{ topic, targetAudience, tone, targetDurationSeconds, primaryPlatform,
hookAngle, rationale, hookType }] }` (~5 cards).
- Prompt `packages/prompts/src/idea-generation.ts`:
  `renderIdeaGenerationPrompt({ niche, count, platform?, tonePreference?, language })`
  exporting `IDEA_GENERATION_PROMPT_VERSION`. Encodes proven educational/short-form
  formats (hook-first, curiosity gap, numbered lists) tuned toward stick-figure
  educational YouTube/TikTok. Honest copy: "proven formats worth testing", never
  "trending" or "guaranteed viral".

## Routes & components (one component per file, PascalCase)

- `app/(authenticated)/app/ideas/page.tsx` (thin) + sidebar entry.
- Server actions: `generateIdeasAction`, `saveIdeaAction`, `archiveIdeaAction`,
  `applyIdeaToBriefAction` — thin wrappers over `lib/ideas/*`,
  `db/commands/idea-commands.ts`, `db/repositories/content-ideas.repository.ts`.
- Components: `IdeaGeneratorPanel`, `IdeaCard`, `IdeaLibrary`, `NicheSection`,
  `EmptyIdeasState`, loading/error states.
- Script screen: `StartFromIdeaSelect` lists workspace ideas grouped by niche;
  selecting one calls `applyIdeaToBriefAction`, which writes the six fields into
  `project_briefs` via the existing brief upsert, then the user runs the existing
  script generator.

## Security

- Every `content_ideas` query scoped by server-resolved `workspaceId`; never trust a
  browser-supplied id.
- `applyIdeaToBrief` verifies both `idea.workspaceId` and `project.workspaceId` equal
  the authorized workspace before copying (cross-workspace guard for the autofill hop).
- Same role check that gates script/brief editing gates idea generation.

## Testing

- Unit: prompt render + `IDEA_GENERATION_PROMPT_VERSION` pin; output-schema parse;
  idea→brief field mapping; cost calc.
- Integration (opt-in Postgres): create/list-by-niche, workspace isolation, and the
  apply-to-brief cross-workspace rejection.
- Rate-limit test. No snapshot-only tests.

## Env / migrations / README

- One migration (`content_platform` enum reused). `npm run db:generate`, reviewed
  before applying.
- Env: `MAX_IDEAS_PER_BATCH` (default 5); everything else reuses `OPENAI_TEXT_*`.
- README: capability, route, sidebar entry, migration line, dated "Recent major
  changes".

## Build order (verifiable slices)

1. Schema + repository + commands (data layer, off-ledger run record) → migration +
   integration tests.
2. Prompt + provider `generateIdeas` + one-shot server action → unit tests, rate limit.
3. `/app/ideas` UI (generator + niche-grouped library).
4. Script-screen `StartFromIdea` autofill into `project_briefs`.

Each slice ends with format → lint → typecheck → `npm test` → build, plus README /
`.env.example` sync.
