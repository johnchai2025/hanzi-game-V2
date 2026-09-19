import { expect, test } from '@playwright/test';
import {
  applyPracticeEvent,
  getLearningStatus,
  isDueForReview,
  normalizeWordPractice,
  reviewPriority,
  summarizeRound,
} from '@/lib/learningProgress';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 20 * DAY;

test('normalizes legacy, absent, negative, and corrupt practice fields', () => {
  expect(normalizeWordPractice({ correctCount: 5, lastPracticedAt: 123 })).toEqual({
    correctCount: 5,
    wrongCount: 0,
    hintCount: 0,
    correctStreak: 3,
    lastPracticedAt: 123,
  });
  expect(normalizeWordPractice(undefined)).toEqual({
    correctCount: 0,
    wrongCount: 0,
    hintCount: 0,
    correctStreak: 0,
    lastPracticedAt: 0,
  });
  expect(normalizeWordPractice({
    correctCount: -2.7,
    wrongCount: Number.NaN,
    hintCount: 'bad',
    correctStreak: Number.POSITIVE_INFINITY,
    lastPracticedAt: -100,
  })).toEqual({
    correctCount: 0,
    wrongCount: 0,
    hintCount: 0,
    correctStreak: 0,
    lastPracticedAt: 0,
  });
});

test('applies correct, wrong, and hint events with one update per distinct word', () => {
  const baseline = {
    洗手: normalizeWordPractice({ correctCount: 1, correctStreak: 1, lastPracticedAt: 5 }),
    高山: normalizeWordPractice({ correctCount: 4, wrongCount: 1, correctStreak: 3, lastPracticedAt: 5 }),
  };

  const correct = applyPracticeEvent(baseline, { type: 'correct', words: ['洗手'] }, NOW);
  expect(correct['洗手']).toMatchObject({ correctCount: 2, correctStreak: 2, lastPracticedAt: NOW });

  const wrong = applyPracticeEvent(correct, { type: 'wrong', words: ['洗手', '高山', '洗手'] }, NOW + 1);
  expect(wrong['洗手']).toMatchObject({ wrongCount: 1, correctStreak: 0, lastPracticedAt: NOW + 1 });
  expect(wrong['高山']).toMatchObject({ wrongCount: 2, correctStreak: 0, lastPracticedAt: NOW + 1 });

  const hinted = applyPracticeEvent(wrong, { type: 'hint', words: ['新词'] }, NOW + 2);
  expect(hinted['新词']).toEqual({
    correctCount: 0,
    wrongCount: 0,
    hintCount: 1,
    correctStreak: 0,
    lastPracticedAt: NOW + 2,
  });
  expect(baseline['洗手'].correctCount).toBe(1);
});

test('derives learning status, seven-day due boundary, and exact priority', () => {
  expect(getLearningStatus(undefined)).toBe('unseen');
  expect(getLearningStatus(normalizeWordPractice({ correctStreak: 0 }))).toBe('needs-support');
  expect(getLearningStatus(normalizeWordPractice({ correctStreak: 1 }))).toBe('needs-support');
  expect(getLearningStatus(normalizeWordPractice({ correctStreak: 2 }))).toBe('familiarizing');
  expect(getLearningStatus(normalizeWordPractice({ correctStreak: 3 }))).toBe('familiar');

  const exactlySevenDaysOld = normalizeWordPractice({ correctStreak: 3, lastPracticedAt: NOW - 7 * DAY });
  expect(isDueForReview(exactlySevenDaysOld, NOW - 1)).toBe(false);
  expect(isDueForReview(exactlySevenDaysOld, NOW)).toBe(true);
  expect(isDueForReview(undefined, NOW)).toBe(false);
  expect(reviewPriority({
    correctCount: 2,
    wrongCount: 2,
    hintCount: 1,
    correctStreak: 1,
    lastPracticedAt: NOW - 10 * DAY,
  }, NOW)).toBe(500 + 2 * 30 + 20 + 4 * 5);
});

test('summarizes distinct practiced words and learning transitions without mutation', () => {
  const baseline = {
    洗手: normalizeWordPractice({ correctStreak: 2 }),
    高山: normalizeWordPractice({ correctStreak: 1 }),
    白云: normalizeWordPractice({ correctStreak: 3 }),
  };
  const final = {
    ...baseline,
    洗手: normalizeWordPractice({ correctCount: 1, correctStreak: 3, lastPracticedAt: NOW }),
    高山: normalizeWordPractice({ wrongCount: 1, correctStreak: 0, lastPracticedAt: NOW }),
    白云: normalizeWordPractice({ correctCount: 4, correctStreak: 4, lastPracticedAt: NOW }),
  };

  expect(summarizeRound({
    baselineByWord: baseline,
    finalByWord: final,
    practicedWords: ['洗手', '高山', '洗手', '白云'],
    now: NOW,
  })).toEqual({ practicedCount: 3, becameFamiliarCount: 1, revisitCount: 1 });
});
