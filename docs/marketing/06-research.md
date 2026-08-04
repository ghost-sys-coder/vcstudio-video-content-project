# Marketing Studio — research

Competitor analysis and trend tracking. This is the part of the feature most
likely to produce confident nonsense, so the constraints matter more than the
plumbing.

## The premise

**A language model cannot tell you what is trending.** Its knowledge has a
cutoff, it has no access to this week, and asked about a competitor it has never
heard of it will produce a plausible, fluent, entirely invented profile.

The existing `packages/prompts/src/idea-generation.ts` already encodes this
honesty — it instructs the model **not** to describe anything as currently
trending, because it cannot verify live trends. Research changes that situation
only because real search results are supplied. The honesty constraint does not
relax; it becomes enforceable.

**Every assertion must be supported by a supplied search result, and must carry
that result's index.** A finding without a citation is a bug, not a stylistic
preference.

## Provider interface

`lib/marketing/research/research-provider.ts` — narrow, per AGENTS.md's
instruction not to build a universal provider framework:

```ts
export type ResearchQuery = {
  query: string;
  maxResults: number;
  recencyDays: number | null;
  includeDomains: string[];
  excludeDomains: string[];
};

export type ResearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedAt: Date | null;
  score: number | null;
};

export type ResearchResponse = {
  provider: string;
  requestId: string | null;
  results: ResearchResult[];
  providerCostCents: number | null;
};

export interface WebResearchProvider {
  readonly name: string;
  search(query: ResearchQuery): Promise<ResearchResponse>;
}
```

`publishedAt` is not optional decoration — it is what makes a recency claim
checkable, and what lets the synthesis prompt distinguish "this happened last
week" from "this is a 2019 blog post that ranks well".

### Implementation

- `tavily-research-provider.ts` is the v1 implementation, via plain `fetch`.
  **No SDK dependency** — AGENTS.md dependency rule 5: do not add a package when
  a small well-tested local utility suffices. Tavily returns snippets and
  published dates, which is exactly what citation-grounded synthesis needs.
- `research-provider-registry.ts` mirrors `lib/publishing/social-post-registry.ts`:
  - `isResearchProviderConfigured()` so `/app/marketing/integrations` can say
    "not configured" rather than failing at run time, and so the research skills
    are **hidden from the `/` picker** when no key is set;
  - `createResearchProvider()` with an exhaustive switch over
    `MARKETING_RESEARCH_PROVIDER` (`tavily | brave | serpapi | none`).
- `research-error.ts` returns `{ category, retriable, safeMessage }`, the same
  discriminated shape as `classifyOpenAiError` — so the Trigger retry decision
  reads identically to every other task in the repo.

Swapping to Brave or SerpAPI later means one new file and one switch branch.
Nothing above the interface changes.

## Flow

`trigger/marketing-research.ts`, on the `ai-text` queue:

```text
1  reserve on the marketing ledger (competitor_analysis | trend_scan)
2  issue 1-3 bounded queries        (MARKETING_RESEARCH_MAX_QUERIES)
3  LLM synthesis with structured output
     renderCompetitorAnalysisPrompt / renderTrendScanPrompt from @studio/prompts
     validated by researchSnapshotSchema
4  store the snapshot with citations
5  reconcile the reservation to actual cost
```

Query count is bounded because it is the cost driver: three searches plus one
synthesis is a predictable bill; an agent deciding for itself how many searches
to run is not.

## The synthesis contract

`researchSnapshotSchema` (Zod, in `lib/schemas/marketing-research.ts`):

```ts
{
  summary: string;
  findings: { statement: string; sourceIndexes: number[]; confidence: "high" | "medium" | "low" }[];
  opportunities: { statement: string; sourceIndexes: number[] }[];
  risks: { statement: string; sourceIndexes: number[] }[];
  contentAngles: { angle: string; rationale: string; sourceIndexes: number[] }[];
}
```

`sourceIndexes` is `.min(1)` on every array member. **A finding that cites
nothing fails validation** and the run fails rather than storing an unsourced
claim. This is the schema doing the work the prompt asks for, which is the only
way to make it reliable.

The prompt template states the rule explicitly and repeats it in the output
requirements section, following the layered structure the other image and text
prompts already use.

### The UI never renders an uncited finding

`components/marketing/ResearchFindingRow.tsx` renders the citation markers
inline and links them to the stored URLs. There is no code path that displays a
`statement` without its sources — the type makes them non-optional and the
component destructures both.

## Storage and freshness

Snapshots are immutable. A refresh creates a new row; it never mutates an old
one. `result_hash` allows detecting that nothing changed since last time, which
is useful signal in itself ("no competitor movement this week").

```text
expires_at = created_at + freshness_window_days
```

`freshness_window_days` defaults from `marketing_settings.research_refresh_days`
(default 7).

### Refresh

`trigger/marketing-research-refresh.ts`, daily at 06:00:

```text
claim active competitors whose newest snapshot has expired
bounded by MARKETING_RESEARCH_DAILY_MAX_RUNS
and by remaining workspace budget
when either is exhausted: record skip_reason and stop
```

**Never silently spend, and never silently skip.** A skipped refresh writes its
reason, and the research page shows "last refreshed 12 days ago — daily limit
reached" rather than quietly serving stale data as current.

Manual refresh is available from `/app/marketing/research` and from chat, and
consumes the same budget and rate limit.

## Competitors

Competitors are **entered by the user**, not discovered. `marketing_competitors`
holds name, website, and per-platform handles.

Automatic competitor discovery is not in v1: it is the single easiest place for
the system to hallucinate a rival that does not exist, and the user of this
feature knows their market better than a search API does. A `scan_trends` run
may _suggest_ names in its `opportunities`, which the user can then add
explicitly.

`last_researched_at` drives the refresh queue ordering, combined with
`priority`.

## Trends

`kind: 'trend'` snapshots are topic-scoped rather than competitor-scoped, driven
by the brand profile's industry and the workspace's configured platforms.

The prompt must distinguish three things the UI then renders differently:

| Category      | Meaning                                             |
| ------------- | --------------------------------------------------- |
| **Observed**  | Stated in a supplied result, with a recent date     |
| **Reported**  | Stated in a supplied result, undated or older       |
| **Inference** | The model's reading of the results, flagged as such |

An inference is allowed — it is often the useful part — but it must be labelled
and must still cite the results it reasons from. What is never allowed is an
inference presented as an observation.

## Feeding research into content

A research snapshot is **context, not instruction**. `contentAngles` become
suggested prompts the user can accept into a campaign or a content item; they
never auto-generate content.

The link is recorded: a content item created from an angle stores the
originating `run_id`, and the campaign brief can reference the snapshot. "Why
did we make this post?" resolves to a cited finding.

## Required behaviour

```text
research skills are hidden when no provider is configured
every finding, opportunity, risk and angle cites at least one source
a synthesis with an uncited claim fails validation
query count per run is bounded by configuration
snapshots are immutable; refresh creates a new row
an expired snapshot is visibly stale in the UI, not silently served as current
a skipped refresh records why
competitors are user-entered, never auto-discovered
inference is labelled distinctly from observation
research never triggers content generation on its own
```

## Required tests

```text
researchSnapshotSchema rejects an empty sourceIndexes array
researchSnapshotSchema rejects a sourceIndex out of range for the supplied results
provider registry reports not-configured without throwing
tavily provider maps a response to ResearchResult including publishedAt
research-error classifies rate limit, auth failure, and transport separately
refresh respects MARKETING_RESEARCH_DAILY_MAX_RUNS
refresh stops on exhausted budget and records skip_reason
expired snapshot selection is workspace-scoped
freshness window comes from marketing_settings
```
