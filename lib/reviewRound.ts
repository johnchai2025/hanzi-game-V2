import { applyPracticeEvent, normalizeWordPractice, type PracticeEventType } from '@/lib/learningProgress';
import type { ReviewCandidate } from '@/lib/reviewSelection';
import type { GameMode, LearningSummary, ReviewContext, SaveData, WordPair, WordPractice } from '@/types';

const REVIEW_LEVEL_ID = 'daily-review';
const SOURCE_KEY_SEPARATOR = '\u0000';

export interface ReviewRoundEvent {
  type: PracticeEventType;
  words: readonly string[];
  at: number;
}

export interface RoutedPracticeEvent extends ReviewRoundEvent {
  levelId: string;
  words: string[];
}

export interface AppliedReviewRoundEvent {
  projectionBySourceKey: Record<string, WordPractice>;
  routedEvents: RoutedPracticeEvent[];
}

export function reviewSourceKey(sourceLevelId: string, word: string): string {
  return `${sourceLevelId}${SOURCE_KEY_SEPARATOR}${word}`;
}

function practiceAt(
  practiceByLevel: SaveData['practiceByLevel'],
  sourceLevelId: string,
  word: string,
  fallback?: WordPractice,
): WordPractice {
  return normalizeWordPractice(practiceByLevel[sourceLevelId]?.[word] ?? fallback);
}

/** Build a playable generated level while retaining each deduplicated winner. */
export function createReviewContext(
  candidates: readonly ReviewCandidate[],
  practiceByLevel: SaveData['practiceByLevel'],
): ReviewContext {
  const sourceByWord: ReviewContext['sourceByWord'] = {};
  const baselineBySourceKey: ReviewContext['baselineBySourceKey'] = {};
  const pairs: WordPair[] = [];

  candidates.forEach(candidate => {
    if (sourceByWord[candidate.word]) return;
    sourceByWord[candidate.word] = {
      sourceLevelId: candidate.sourceLevelId,
      word: candidate.word,
    };
    baselineBySourceKey[reviewSourceKey(candidate.sourceLevelId, candidate.word)] = practiceAt(
      practiceByLevel,
      candidate.sourceLevelId,
      candidate.word,
      candidate.practice,
    );
    pairs.push(candidate.pair);
  });

  return {
    level: {
      id: REVIEW_LEVEL_ID,
      grade: 2,
      level: 0,
      title: '今日复习',
      pairs,
      boardRows: pairs.length,
      boardCols: 2,
    },
    sourceByWord,
    baselineBySourceKey,
  };
}

/** Refresh storage baselines on restart without changing selected winners. */
export function refreshReviewContext(
  context: ReviewContext,
  practiceByLevel: SaveData['practiceByLevel'],
): ReviewContext {
  const baselineBySourceKey: Record<string, WordPractice> = {};
  Object.values(context.sourceByWord).forEach(source => {
    const key = reviewSourceKey(source.sourceLevelId, source.word);
    baselineBySourceKey[key] = practiceAt(
      practiceByLevel,
      source.sourceLevelId,
      source.word,
      context.baselineBySourceKey[key],
    );
  });
  return { ...context, baselineBySourceKey };
}

/** Project immediately for summary accuracy and return batched source writes. */
export function applyReviewRoundEvent(
  context: ReviewContext,
  projectionBySourceKey: Readonly<Record<string, WordPractice>>,
  event: ReviewRoundEvent,
): AppliedReviewRoundEvent {
  const projection = { ...projectionBySourceKey };
  const wordsByLevel = new Map<string, string[]>();

  new Set(event.words.filter(Boolean)).forEach(visibleWord => {
    const source = context.sourceByWord[visibleWord];
    if (!source) return;
    const key = reviewSourceKey(source.sourceLevelId, source.word);
    const updated = applyPracticeEvent(
      { [key]: projection[key] ?? context.baselineBySourceKey[key] },
      { type: event.type, words: [key] },
      event.at,
    );
    projection[key] = updated[key];
    const grouped = wordsByLevel.get(source.sourceLevelId) ?? [];
    grouped.push(source.word);
    wordsByLevel.set(source.sourceLevelId, grouped);
  });

  return {
    projectionBySourceKey: projection,
    routedEvents: [...wordsByLevel].map(([levelId, words]) => ({
      levelId,
      words,
      type: event.type,
      at: event.at,
    })),
  };
}

export function summarizeReviewRound(
  context: ReviewContext,
  projectionBySourceKey: Readonly<Record<string, WordPractice>>,
  finalPairs: readonly WordPair[],
): LearningSummary {
  const words = [...new Set(finalPairs.map(pair => pair.join('')).filter(Boolean))];
  let becameFamiliarCount = 0;
  let revisitCount = 0;

  words.forEach(word => {
    const source = context.sourceByWord[word];
    if (!source) return;
    const key = reviewSourceKey(source.sourceLevelId, source.word);
    const baseline = normalizeWordPractice(context.baselineBySourceKey[key]);
    const projected = normalizeWordPractice(projectionBySourceKey[key] ?? baseline);
    if (baseline.correctStreak < 3 && projected.correctStreak >= 3) becameFamiliarCount += 1;
    if (projected.correctStreak < 3) revisitCount += 1;
  });

  return { practicedCount: words.length, becameFamiliarCount, revisitCount };
}

export function allowsCurriculumCompletion(mode: GameMode): boolean {
  return mode === 'curriculum';
}
