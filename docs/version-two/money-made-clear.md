# Money Made Clear: first production format

Confirmed by the creator: 2026-09-08. This is the version-two production baseline, not a deployed channel profile or proof of rendered-media support.

## Channel brief

- Topics: personal finance, money management, investing fundamentals, banking, economics, debt, credit, and wealth building.
- Audience: adults approximately 20–45 in the US and UK seeking practical financial education.
- Tone: clear, grounded, and useful; no hype, get-rich-quick claims, or promised investment outcomes.
- Main video: one 8–12 minute long-form video each week initially.
- Repurposing: 3–5 distinct short-form clips per main video for YouTube Shorts, TikTok, Instagram Reels, and Facebook Reels.
- Presentation: primarily faceless and led by voiceover. Animated characters are not a core requirement.
- Sequence: hook → context → explanation → worked example → supporting visuals/data → key takeaway → conclusion/CTA.

## Technical target

| Area       | Required behavior                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Long-form  | 16:9, 1920×1080; approximately 20–40 scenes over 8–12 minutes                                                                                     |
| Narration  | Voiceover-led; choose exact voice during the production walkthrough. English and 30 fps are fixture defaults, not a prescribed accent or provider |
| Visuals    | Relevant stock or generated footage mixed with still images                                                                                       |
| Graphics   | Programmatic motion graphics, animated text and numerical callouts, charts/graphs/tables, and illustrative screen-style UI                        |
| Audio      | Low-volume background music and selective sound effects, with narration remaining intelligible                                                    |
| Captions   | Configurable inclusion, including burned-in captions; caption exports remain available                                                            |
| Clips      | Independently reviewable 9:16 excerpts derived from the completed source video; per-platform metadata and capability checks                       |
| Automation | Deterministic templates, structured inputs, validated assets, recoverable jobs, and explicit generation costs                                     |

The capability to use generated footage does not select a video-generation provider or authorize a paid call. Initially accept already-generated footage through the same inspected-media path as stock footage. Evaluate direct generation only if required after that path is stable.

## Visual and editorial rules for this baseline

1. Choose the medium by its explanatory purpose: footage for context, charts for relationships, tables for comparisons, and numerical callouts for arithmetic. Do not generate footage when a still or programmatic graphic explains the point adequately.
2. Render financial numbers and chart labels from validated structured values rather than relying on text baked into AI imagery. Keep source, unit, currency, period, assumptions, and rounding rules attached to the data.
3. Distinguish US and UK examples explicitly. Do not combine their currencies, products, tax rules, account protections, or regulatory assumptions into one unlabeled example.
4. Label fictional worked examples as illustrative. Verify real facts against current authoritative sources during research; the fixture is not a publish-ready finance script.
5. Preserve the voice, timing, source evidence, and media revisions used in the final render. Regenerate only changed dependencies.
6. Each short needs a self-contained hook and takeaway. Reusing a clip on four platforms is distribution, not four distinct clips. Reflow charts and callouts for vertical layouts instead of blindly cropping small labels.
7. Use reusable templates for charts, text, and UI illustrations with explicit duration, safe areas, and motion settings. Limit v1 to the templates needed by this format; no freeform animation editor.

## Executable fixture

[money-made-clear-fixture.ts](../../lib/test-utils/money-made-clear-fixture.ts) defines `money-made-clear-v1` using the existing generic baseline factory:

- 40 scenes × 15 seconds narration plus 39 gaps × 250 ms = **609.75 seconds (10:09.75)** at 1920×1080, 30 fps.
- Seven ordered editorial stages and all seven planned visual categories.
- Four distinct 45-second clip candidates, each assembled from three source scenes, at 1080×1920. These are structural test candidates; repeated section text is not finished editorial copy.
- A fictional monthly cash-flow example in neutral units: income 3000, spending categories 1800 and 600, remaining 600. These are arithmetic inputs, not typical spending or recommended allocations.
- Captions enabled/disabled, current approved-media identities, and no character layer.

**Execution limitation:** the current production composition still receives still-image/audio proxies. The manifest records intended video/graphic/audio requirements, but the test does not render B-roll, motion graphics, charts, music, or sound effects. Its durations are supplied inputs, not measured narration. The generic 489.75-second baseline remains unchanged for before/after revision comparisons.

## Capability map and roadmap commitments

| Capability                                                     | Current baseline coverage                                 | Delivery work                                                                                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Still scenes, narration, captions, framing, render snapshots   | Executable domain tests; no live output reviewed          | Preserve through V2-01/07/12                                                                                                               |
| Channel defaults, weekly cadence, repeated editorial structure | Test profile and documentation only                       | V2-04/05/06                                                                                                                                |
| Mixed B-roll and stills                                        | Requirement manifest only                                 | V2-13 inspected clips, timing, trim, framing, source/rights notes                                                                          |
| Charts, tables, callouts, motion graphics, screen examples     | Requirement manifest and arithmetic test only             | V2-13 structured data templates and deterministic rendering                                                                                |
| Low-volume music and selective effects                         | Requirement manifest only                                 | V2-14 mix controls, ducking/fades, source/rights records                                                                                   |
| Financial source review                                        | Synthetic example is explicitly labeled                   | V2-11 factual/jurisdiction-aware evidence review                                                                                           |
| 3–5 vertical derivatives                                       | Four timeline candidates tested using still/audio proxies | V2-15 editorial review, vertical graphic layouts, source compatibility, separate packages                                                  |
| Cross-platform distribution                                    | Existing platform services remain the starting point      | Reuse them in V2-15; disclose provider restrictions, including TikTok inbox handoff, rather than promising identical automatic publication |

Revision safety remains the first product fix. The richer media requirements do not move character animation ahead of reliability or introduce a new platform integration.

## Remaining live evidence

The channel/format decision is resolved. The measured creator walkthrough, actual speech/video output inspection, provider access, media sourcing, and external finishing steps remain unverified. Record measurements in [production baseline](production-baseline.md); do not mark V2-00 Verified solely because these test fixtures pass.
