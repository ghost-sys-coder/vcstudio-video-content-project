# Caption timing: what is measured, and what would have to be true to pay for more

Last updated: 2026-09-11. Owner: Claude.

This record exists because V2-12 acceptance item five requires provider
selection, measured accuracy, cost, privacy behaviour and retry policy to be
**recorded before a paid path is enabled**. Nothing here enables one. It states
what is in use, what is deliberately absent, and what evidence a paid decision
would need.

## What the application does today

| Source           | What it means                                                                  | Cost |
| ---------------- | ------------------------------------------------------------------------------ | ---- |
| `estimated`      | Each line's share of the scene is its share of the characters                  | none |
| `pause_adjusted` | Line breaks moved onto silences measured in the narration's amplitude envelope | none |
| `manual`         | A person set the times                                                         | none |

No transcription and no forced alignment is performed. No audio leaves this
application for timing purposes. There is no provider to select, no request to
retry, and no bill.

`pause_adjusted` reuses data the application already has. Every narration clip
carries an amplitude envelope, sampled at 50 Hz, computed once when the audio is
produced because the renderer needs it for mouth movement. Reading silences out
of it costs nothing and adds no dependency.

## What that can and cannot do

It can tell where sound stops. It cannot tell which word is being spoken.

So a break can be placed on a real pause, and the words inside a line are still
spread by character count. The interface says exactly that, and the vocabulary
in `lib/subtitles/cue-timing-source.ts` is constrained by a test that refuses
the words "aligned", "synced", "accurate", "exact" and "precise". A fourth
source cannot appear by a phrase drifting into a string; it has to be a
deliberate edit to that module and that test.

Boundary movement is bounded to 400 ms. Beyond that a pause belongs to a
different phrase, and dragging a break onto it would be worse than the estimate
it replaced. This is why the feature can only improve a nearly-right boundary
and cannot invent a structure the text does not have.

## What a paid path would have to establish first

None of the following has been measured, and no provider has been trialled.
Recording them is the gate, not a formality:

1. **Accuracy, measured on this channel's own narration.** Word-level error
   against a hand-checked transcript, on at least: a clip with deliberate
   dramatic pauses, one containing proper nouns and product names, one in a
   language other than English, and one where the delivered narration departs
   from the written script. The last case matters most, because that is where
   alignment either earns its cost or fails quietly.
2. **Cost per minute of narration**, and the resulting cost per video at this
   channel's typical length, checked against the existing per-project and
   workspace budget limits. Alignment would be the first caption-side billable
   operation, so it needs an estimate, a reservation and reconciliation like
   every other, per `AGENTS.md`.
3. **Privacy behaviour.** Whether narration audio is retained by the provider,
   for how long, whether it can be used for training, and whether a
   zero-retention mode exists. Narration is the creator's own voice or a voice
   licensed to them.
4. **Retry policy.** Alignment must be bounded like every other billable
   operation. A failure has to leave the existing timing usable rather than
   blocking a render, which is why `estimated` remains a real state rather than
   an error.
5. **What happens when it is wrong.** A confidently wrong alignment is worse
   than an honest estimate, because nobody checks a track that says it was
   aligned. Any provider path must expose per-cue confidence, or be labelled no
   more strongly than what is already here.

## Decision

**Not selected, not enabled, and not scheduled.** The free pause adjustment
covers the visible fault it was meant to cover, which is a caption breaking
mid-word. Paid alignment stays an open decision until the five items above are
recorded.
