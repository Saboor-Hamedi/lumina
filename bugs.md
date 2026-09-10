# Fix: Silent-first-thinking + batched file creation in Lumina's agent stream

## Symptom (reproducible)

User message: "write a folder in Persian, generate 4 topics in Persian... only
4 files with 100 words each."

Current behavior:
1. User's message appears.
2. NOTHING is spoken before reasoning starts — the very next thing rendered
   is a "Thought for Ns" collapsed reasoning block, with zero conversational
   text before it.
3. (Presumed, based on prior investigation) — the 4 `createFile` tool calls
   then fire back-to-back with no narration between them, followed by one
   final wrap-up message.

Desired behavior (what "feels alive," e.g. Antigravity-style):
1. A short, natural spoken line appears FIRST, before or overlapping with
   the reasoning step (e.g. "Let me put together your یادگیری folder with 4
   Persian topic notes.").
2. Collapsed reasoning block (subtle, not the first thing the user sees).
3. For EACH file: one short narration line, THEN the tool call/file card,
   THEN the next narration line, THEN the next tool call — not narration
   once + all 4 tool calls + narration once.
4. Final short wrap-up after the last file.

## Root cause

This is a **prompt/orchestration problem, not a rendering problem** (the
streaming/timeline renderer fix from earlier in this thread already
supports interleaved segments — it just has nothing to interleave if the
model itself doesn't emit narration between actions).

Two separate causes, likely in two different places in the codebase:

### Cause 1 — nothing is emitted before `<think>` opens
Somewhere the system prompt instructs the model to open its response with
`<think>...</think>` as literally the first output. There is no instruction
telling it to say anything conversational before or alongside that. Search
the system-prompt-building file for:
- `MANDATORY WORKFLOW SEQUENCE`
- `STEP 1 (DEEP INTERNAL SELF-DEBATE REASONING)`
- `You MUST ALWAYS begin your response with an internal chain-of-thought
  inside <think>...</think> tags`

That instruction needs a new **Step 0** before it, requiring one short,
plain-text sentence to be emitted before the model opens `<think>`.

### Cause 2 — tool calls are framed as a single uninterrupted batch step
Search the same file for:
- `STEP 3 (EXECUTE TOOLS)`
- `Immediately invoke the required workspace tool calls ... in sequence
  until all requested items are created`
- `MULTI-FILE WORKFLOWS: ... never stop after creating only a folder ...
  call createFile for EACH requested note/plan/expense/summary file in
  sequence until ALL requested items are created`

This literally instructs the model to fire every `createFile` call with no
text in between, then talk once at the end (Step 4). That's the direct
cause of "narrate once → 4 silent tool calls → narrate once." It needs to
become a per-item loop instruction, not two sequential phases.

## Required fix (apply to the system-prompt template)

Replace the relevant workflow steps with:

```
STEP 0 (BRIEF SPOKEN LEAD-IN — ALWAYS FIRST, BEFORE <think>):
  Before any <think> block or tool call, output one short, natural,
  plain-text sentence stating what you're about to do (e.g. "Let me put
  together your یادگیری folder with 4 Persian topic notes."). This must
  be the very first thing you output — never open directly with <think>.

STEP 1 (INTERNAL REASONING): <think>...</think> as before — collapsed in
  the UI, comes AFTER the Step 0 lead-in, not before it.

STEP 2 (EXECUTE + NARRATE PER ITEM — NOT AS ONE BATCH):
  For EACH file or folder you create, in order:
    a. Output one short sentence about the specific item you're about to
       create (e.g. "Starting with the hub note, مرکز یادگیری.").
    b. Invoke the tool call for that one item.
    c. Optionally, one short confirmation sentence before moving to the
       next item.
  Do NOT silently chain multiple tool calls with no narration between
  them. Do NOT wait until all items are created to start talking again.
  Narrate BETWEEN each action, not only before the first and after the
  last.

STEP 3 (FINAL WALKTHROUGH): After the last item is created, give a short
  wrap-up/summary, same as before.
```

## Acceptance test

Send this exact prompt to the agent:

> "write a folder in Persian, generate 4 topics in Persian, only 4 files
> with 100 words each"

Expected output shape (each `•` is a separate streamed segment, in order):
```
• short spoken lead-in (plain text, no tags)
• collapsed <think> block
• "Starting with topic 1..." (text)
• [file card: topic 1 created]
• "Now topic 2..." (text)
• [file card: topic 2 created]
• "Now topic 3..." (text)
• [file card: topic 3 created]
• "Now topic 4..." (text)
• [file card: topic 4 created]
• final wrap-up summary (text)
```
Fail conditions to check for: any response that opens directly with a
`<think>` block and no preceding text; any response where all 4 file cards
appear back-to-back with zero narration segments between them.

## Where else to check (grep hints, since the codebase is large)

- The file that assembles the system prompt string (likely named something
  like `promptBuilder`, `systemPrompt`, or similar) — search for
  `MANDATORY WORKFLOW SEQUENCE` and `CRITICAL RULES FOR FILE & FOLDER
  TOOLS` to find both copies of the workflow instructions (this project has
  it duplicated in two places — fix both, or better, consolidate into one).
- The stream-consuming/rendering file (likely named something like
  `streamRunner` or `aiStreamRunner`) — confirm it already supports
  multiple, separately-timed text/tool segments in sequence (this should
  already be fixed from the earlier timeline refactor in this thread — if
  not yet applied, apply that first, since Step 2 above produces output
  that only renders correctly with segment-ordered rendering, not a
  fixed-slot accumulator).
- Any place that decides "how many words per file" — confirm the "100
  words each" instruction from the user's message is actually being
  enforced/passed through to the createFile content generation, since
  that's a separate correctness issue from the narration timing one.