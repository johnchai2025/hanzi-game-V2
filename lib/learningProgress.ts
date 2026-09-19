import type { WordPractice } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type LearningStatus = 'unseen' | 'needs-support' | 'familiarizing' | 'familiar';
export type PracticeEventType = 'correct' | 'wrong' | 'hint';

export interface PracticeEvent {
  type: PracticeEventType;
  words: readonly string[];
}

export interface RoundSummaryInput {
  baselineByWord: Readonly<Record<string, WordPractice | undefined>>;
  finalByWord: Readonly<Record<string, WordPractice | undefined>>;
  practicedWords: readonly string[];
}

export interface RoundSummary {
  practicedCount: number;
  becameFamiliarCount: number;
  revisitCount: number;
}

function safeCounter(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)))
    : 0;
}

function saturatingAdd(left: number, right: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, left + right);
}

function saturatingMultiply(left: number, right: number): number {
  if (left === 0 || right === 0) return 0;
  return left > Number.MAX_SAFE_INTEGER / right
    ? Number.MAX_SAFE_INTEGER
    : left * right;
}

export function normalizeWordPractice(value: unknown): WordPractice {
  const source = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  const correctCount = safeCounter(source.correctCount);
  const hasStoredStreak = Object.prototype.hasOwnProperty.call(source, 'correctStreak');

  return {
    correctCount,
    wrongCount: safeCounter(source.wrongCount),
    hintCount: safeCounter(source.hintCount),
    correctStreak: hasStoredStreak
      ? safeCounter(source.correctStreak)
      : Math.min(correctCount, 3),
    lastPracticedAt: safeCounter(source.lastPracticedAt),
  };
}

export function applyPracticeEvent(
  practiceByWord: Readonly<Record<string, WordPractice | undefined>>,
  event: PracticeEvent,
  now: number,
): Record<string, WordPractice> {
  const result: Record<string, WordPractice> = {};
  Object.entries(practiceByWord).forEach(([word, practice]) => {
    result[word] = normalizeWordPractice(practice);
  });

  const timestamp = safeCounter(now);
  new Set(event.words.filter(Boolean)).forEach(word => {
    const previous = normalizeWordPractice(result[word]);
    if (event.type === 'correct') {
      result[word] = {
        ...previous,
        correctCount: saturatingAdd(previous.correctCount, 1),
        correctStreak: saturatingAdd(previous.correctStreak, 1),
        lastPracticedAt: timestamp,
      };
      return;
    }

    result[word] = {
      ...previous,
      wrongCount: saturatingAdd(previous.wrongCount, event.type === 'wrong' ? 1 : 0),
      hintCount: saturatingAdd(previous.hintCount, event.type === 'hint' ? 1 : 0),
      correctStreak: 0,
      lastPracticedAt: timestamp,
    };
  });

  return result;
}

export function getLearningStatus(practice: WordPractice | undefined): LearningStatus {
  if (!practice) return 'unseen';
  const streak = normalizeWordPractice(practice).correctStreak;
  if (streak < 2) return 'needs-support';
  if (streak === 2) return 'familiarizing';
  return 'familiar';
}

function wholeDaysSince(lastPracticedAt: number, now: number): number {
  return Math.max(0, Math.floor((safeCounter(now) - lastPracticedAt) / DAY_MS));
}

export function isDueForReview(practice: WordPractice | undefined, now: number): boolean {
  if (!practice) return false;
  const normalized = normalizeWordPractice(practice);
  const encountered = normalized.lastPracticedAt > 0
    || normalized.correctCount > 0
    || normalized.wrongCount > 0
    || normalized.hintCount > 0;
  return encountered && wholeDaysSince(normalized.lastPracticedAt, now) >= 7;
}

export function reviewPriority(practice: WordPractice | undefined, now: number): number {
  if (!practice) return 600;
  const normalized = normalizeWordPractice(practice);
  const streakNeed = normalized.correctStreak === 0 ? 600
    : normalized.correctStreak === 1 ? 500
      : normalized.correctStreak === 2 ? 300
        : 100;
  const overdueDays = Math.min(30, Math.max(0,
    wholeDaysSince(normalized.lastPracticedAt, now) - 6,
  ));
  return [
    streakNeed,
    saturatingMultiply(normalized.wrongCount, 30),
    saturatingMultiply(normalized.hintCount, 20),
    overdueDays * 5,
  ].reduce(saturatingAdd, 0);
}

export function summarizeRound(input: RoundSummaryInput): RoundSummary {
  const words = [...new Set(input.practicedWords.filter(Boolean))];
  let becameFamiliarCount = 0;
  let revisitCount = 0;

  words.forEach(word => {
    const baselineStreak = input.baselineByWord[word]
      ? normalizeWordPractice(input.baselineByWord[word]).correctStreak
      : 0;
    const finalStreak = input.finalByWord[word]
      ? normalizeWordPractice(input.finalByWord[word]).correctStreak
      : 0;
    if (baselineStreak < 3 && finalStreak >= 3) becameFamiliarCount += 1;
    if (finalStreak < 3) revisitCount += 1;
  });

  return { practicedCount: words.length, becameFamiliarCount, revisitCount };
}
