# P2 Lightweight Review Loop Product Specification

## Objective

Make the game remember which words a child needs to revisit and turn that memory into a short, calm daily review. P2 must improve learning value without adding image generation, a parent account, a cloud backend, or a second game mechanic.

## Product promise

The child should feel: “The game remembers what I am learning, but it does not punish me.” The parent should be able to answer three questions locally on the iPad:

1. Which words have been practised?
2. Which words still need support?
3. Which words have become familiar?

## Scope and vocabulary

- A **practice event** is one correct match, one wrong cross-column attempt, or one use of a hint that reveals a word.
- A **review candidate** is a previously encountered word that is weak or due.
- A **daily review** is a normal six-pair game round composed from review candidates. It reuses the existing board, mission scene, speech, stars, and completion flow.
- “Daily” is friendly product language, not a once-per-calendar-day lock. The child may replay it.

## Learning record

Extend `WordPractice` with optional fields so old saves remain valid:

- `correctCount`: total correct matches.
- `wrongCount`: total wrong attempts attributed to this word; defaults to `0`.
- `hintCount`: total hints that revealed this word; defaults to `0`.
- `correctStreak`: consecutive correct matches since the last wrong attempt or hint; defaults to the migrated `correctCount` capped at `3`.
- `lastPracticedAt`: last event timestamp.

Event rules:

- Correct: increment `correctCount` and `correctStreak`; update time.
- Wrong cross-column choice: increment `wrongCount`, reset `correctStreak` to `0`, and update time for each distinct intended word represented by the two selected cells.
- Hint: increment `hintCount`, reset `correctStreak` to `0`, and update time for the revealed word.
- Same-column guidance and selecting/cancelling one tile are not mistakes. Same-column guidance increments neither learning mistakes nor the attempt-level `mistakeCount` used for stars.

## Learning status

Statuses are derived, not stored:

- **初次接触:** no record.
- **待巩固:** `correctStreak` is `0` or `1`.
- **正在熟悉:** `correctStreak` is `2`.
- **已经熟悉:** `correctStreak >= 3`.
- **该复习了:** any encountered word whose `lastPracticedAt` is at least seven days old; this affects selection priority but the child-facing label remains encouraging.

No status uses speed. A slow correct answer is still correct.

## Pair selection

Review priority is deterministic for a supplied `now`:

```text
priority = streakNeed + wrongCount × 30 + hintCount × 20 + overdueDays × 5
streakNeed: streak 0 → 600, streak 1 → 500, streak 2 → 300, streak 3+ → 100
overdueDays: max(0, wholeDaysSinceLastPractice - 6), capped at 30
```

“Weak or due” means an encountered word with `correctStreak < 3` or age of at least seven whole days. “Maintenance” means an encountered word with `correctStreak >= 3` that is not due. Equal scores are ordered by older `lastPracticedAt`, then stable source order; injected randomization may shuffle only exact ties.

### Normal curriculum round

For a round of `N` pairs, fill in this order while avoiding duplicates:

1. Up to `ceil(N / 2)` unseen words.
2. Up to `floor(N / 3)` weak or due words, highest review priority first.
3. Remaining slots from maintenance words, preferring the least recently practised.

This gives `3 / 2 / 1` for six pairs and `4 / 2 / 2` for eight. If a category is short, fill its unused slots from the combined remaining candidates in this order: unseen, weak/due by priority, then maintenance by oldest practice. If still short, return the available pool without duplicates. Randomization is permitted only inside exact-priority ties so tests can inject a deterministic random source.

### Daily review round

- Candidate pool: encountered words from unlocked built-in levels plus saved custom levels that still exist. Locked levels, deleted custom levels, words removed from their current source pair list, and recent familiar words are excluded.
- Select up to six highest-priority candidates.
- Priority increases with wrong count, hint count, low correct streak, and days since last practice.
- If fewer than two candidates exist, the entry remains visible but explains that the child should play another normal round first.
- If two to five candidates exist, the board uses that exact pair count; the mission scene must receive the same count.
- Review completion updates the original level’s word record; it does not unlock curriculum levels or overwrite curriculum stars.

Candidate identity is `(sourceLevelId, word)`, but the board must not contain the same visible word twice. If the same word exists in multiple sources, keep only the candidate with the highest review priority; ties prefer built-in curriculum order, then custom creation order, then lexical source ID. Correct, wrong, and hint events update only that winning source record.

## Child-facing experience

### Entry

The level map gains one compact “今日复习” card. It shows only real local data:

- ready state: number of review words and an estimated “约 2–3 分钟”;
- empty state: “再玩一关，就能开始复习”；
- never fabricated percentages or streak-day counters.

Before production integration, provide one 1024×768 landscape v0 comparing three placements using the current warm-paper visual language:

1. **Map companion card (recommended):** a compact card near the current mission path.
2. **Bottom review dock:** a persistent low strip below the path.
3. **Word-book entry:** review starts from the existing word-book screen.

The user selects one placement before production UI work.

**Approved placement (2026-09-19): B — Bottom review dock.** Keep it as a compact persistent strip beneath the mission path so the path remains primary and “我的字库” stays reachable. Production UI and browser acceptance tests must use this placement.

### During play

- Review uses the same two-column board and scene-restoration feedback.
- The heading identifies it as “今日复习” and explains that these are words worth seeing again.
- No timer, combo pressure, lives, red failure screen, or generated image.

### Completion

The completion modal receives a compact learning summary:

- `本轮练习 N 个词`;
- `更熟悉 M 个` when one or more words crossed into `correctStreak >= 3` during the round;
- `下次再见 K 个` for words that remain below mastery.

Do not claim a word is permanently mastered. Use “已经熟悉” rather than “已学会”.

## Parent-readable summary

The word book adds three filter counts and filters:

- 全部练过
- 待巩固
- 已经熟悉

This is a local summary, not a parent dashboard. It contains no charts, accounts, exports, rankings, or cloud synchronization.

## Design system

- Reuse paper `#fdf6e3`, ink `#231810`, vermilion/orange, amber, and sage.
- Reuse Ma Shan Zheng / ZCOOL KuaiLe / PingFang SC fallbacks.
- 8px spacing rhythm; 16px secondary radius and 20–24px primary cards.
- Two existing shadow levels; no new glass/gradient visual language.
- 300–500ms ease-out state changes; respect reduced motion.
- Touch targets remain at least 44px.
- Text-first; no new image or icon asset dependency.

## Migration and persistence

- `normalizeSaveData` must accept every P0/P1 save shape.
- Missing counters become `0`; migrated historical correct records receive `correctStreak = min(correctCount, 3)` so existing practice is not erased.
- Corrupt or negative values are clamped to safe non-negative integers.
- Persistence remains localStorage through `useSaveData`.
- No schema-version prompt or destructive reset.

## Acceptance criteria

- Correct, wrong, and hint events update the intended word records exactly once.
- Same-column guidance does not record a mistake.
- Old saves normalize without losing cards, stories, unlocks, stars, or practice history.
- Normal selection demonstrably mixes unseen, weak/due, and maintenance words when available.
- Daily review selects the highest-priority valid candidates and supports two to six pairs.
- Review never unlocks a level or changes curriculum stars.
- Word-book filters and completion summary match the underlying records.
- The selected entry treatment and every review state fit at 1024×768 landscape.
- No image-generation request is introduced.
- TypeScript, focused tests, full tests, and production build pass.

## Out of scope

- Full SM-2/FSRS spaced repetition.
- Parent analytics dashboard or cloud sync.
- Timed combos, leaderboards, lives, streak-day pressure, or notifications.
- Audio-effect settings, haptics, handwriting, or new curriculum semesters.
- Runtime or offline image generation.
