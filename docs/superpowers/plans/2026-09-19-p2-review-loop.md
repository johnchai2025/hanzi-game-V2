# P2 Lightweight Review Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local, encouraging mastery records and a short daily-review round that prioritizes weak or overdue words without adding images or a second game mechanic.

**Architecture:** Keep learning calculations in pure modules, storage mutation in `useSaveData`, and gameplay event ownership in `useGame`. Represent review as a generated `LevelData` plus per-word source metadata so it can reuse `GameScreen`; keep curriculum completion and review completion separate. Gate visible UI integration behind a three-placement v0 decision.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, localStorage, existing global CSS, Playwright Test.

---

## Safety and scope

- Read relevant guides in `node_modules/next/dist/docs/01-app/` before application edits.
- Preserve the P0 game loop and P1 mission-scene completion delay.
- Never call image-generation APIs or introduce remote visual assets.
- Do not begin child-facing UI integration until the v0 placement is accepted.
- Work on a `codex/` branch; do not commit generated `test-results/`.

## File map

- Create `design-demos/p2-review-entry-v0.html`: three entry-placement treatments and ready/empty states.
- Create `lib/learningProgress.ts`: normalization, event reducers, derived status, review priority, and summaries.
- Create `lib/reviewSelection.ts`: normal-round quota selection and cross-level review candidate selection.
- Create `lib/reviewRound.ts`: pure review-context, event projection, and summary lifecycle helpers.
- Create `tests/learning-progress.spec.ts`: migration and event/status tests.
- Create `tests/review-selection.spec.ts`: deterministic quota/priority tests.
- Create `tests/review-round.spec.ts`: review lifecycle and side-effect guard tests.
- Modify `types.ts`: optional learning counters and review source metadata.
- Modify `hooks/useSaveData.ts`: normalized migration and one `recordPracticeEvent` API.
- Modify `hooks/useGame.ts`: typed correct/wrong/hint event callbacks.
- Modify `components/GameScreen.tsx`: send events, accept review context, and build round summary.
- Create `components/ReviewEntryCard.tsx`: selected ready/empty treatment.
- Modify `components/LevelSelectScreen.tsx`: host review entry and start callback.
- Modify `components/CompletionModal.tsx`: optional learning summary.
- Modify `components/WordBookScreen.tsx`: local learning-status filters.
- Modify `app/page.tsx`: derive review candidates and route review rounds without curriculum completion.
- Modify `app/globals.css`: selected review entry, summary, and filters.
- Modify `tests/core-loop.spec.ts`, `tests/progress.spec.ts`: event, migration, review flow, and 1024×768 assertions.

### Task 1: Build and approve the review-entry v0

**Files:**
- Create: `design-demos/p2-review-entry-v0.html`

- [x] **Step 1: Build a 1024×768 comparison canvas**

Recreate the existing level-map shell and compare A map companion card, B bottom review dock, and C word-book entry. Add a state toggle for ready (`6 个词 · 约 2–3 分钟`) and empty (`再玩一关，就能开始复习`). Use only current product tokens and CSS shapes.

- [x] **Step 2: Cover interaction states**

Show default, focus/pressed, ready, and empty/disabled states. Keep all touch targets at least 44px and expose semantic button/description text.

- [x] **Step 3: Verify landscape layouts**

Inspect at 1024×768 and 1180×760. Confirm the trail remains primary, the review purpose is understandable within two seconds, and “我的字库” remains reachable.

- [x] **Step 4: Present and pause**

Open the prototype and obtain explicit selection of A, B, or C before Task 6 UI implementation. Tasks 2–5 (pure data/event work) may proceed only if the user explicitly asks to continue before choosing.

Decision: **B — Bottom review dock**, approved by the user on 2026-09-19.

### Task 2: Add normalized learning records

**Files:**
- Modify: `types.ts`
- Create: `lib/learningProgress.ts`
- Create: `tests/learning-progress.spec.ts`
- Modify: `tests/progress.spec.ts`

- [ ] **Step 1: Write failing migration and reducer tests**

Cover an old `{ correctCount, lastPracticedAt }` record, absent fields, negative/corrupt numeric inputs, correct/wrong/hint events, duplicate wrong words, status thresholds, seven-day due boundary, and a pure round summary. Use an injected `now` timestamp.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- tests/learning-progress.spec.ts tests/progress.spec.ts`

Expected: FAIL because learning helpers and fields do not exist.

- [ ] **Step 3: Implement pure learning helpers**

Export `normalizeWordPractice`, `applyPracticeEvent`, `getLearningStatus`, `isDueForReview`, `reviewPriority`, and `summarizeRound`. Clamp counters to non-negative integers and preserve all unrelated save fields.

- [ ] **Step 4: Route save normalization through helpers**

Update `normalizeSaveData` so every word record receives safe counters and migrated streaks. Do not change localStorage keys.

- [ ] **Step 5: Run focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

Commit: `feat: add normalized learning progress`

### Task 3: Implement deterministic review selection

**Files:**
- Create: `lib/reviewSelection.ts`
- Create: `tests/review-selection.spec.ts`
- Modify: `lib/practiceSelection.ts`

- [ ] **Step 1: Write failing selection tests**

Test exact fixtures for a six-word normal round selecting `3 unseen / 2 highest-priority weak-or-due / 1 oldest maintenance`, and an eight-word custom round selecting `4 / 2 / 2`. Cover category shortages redistributed unseen → weak/due → maintenance, the exact priority formula at the seven-day boundary, and exact-tie randomization with injected `now` and random.

For daily review, cover unlocked versus locked built-ins, deleted custom sources, words removed from current pair lists, recent familiar exclusion, two-to-six sizing, and duplicate visible words across sources. Assert that duplicate resolution chooses highest priority, then built-in curriculum order, then custom creation order/source ID, and preserves the winning `(sourceLevelId, word)` metadata.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- tests/review-selection.spec.ts tests/practice-selection.spec.ts`

Expected: FAIL because the new selectors do not exist.

- [ ] **Step 3: Implement selectors**

Export `selectPracticePairs`, `buildReviewCandidates`, and `selectDailyReview`. Keep all functions pure. Implement the exact priority formula and `ceil(N/2) / floor(N/3) / remainder` quotas from the spec. Include `{ sourceLevelId, word, pair, sourceOrder }` metadata so correct, wrong, and hint events update only the deduplicated winning source.

- [ ] **Step 4: Keep the compatibility wrapper**

Retain `pickPairsForPractice` as a small wrapper or update all callers in the same task; do not maintain two different selection algorithms. The compatibility path must receive full `WordPractice` records, not reduce them to the current `Set` of practised words.

- [ ] **Step 5: Run focused tests and commit**

Expected: PASS.

Commit: `feat: prioritize weak and due words`

### Task 4: Record correct, wrong, and hint events exactly once

**Files:**
- Modify: `hooks/useGame.ts`
- Modify: `hooks/useSaveData.ts`
- Modify: `components/GameScreen.tsx`
- Modify: `app/page.tsx`
- Modify: `tests/core-loop.spec.ts`

- [ ] **Step 1: Add failing event-flow tests**

Assert correct increments correct/streak once; a wrong cross-column attempt records each distinct intended word and resets streak; same-column guidance records neither a learning event nor `mistakeCount`; hint records the revealed word once; restart does not duplicate events; old `onRecordWordPractice` behavior is replaced without double-writing. Keep this task focused on curriculum/custom event ownership; review-source routing is covered in Task 5 after review context exists.

- [ ] **Step 2: Expose typed callbacks from `useGame`**

Add `onPairMistake` and `onHintUsed` next to `onPairEliminated`. Return the actual revealed word from the chosen hint and distinct intended words from a cross-column mismatch. Same-column selection emits nothing and no longer increments the attempt-level mistake count.

- [ ] **Step 3: Add one storage mutation API**

Replace `recordWordPractice(levelId, word)` with `recordPracticeEvent({ levelId, word, type, at })`. Apply pure reducers inside `setSaveData`, persist once, and keep a temporary compatibility wrapper only if another caller still needs it.

- [ ] **Step 4: Wire GameScreen and page**

Pass all three event types through GameScreen. Correct events continue to drive speech/cards; wrong and hint events never create word cards.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- tests/core-loop.spec.ts tests/learning-progress.spec.ts`

Expected: PASS.

Commit: `feat: record learning attempts`

### Task 5: Add review-round routing without curriculum side effects

**Files:**
- Modify: `types.ts`
- Create: `lib/reviewRound.ts`
- Modify: `app/page.tsx`
- Modify: `components/GameScreen.tsx`
- Modify: `hooks/useGame.ts`
- Modify: `components/CompletionModal.tsx`
- Create: `tests/review-round.spec.ts`
- Modify: `tests/core-loop.spec.ts`

- [ ] **Step 1: Write failing pure review-round tests**

Create `tests/review-round.spec.ts` for pure helpers; no component-testing framework or temporary app route is added. Seed duplicate-source winners across levels and cover all three event types updating only winning sources, a six-candidate context, an exact two-candidate context, restart baseline refresh, and the curriculum/custom side-effect guard. Use `renderToStaticMarkup` only to confirm MissionScene receives `2 / 2` and `6 / 6`; interactive browser start-to-finish coverage waits for the visible entry in Task 6.

- [ ] **Step 2: Add review context**

Implement pure `createReviewContext`, `applyReviewRoundEvent`, `summarizeReviewRound`, and `allowsCurriculumCompletion` helpers in `lib/reviewRound.ts`. Represent review as a generated level plus `{ sourceByWord, baselineBySourceKey }`. Pass an explicit `mode: 'curriculum' | 'custom' | 'review'` to GameScreen instead of inferring review behavior from ID strings. `useGame` owns and returns the authoritative current pair list; GameScreen must not retain a divergent duplicate after restart or deadlock replacement. Board rows and MissionScene `totalCount` always use the authoritative list length.

- [ ] **Step 3: Generate the learning summary**

Track a pure per-round projection keyed by `(sourceLevelId, word)`, initialized from a fresh storage baseline whenever the round starts or restarts. Correct/wrong/hint events update it exactly once. At completion—after the final correct event has entered the projection—count distinct final-round words: `practised` is the authoritative final pair count; `becameFamiliar` crossed from baseline streak below `3` to projected streak at least `3`; `revisit` ends below `3`. Deadlock replacement refreshes source metadata before any replacement event. Pass the frozen summary into CompletionModal and keep the existing 700ms scene delay.

- [ ] **Step 4: Guard curriculum completion**

Review mode must not call `completeLevel`, `incrementPlayCount`, or next-level navigation. It may restart the same review or return to the map/word book.

- [ ] **Step 5: Cover lifecycle boundaries**

Add tests for restart baseline refresh, deadlock replacement metadata, the final event appearing in the frozen summary, restart at 650ms cancelling the old 700ms modal, and navigation/unmount cancellation. The deadlock fixture must reuse an already-eliminated word and still preserve distinct-word summary counts and authoritative mission size.

- [ ] **Step 6: Run focused tests and commit**

Expected: PASS.

Commit: `feat: add daily review game mode`

### Task 6: Implement the approved review-entry treatment

**Files:**
- Create: `components/ReviewEntryCard.tsx`
- Modify: `components/LevelSelectScreen.tsx`
- No placement-C changes to `components/WordBookScreen.tsx`; placement B is approved
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/core-loop.spec.ts`

- [ ] **Step 1: Write failing ready/empty/layout tests**

Use the approved placement B recorded in the spec and test the level map. At 1024×768 assert ready copy/count/action, empty explanation/disabled action, the mission path remains prominent, there is no overflow, and “我的字库” remains reachable. Verify keyboard focus and an accessible name.

- [ ] **Step 2: Implement the accepted v0 treatment**

Use real candidate count and a fixed “约 2–3 分钟” estimate. Do not add percentage, streak days, images, or a fabricated statistic.

- [ ] **Step 3: Connect review start**

Clicking ready starts the generated review context. Empty state remains visible and explains how to unlock review.

- [ ] **Step 4: Add the full browser review flow**

Seed duplicate-source and six-candidate data, start from the approved visible entry, complete the review, and assert winning source records update while curriculum stars, unlocks, completion, and custom play counts remain byte-for-byte unchanged. Repeat with two candidates and verify exact board/mission sizing.

- [ ] **Step 5: Run browser tests and commit**

Expected: PASS.

Commit: `feat: add daily review entry`

### Task 7: Add learning filters and completion feedback

**Files:**
- Modify: `components/WordBookScreen.tsx`
- Modify: `components/CompletionModal.tsx`
- Modify: `app/globals.css`
- Modify: `tests/core-loop.spec.ts`

- [ ] **Step 1: Write failing filter and summary tests**

Assert all-practised, needs-support, and familiar counts; filtering behavior; encouraging empty states; and optional completion-summary rows. Ensure existing completion modal remains unchanged when no summary is supplied.

- [ ] **Step 2: Implement derived filters**

Use `getLearningStatus`; never store a second status value. Filters operate on actually practised words only.

- [ ] **Step 3: Implement optional summary UI**

Render only non-zero meaningful rows and use “已经熟悉” language. Preserve current stars/actions and P1 timing.

- [ ] **Step 4: Run focused tests and commit**

Expected: PASS.

Commit: `feat: show learning progress feedback`

### Task 8: Final verification and V2 handoff

**Files:**
- Modify only files needed to resolve verified failures.

- [x] **Step 1: Run static and automated checks**

Run scoped ESLint, `npx tsc --noEmit`, and `npm test`.

Expected: zero new lint/type errors and all tests pass.

- [x] **Step 2: Run production build**

Run: `npm run build`

Expected: successful Next.js production build.

- [x] **Step 3: Inspect representative states**

Visually inspect ready/empty entry, review with two and six pairs, normal mixed selection, completion summary, all three word-book filters, 1024×768, 1180×760, and reduced motion.

- [x] **Step 4: Verify regression boundaries**

Confirm curriculum/custom completion, stars, mission scene, 700ms modal delay, speech, cards, story, hint, restart, deadlock, save migration, and no image-generation request from gameplay.

- [x] **Step 5: Prepare V2 handoff**

Commit approved documentation and code, request user testing, then merge/push `main` to `v2` only after acceptance.

Verification completed on 2026-09-20: 62/62 tests pass, TypeScript and production build pass, the approved B entry and representative 2/6-word review flows fit the supported iPad landscape viewport, and the final whole-feature review is approved. Awaiting user acceptance before merging and pushing `v2/main`.
