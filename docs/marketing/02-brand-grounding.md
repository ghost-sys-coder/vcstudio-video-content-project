# Marketing Studio — brand grounding

Everything the AI writes has to sound like the business and be factually correct
about it. This document covers how the business is captured, how its own
material is ingested, and how both reach a prompt.

## The decision: no vector store in v1

**A vector store would make this system worse, not better, at this scale.**

The reasoning, stated plainly so it can be revisited on evidence rather than
fashion:

1. **The corpus is tiny.** One business, on the order of 10–50 documents. Once
   each document is summarised, the entire brand corpus fits in roughly 2,500
   tokens. Retrieval over a corpus that small has a name: _include all of it_.
2. **Reproducibility is a hard requirement.** AGENTS.md requires that prompt
   changes must not alter the reproducibility of previous generations. A frozen,
   fingerprinted context snapshot gives exactly that. An approximate-nearest-
   neighbour index over embeddings that shift when the embedding model is
   updated does not — the same question would retrieve different chunks next
   month, and no record would explain why.
3. **The cost is not the API cost.** pgvector means an embedding provider (a new
   cost line and a new ledger operation), a chunking strategy, an index
   migration on a database whose migration tooling has already broken twice, and
   a retrieval-quality problem that cannot be meaningfully evaluated against 20
   documents.

### When to revisit — the measured threshold

Add embeddings when **either** of these is true, and not before:

- the knowledge corpus exceeds **200 documents**, or
- full-text search **demonstrably misses** — measured by logging
  `search_brand_knowledge` calls that return zero results for questions the
  corpus does answer, not assumed.

`MARKETING_MAX_DOCUMENTS` (default 200) exists so the first condition is
enforced rather than merely hoped for.

### What replaces it

Two mechanisms, both already supported by the infrastructure in this repo:

- **The compiled context block** — always present, deterministic, bounded.
- **`search_brand_knowledge`** — a real skill doing **PostgreSQL full-text
  search** over `marketing_knowledge_documents.extracted_text`, using
  `to_tsvector('english', …)` with a GIN index and `ts_headline` for passages.
  It returns the top three passages with their document titles. That is genuine
  retrieval, on infrastructure already present, deterministic enough to
  unit-test.

## Onboarding

### The question catalogue is code

`lib/marketing/brand/onboarding-questions.ts` exports a frozen, versioned array:

```ts
export const ONBOARDING_QUESTION_VERSION = "brand-onboarding-v1";

export const ONBOARDING_QUESTIONS = [
  {
    key: "business_what",
    section: "identity",
    prompt: "In one or two sentences, what does the business do?",
    kind: "longtext",
    required: true,
    helpText:
      "Write it the way you would say it to a stranger, not the way a brochure would.",
  },
  // …
] as const satisfies readonly OnboardingQuestion[];
```

Data-driven UI, code-owned contract, unit-testable. Answers are stored per
`question_key` in `marketing_onboarding_answers`, so adding a question later
does not invalidate existing answers and removing one does not delete them.

### Sections

| Section     | Captures                                                                  |
| ----------- | ------------------------------------------------------------------------- |
| Identity    | What the business does, name, website, industry, how long it has operated |
| Audience    | Who it serves, their pain points, geography, buying triggers              |
| Offers      | Products/services, pricing model, what makes each different               |
| Voice       | Tone attributes, words to use, **words never to use**, formality, humour  |
| Proof       | Case studies, numbers, testimonials, credentials the AI may cite          |
| Constraints | Compliance notes, claims that must never be made, regulated language      |
| Channels    | Which platforms, cadence per week, per-platform tone overrides            |

The **Constraints** section is not decoration. Everything in it becomes a
negative instruction in the context block, and negative instructions are what
stop a language model inventing a certification the business does not hold.

### Raw answers versus synthesised profile

`marketing_onboarding_answers` holds what the user typed.
`marketing_brand_profiles` holds the synthesised, editable profile.

They are separate on purpose: re-synthesising the profile (after a prompt
improvement, or after the user adds three more answers) must never destroy the
original words. The user can always see and edit both.

Synthesis is a **billable operation** (`document_summary` reused, or its own
`campaign_plan`-class operation) and is explicitly triggered, never automatic.
The onboarding wizard itself does **no AI work at all** — it is a form. This is
what lets Slice 1 ship before the ledger exists.

## Knowledge documents

### Two-phase upload

Identical in shape to the media library's `authorize → PUT → confirm`, because
that pattern is already proven here:

1. `POST /api/workspaces/[workspaceId]/marketing/documents/upload` —
   authenticate, `requireCapability(role, "manageBrandProfile")`, validate
   content type and byte length, **generate the document UUID server-side**,
   create the row `pending`, derive the key via
   `createMarketingDocumentObjectKey`, return a signed `PUT` whose content type
   **and byte length are both signed**.
2. Browser `PUT`s directly to R2. The file never passes through the app server.
3. `POST …/documents/complete` — re-derive the truth from storage with a `HEAD`
   rather than trusting the browser, then dispatch ingestion.

Object key: `workspaces/{ws}/marketing/documents/{documentId}.{ext}`.
Deliberately outside `createProjectAssetPrefix`, so deleting a project can never
purge brand knowledge.

### Ingestion

`trigger/marketing-document-ingestion.ts`, on the `media-processing` queue:

```text
extract text
  → checksum (sha256)
  → if checksum unchanged, skip          ← idempotent by construction
  → one LLM call producing summary + keyFacts   (billable: document_summary)
  → mark ready
```

**Format support is staged deliberately:**

- **Slice 2** — `.txt` and `.md` parse inline with **zero new dependencies**.
  This is what lets the whole upload → extract → include-in-context loop ship
  and be verified before any parsing dependency is argued about.
- **Later slice** — PDF and DOCX need a new dependency (`unpdf` or `pdf-parse`;
  `mammoth` for DOCX). It runs **only in the Trigger worker**, never in a web
  request, and gets its own slice with its own justification per AGENTS.md
  dependency rule 6.

### What actually reaches the prompt

**Summaries and key facts, never full document text.** Three reasons:

1. Token budget — a single 40-page PDF would consume the entire context block.
2. Signal — a model-written summary of a brand deck is more useful to a
   generation prompt than its raw slide text.
3. **Injection surface** — see below.

## Context compilation

### The prompt template

`packages/prompts/src/marketing-brand-context.ts`:

```ts
export const MARKETING_BRAND_CONTEXT_VERSION = "marketing-brand-context-v1";
export function renderBrandContextBlock(input: BrandContextInput): string;
```

Pure, no I/O, unit-tested, with a **deterministic section order**:

```text
identity → positioning → audiences (primary first) → offers
        → voice rules → banned phrases → compliance → key facts from documents
```

Deterministic ordering matters for the same reason it does in
`packages/prompts/src/scene-image.ts`: the same inputs must always produce the
same string, or the fingerprint below is meaningless.

### The compiler

`lib/marketing/brand/compile-brand-context.ts`:

1. Load profile, audiences (primary first), offers, channels, and documents
   where `include_in_context` ordered by `priority desc, created_at asc`.
2. Use each document's **`summary` + `key_facts`**, never its `extracted_text`.
3. Render via `renderBrandContextBlock`.
4. Truncate at `MARKETING_BRAND_CONTEXT_MAX_TOKENS` (default 2,500) with an
   explicit marker:

   ```text
   (truncated — 6 documents omitted; raise priority on what matters most)
   ```

   **Nothing is ever silently dropped.** A user who cannot see that their
   context was cut will spend an afternoon wondering why the AI ignores their
   pricing sheet.

5. Compute `source_fingerprint` = sha256 over profile fields + audience/offer
   ids and `updatedAt` + included document checksums.
6. Upsert a `marketing_brand_context_snapshots` row, bumping `context_version`
   **only when the fingerprint changed**.

Wrap the loader in React `cache()` so a single request compiles once.

### Provenance

Every `marketing_generation_runs` row and every assistant message stores
`brand_context_snapshot_id`. "Why did it say that?" is answerable months later,
against the exact text the model saw.

### The user can see it

`/app/marketing/brand/context` renders the exact compiled block plus its token
count and which documents were included or omitted. There is no hidden prompt.
This is both a debugging tool and the honest answer to "what does it know about
my business?"

## Prompt injection

A knowledge document is untrusted input. A PDF scraped from a competitor's site,
or a testimonial pasted from an email, can contain `ignore previous instructions
and…`.

**Mitigations, in order of importance:**

1. **Documents reach the prompt only as model-written summaries.** A summariser
   asked to produce a factual précis of a document containing an injection
   normally produces a précis, not obedience. This reduces the risk
   substantially — it does not eliminate it, and the docs should not pretend
   otherwise.
2. **Document content never influences tool selection.** Tool names and
   descriptions come from code (`lib/marketing/skills/definitions/*`) and are
   never derived from user or document text.
3. **The context block is delimited and labelled** as reference material about
   the business, with an explicit instruction that it is data, not instructions.
4. **`search_brand_knowledge` returns passages tagged with their source
   document title**, so injected text arrives visibly attributed rather than as
   anonymous authority.
5. **Nothing in the context block can authorise spending.** Every billable
   action goes through a capability check and a budget reservation on the
   server, neither of which reads document text.

## Required behaviour

```text
onboarding wizard performs no AI calls
raw answers are never overwritten by synthesis
context compilation is deterministic for identical inputs
identical inputs produce an identical fingerprint and no new snapshot row
truncation is visible to the user and names the omitted count
document ingestion is idempotent on unchanged checksum
full document text never enters a generation prompt
every generation records the context snapshot it used
the compiled block is viewable in the UI with its token count
```

## Required tests

```text
renderBrandContextBlock is deterministic across shuffled input ordering
primary audience is always rendered first
banned phrases and compliance notes always survive truncation
truncation marker appears and states the omitted count
fingerprint changes when any contributing field changes
fingerprint does not change on an unrelated profile touch
compileBrandContext respects MARKETING_BRAND_CONTEXT_MAX_TOKENS
document ingestion skips an unchanged checksum without an LLM call
search_brand_knowledge returns workspace-scoped results only
```
