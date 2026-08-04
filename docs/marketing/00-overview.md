# Marketing Studio — overview

Read `AGENTS.md` and `README.md` before implementing any part of this feature.

## Charter

The Marketing Studio is a **workspace-scoped AI marketing team**. It learns a
business, grounds itself in that business's own material, and then originates
marketing content for TikTok, Instagram, Facebook, LinkedIn, X, and YouTube —
organic and paid — on a calendar, with competitor and trend awareness, driven
either by a conversation or by recurring schedules.

It is built first for **veilcode.studio**, the business that owns this
repository. It is not built as a single-tenant hack: every table is
workspace-scoped exactly like the rest of the application, so a second business
is a second workspace and nothing more.

### What it is not

VCStudio's existing pipeline turns a **script into a video**. The Marketing
Studio sits beside that pipeline, not inside it — the same relationship the
Social segment has. It decides _what to say and when_; the video pipeline
decides _how a video gets made_; the Social segment decides _how a post reaches
a platform_. Those boundaries are load-bearing and are stated again wherever
they are easy to violate.

## Automation posture

**This feature exists to automate.** That is the difference between it and
everything built so far.

The existing pipeline is deliberately manual: the operator drives every stage
and a human gate sits between each one — approve the script, approve the scenes,
approve each image, approve the audio, start the render. That is correct for a
tool where one video costs several dollars and takes an hour of attention.

The Marketing Studio is the opposite shape. Its job is to **produce a steady
stream of on-brand content with as little human input as the operator is willing
to give up**, ranging from "draft it and I will review" to "run the channel and
tell me what you did". A version of this feature that requires the same
per-artifact attention as the video pipeline has failed at its purpose.

**The guardrails in these documents are not a brake on that. They are what makes
it survivable.** Unattended generation without a budget ceiling, an approval
default, and a kill switch is not automation — it is an unbounded liability with
a cron attached. Every control described here exists so the autonomy dial can
actually be turned up, not to stop it being turned.

The progression is a designed ladder with **explicit graduation criteria at each
rung**, specified in [`09-automation.md`](09-automation.md). Nothing is deferred
indefinitely; each level states what has to be true before the next is unlocked.

| Level        | Who decides what gets made | Who approves      | Who publishes |
| ------------ | -------------------------- | ----------------- | ------------- |
| `manual`     | Operator, per request      | Operator          | Operator      |
| `assisted`   | Schedule rules + operator  | Operator          | Automatic     |
| `autonomous` | Schedule rules + the agent | Automatic, capped | Automatic     |

`assisted` is the realistic destination for most of the first year, and it is
reachable at Slice 11. `autonomous` is reachable after that on evidence.

## Scope

### In scope for v1

1. Business onboarding — a structured question-and-answer wizard capturing the
   business, its audiences, its offers, and its voice.
2. Brand grounding — upload brand assets (logos, product shots) and knowledge
   documents; both reach every generation as a compiled, versioned context block.
3. Content generation — social posts, graphics, blog posts, emails,
   newsletters, media stories, and **paid ad creative and copy**.
4. A content calendar with an approval queue and recurring schedule rules.
5. Competitor and trend research from a real web research provider, with
   citations.
6. A chat surface where the user asks for work in plain language.
7. Skills — named, invokable capabilities the chat can run, surfaced by typing
   `/`, extensible with user-authored skills.
8. Cost governance — a workspace-scoped ledger, budget enforcement, rate limits,
   visible costs before spending.

### Not in the first release (staged, not abandoned)

Each of these is **sequenced**, not dropped. The entry states what unlocks it,
because "later" without a criterion is how a feature quietly never ships.
Automation targets in particular have their graduation criteria in
[`09-automation.md`](09-automation.md).

| Not yet                                                                                         | What unlocks it                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Autonomous `social_media_manager` agent**                                                     | Slice 13 ships it as a **planning** skill — it proposes a week of posts as drafts. It becomes an unattended channel operator at autonomy level `assisted` (Slice 11) and `autonomous` (Slice 14). Unlocked by the per-rule caps and the kill switch, not by elapsed time. |
| **`create_video` fully unattended**                                                             | Slice 14. The **semi-automated** version ships at Slice 9: brief → script → scenes, stopping at the storyboard, which is the gate immediately before the expensive step. See `09-automation.md`.                                                                          |
| **`autonomyLevel: 'autonomous'`**                                                               | Slice 14, with the graduation criteria in `09-automation.md`. The column and the disabled control ship at Slice 0 so the shape exists from the start.                                                                                                                     |
| **Ads API integration**                                                                         | Confirmed with the owner: v1 generates ad creative and copy for manual upload. A Meta Marketing API integration needs its own review cycle on top of the Pages/Tech Provider work already blocked.                                                                        |
| **Vector store / embeddings RAG**                                                               | See `02-brand-grounding.md`. At 10–50 documents, retrieval over the corpus is worse than including all of it. A measured threshold to revisit is recorded there.                                                                                                          |
| **Normalised research sources, click tracking, multi-campaign content, A/B variant statistics** | All are refinements of features that do not exist yet.                                                                                                                                                                                                                    |

## Glossary

| Term                 | Meaning                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brand profile**    | The synthesised description of the business: identity, positioning, voice. One row per workspace.                                             |
| **Brand context**    | The compiled, token-bounded text block assembled from the profile, audiences, offers, and document summaries, injected into every generation. |
| **Context snapshot** | An immutable, fingerprinted copy of a brand context block. Every generation records which snapshot it used.                                   |
| **Skill**            | A named capability the chat can invoke — `create_social_post`, `analyse_competitors`. Maps to an AI SDK tool.                                 |
| **Content item**     | A generated artifact awaiting review: a post, an ad, a blog draft. The central object of the approval queue.                                  |
| **Handoff**          | Converting an approved content item into a `social_posts` row so the **existing** publish path carries it.                                    |
| **Run**              | One money-bearing operation, recorded in `marketing_generation_runs`.                                                                         |
| **Schedule rule**    | A recurring instruction ("a LinkedIn post every Tuesday at 09:00") that produces draft content items on a timer.                              |

## Route map

All routes live under `app/(authenticated)/app/marketing/`. Tabs are
**route-backed**, following `components/projects/ProjectHeader.tsx` — a client
header component derives the active tab from `usePathname()` and pushes on
change.

```text
marketing/
  layout.tsx                          feature-flag + capability gate
  page.tsx                            HOME
  settings/page.tsx                   autonomy, approval policy, marketing sub-budget

  chat/page.tsx                       thread list; redirects to newest thread
  chat/[threadId]/page.tsx            CHAT

  calendar/page.tsx                   CALENDAR
  calendar/schedules/page.tsx           tab — recurring rules
  calendar/schedules/[ruleId]/page.tsx  rule editor

  assets/page.tsx                     ASSETS — tab: brand assets
  assets/documents/page.tsx             tab — knowledge documents
  assets/documents/[documentId]/page.tsx
  assets/library/page.tsx               tab — workspace media library lens

  integrations/page.tsx               INTEGRATIONS

  brand/onboarding/page.tsx           the Q&A wizard (full-bleed, no tabs)
  brand/page.tsx                        tab — profile
  brand/audiences/page.tsx              tab
  brand/offers/page.tsx                 tab
  brand/voice/page.tsx                  tab
  brand/context/page.tsx                tab — compiled context preview + token count

  campaigns/page.tsx                  list
  campaigns/[campaignId]/page.tsx       tab — brief
  campaigns/[campaignId]/content/page.tsx   tab
  campaigns/[campaignId]/ads/page.tsx       tab
  campaigns/[campaignId]/settings/page.tsx  tab

  content/page.tsx                    approval queue
  content/[contentItemId]/page.tsx      tab — draft
  content/[contentItemId]/variants/page.tsx tab
  content/[contentItemId]/history/page.tsx  tab

  research/page.tsx                     tab — trends
  research/competitors/page.tsx         tab
  research/competitors/[competitorId]/page.tsx

  skills/page.tsx                     catalogue
  skills/[skillId]/page.tsx           user-skill editor (owner only)
```

The five pages named in the original request map as: **Home** → `page.tsx`,
**Calendar** → `calendar/`, **Integrations** → `integrations/`, **Assets** →
`assets/`, **Chat** → `chat/`.

### Route handlers

Streaming and file upload cannot be server actions. Everything else is.

```text
app/api/workspaces/[workspaceId]/marketing/
  chat/route.ts                                   POST, streaming
  chat/threads/[threadId]/events/route.ts         GET, poll deferred tool results
  documents/upload/route.ts                       two-phase upload — authorize
  documents/complete/route.ts                     two-phase upload — confirm
  documents/[documentId]/asset/route.ts           signed download
```

### Sidebar

A new `components/marketing/MarketingNavigationGroup.tsx`, copying
`components/application/SocialNavigationGroup.tsx` — **including the
`key={String(isSectionActive)}` remount trick**, which is load-bearing because
Base UI ignores a changed uncontrolled `defaultOpen`.

Entries: Home, Chat, Calendar, Content, Campaigns, Research, Assets,
Integrations. Brand, Skills, and Settings are reached from Home and from the
segment header — eleven items in one collapsible is unreadable.

## Capability matrix

Six new capabilities are added to `lib/policies/workspace-policy.ts` (22 → 28).

| Capability                 | Owner | Editor | Viewer | Notes                                    |
| -------------------------- | :---: | :----: | :----: | ---------------------------------------- |
| `useMarketingChat`         |  yes  |  yes   |   no   | Spends money per turn                    |
| `manageBrandProfile`       |  yes  |  yes   |   no   |                                          |
| `approveMarketingContent`  |  yes  |  yes   |   no   | Gates the handoff to `social_posts`      |
| `runMarketingResearch`     |  yes  |  yes   |   no   | Spends provider credits                  |
| `manageMarketingSchedules` |  yes  |   no   |   no   | **Owner only** — spends money on a timer |
| `manageMarketingSkills`    |  yes  |   no   |   no   | **Owner only** — authors prompt text     |

Schedules and user-authored skills are owner-only for the same reason: both let
somebody who is not present cause spending. Viewers get nothing, consistent with
every other capability in the matrix.

## Feature flag

`ENABLE_MARKETING_STUDIO` (default `false`). When off:

- `app/(authenticated)/app/marketing/layout.tsx` calls `notFound()`.
- `MarketingNavigationGroup` is not rendered.
- Every marketing server action and route handler refuses before doing work.
- The scheduled Trigger tasks return early without claiming anything.

The flag is checked **server-side in all four places**. A flag that only hides
navigation is not a flag.

## Document register

| Document                                                       | Covers                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| `00-overview.md`                                               | This document                                                   |
| [`01-data-model.md`](01-data-model.md)                         | Tables, constraints, indexes, migration order                   |
| [`02-brand-grounding.md`](02-brand-grounding.md)               | Onboarding, documents, context compilation, the no-RAG decision |
| [`03-skills.md`](03-skills.md)                                 | Skill contract, catalogue, `/` picker, cost gating, injection   |
| [`04-chat.md`](04-chat.md)                                     | Streaming route, persistence, tool loop, deferred work          |
| [`05-content-and-publishing.md`](05-content-and-publishing.md) | Content lifecycle, approvals, the `social_posts` handoff        |
| [`06-research.md`](06-research.md)                             | Research provider, snapshots, citation rules                    |
| [`07-cost-governance.md`](07-cost-governance.md)               | Ledger, budgets, rate limits, environment variables             |
| [`08-slices.md`](08-slices.md)                                 | Slice ordering with acceptance criteria                         |
| [`09-automation.md`](09-automation.md)                         | The autonomy ladder, graduation criteria, kill switch           |

## Status

**No implementation has started.** These documents are the plan. Slice 0 begins
only after the migration-journal prerequisite in `08-slices.md` is resolved.
