import { isDueForReview, normalizeWordPractice, reviewPriority } from '@/lib/learningProgress';
import type { WordPair, WordPractice } from '@/types';

export interface SelectionOptions {
  now?: number;
  random?: () => number;
  sourceOrder?: (pair: WordPair, index: number) => number;
}

export interface BuiltInReviewSource {
  id: string;
  unlocked: boolean;
  pairs: readonly WordPair[];
  practiceByWord: Readonly<Record<string, WordPractice | undefined>>;
}

export interface CustomReviewSource {
  id: string;
  createdAt: number;
  pairs: readonly WordPair[];
  practiceByWord: Readonly<Record<string, WordPractice | undefined>>;
}

export interface BuildReviewCandidatesInput {
  builtInLevels: readonly BuiltInReviewSource[];
  customLevels: readonly CustomReviewSource[];
  now?: number;
}

export interface ReviewCandidate {
  sourceLevelId: string;
  word: string;
  pair: WordPair;
  sourceOrder: number;
  practice: WordPractice;
  priority: number;
}

export interface DailyReviewSelection {
  available: boolean;
  candidates: ReviewCandidate[];
}

interface RankedPair {
  pair: WordPair;
  word: string;
  sourceOrder: number;
  practice?: WordPractice;
  priority: number;
  tieBreaker: number;
}

function comparePriority(left: RankedPair, right: RankedPair): number {
  return right.priority - left.priority
    || (left.practice?.lastPracticedAt ?? 0) - (right.practice?.lastPracticedAt ?? 0)
    || left.sourceOrder - right.sourceOrder
    || left.tieBreaker - right.tieBreaker;
}

function compareOldest(left: RankedPair, right: RankedPair): number {
  return (left.practice?.lastPracticedAt ?? 0) - (right.practice?.lastPracticedAt ?? 0)
    || left.sourceOrder - right.sourceOrder
    || left.tieBreaker - right.tieBreaker;
}

/**
 * Pick one normal round without mutating the source list. Visible duplicate
 * words are collapsed to their first stable source occurrence.
 */
export function selectPracticePairs(
  allPairs: readonly WordPair[],
  maxPairs: number,
  practiceByWord: Readonly<Record<string, WordPractice | undefined>>,
  options: SelectionOptions = {},
): WordPair[] {
  const limit = Math.max(0, Math.min(Math.floor(maxPairs), allPairs.length));
  if (limit === 0) return [];

  const now = options.now ?? Date.now();
  const random = options.random ?? Math.random;
  const getSourceOrder = options.sourceOrder ?? ((_pair: WordPair, index: number) => index);
  const seenWords = new Set<string>();
  const ranked: RankedPair[] = [];

  allPairs.forEach((pair, index) => {
    const word = pair.join('');
    if (!word || seenWords.has(word)) return;
    seenWords.add(word);
    const stored = practiceByWord[word];
    ranked.push({
      pair,
      word,
      sourceOrder: getSourceOrder(pair, index),
      practice: stored ? normalizeWordPractice(stored) : undefined,
      priority: reviewPriority(stored, now),
      tieBreaker: random(),
    });
  });

  const unseen = ranked.filter(item => !item.practice).sort(comparePriority);
  const weakOrDue = ranked.filter(item => item.practice
    && (item.practice.correctStreak < 3 || isDueForReview(item.practice, now)))
    .sort(comparePriority);
  const maintenance = ranked.filter(item => item.practice
    && item.practice.correctStreak >= 3 && !isDueForReview(item.practice, now))
    .sort(compareOldest);

  const unseenQuota = Math.ceil(limit / 2);
  const weakQuota = Math.floor(limit / 3);
  const maintenanceQuota = limit - unseenQuota - weakQuota;
  const chosen = [
    ...unseen.splice(0, unseenQuota),
    ...weakOrDue.splice(0, weakQuota),
    ...maintenance.splice(0, maintenanceQuota),
  ];

  // A short category never shrinks the round while another category still has
  // words. The refill order is part of the product behavior, not incidental.
  for (const pool of [unseen, weakOrDue, maintenance]) {
    chosen.push(...pool.splice(0, limit - chosen.length));
    if (chosen.length === limit) break;
  }

  return chosen.map(item => item.pair);
}

interface CandidateWithSourceRank extends ReviewCandidate {
  sourceKind: 0 | 1;
  withinKindOrder: number;
  sourceId: string;
}

function sourceTieOrder(left: CandidateWithSourceRank, right: CandidateWithSourceRank): number {
  return left.sourceKind - right.sourceKind
    || left.withinKindOrder - right.withinKindOrder
    || left.sourceId.localeCompare(right.sourceId);
}

function shouldReplaceDuplicate(
  current: CandidateWithSourceRank,
  challenger: CandidateWithSourceRank,
): boolean {
  if (challenger.priority !== current.priority) return challenger.priority > current.priority;
  return sourceTieOrder(challenger, current) < 0;
}

/** Build and visible-word-deduplicate the eligible daily review pool. */
export function buildReviewCandidates(input: BuildReviewCandidatesInput): ReviewCandidate[] {
  const now = input.now ?? Date.now();
  const winners = new Map<string, CandidateWithSourceRank>();
  const customOrder = [...input.customLevels]
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  const customRank = new Map(customOrder.map((source, index) => [source.id, index]));

  const visit = (
    source: BuiltInReviewSource | CustomReviewSource,
    sourceKind: 0 | 1,
    withinKindOrder: number,
    sourceOrder: number,
  ) => {
    const currentWords = new Map<string, WordPair>();
    source.pairs.forEach(pair => {
      const word = pair.join('');
      if (word && !currentWords.has(word)) currentWords.set(word, pair);
    });

    Object.entries(source.practiceByWord).forEach(([word, stored]) => {
      const pair = currentWords.get(word);
      if (!stored || !pair) return;
      const practice = normalizeWordPractice(stored);
      if (practice.correctStreak >= 3 && !isDueForReview(practice, now)) return;
      const candidate: CandidateWithSourceRank = {
        sourceLevelId: source.id,
        word,
        pair,
        sourceOrder,
        practice,
        priority: reviewPriority(practice, now),
        sourceKind,
        withinKindOrder,
        sourceId: source.id,
      };
      const winner = winners.get(word);
      if (!winner || shouldReplaceDuplicate(winner, candidate)) winners.set(word, candidate);
    });
  };

  input.builtInLevels.forEach((source, index) => {
    if (source.unlocked) visit(source, 0, index, index);
  });
  input.customLevels.forEach(source => {
    const rank = customRank.get(source.id) ?? 0;
    visit(source, 1, rank, input.builtInLevels.length + rank);
  });

  return [...winners.values()]
    .sort((left, right) => right.priority - left.priority
      || left.practice.lastPracticedAt - right.practice.lastPracticedAt
      || sourceTieOrder(left, right))
    .map(({ sourceKind: _sourceKind, withinKindOrder: _withinKindOrder, sourceId: _sourceId, ...candidate }) => candidate);
}

/** Select the playable 2–6 word daily round from a prebuilt candidate pool. */
export function selectDailyReview(
  candidates: readonly ReviewCandidate[],
  maxPairs = 6,
): DailyReviewSelection {
  const limit = Math.max(0, Math.min(6, Math.floor(maxPairs)));
  if (candidates.length < 2 || limit < 2) return { available: false, candidates: [] };
  const ranked = [...candidates].sort((left, right) => right.priority - left.priority
    || left.practice.lastPracticedAt - right.practice.lastPracticedAt
    || left.sourceOrder - right.sourceOrder
    || left.sourceLevelId.localeCompare(right.sourceLevelId));
  return { available: true, candidates: ranked.slice(0, limit) };
}
