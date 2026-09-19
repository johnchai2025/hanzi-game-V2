import { expect, test } from '@playwright/test';
import { pickPairsForPractice } from '@/lib/practiceSelection';
import type { WordPair, WordPractice } from '@/types';

const practice = (correctStreak: number): WordPractice => ({
  correctCount: correctStreak,
  wrongCount: 0,
  hintCount: 0,
  correctStreak,
  lastPracticedAt: 1,
});

test('selects unseen words before previously practiced words', () => {
  const pairs: WordPair[] = [['洗', '手'], ['办', '法'], ['如', '果']];
  const selected = pickPairsForPractice(pairs, 2, { 洗手: practice(1) }, { now: 2, random: () => 0.5 });
  expect(selected.map(pair => pair.join('')).sort()).toEqual(['办法', '如果']);
});

test('fills remaining slots with practiced words without duplicates', () => {
  const pairs: WordPair[] = [['洗', '手'], ['办', '法'], ['如', '果']];
  const selected = pickPairsForPractice(pairs, 3, { 洗手: practice(1), 办法: practice(1) }, { now: 2, random: () => 0.5 });
  expect(selected).toHaveLength(3);
  expect(new Set(selected.map(pair => pair.join(''))).size).toBe(3);
});

test('does not mutate the curriculum pair array', () => {
  const pairs: WordPair[] = [['洗', '手'], ['办', '法'], ['如', '果']];
  const snapshot = JSON.stringify(pairs);
  pickPairsForPractice(pairs, 2, {}, { now: 2, random: () => 0.5 });
  expect(JSON.stringify(pairs)).toBe(snapshot);
});
