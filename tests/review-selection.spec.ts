import { expect, test } from '@playwright/test';
import {
  buildReviewCandidates,
  selectDailyReview,
  selectPracticePairs,
} from '@/lib/reviewSelection';
import { reviewPriority } from '@/lib/learningProgress';
import type { WordPair, WordPractice } from '@/types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 20 * DAY;

function practiced(overrides: Partial<WordPractice> = {}): WordPractice {
  return {
    correctCount: 1,
    wrongCount: 0,
    hintCount: 0,
    correctStreak: 1,
    lastPracticedAt: NOW - DAY,
    ...overrides,
  };
}

const pair = (word: string): WordPair => [word[0], word[1]];
const words = (pairs: readonly WordPair[]) => pairs.map(item => item.join(''));

test('six-pair normal round uses 3 unseen, 2 highest-priority weak/due, and oldest maintenance', () => {
  const all = ['天地', '人口', '日月', '风雨', '山川', '花草', '鸟兽', '江河'].map(pair);
  const practice = {
    风雨: practiced({ wrongCount: 3 }),
    山川: practiced({ hintCount: 1 }),
    花草: practiced({ correctStreak: 2 }),
    鸟兽: practiced({ correctStreak: 3, lastPracticedAt: NOW - DAY }),
    江河: practiced({ correctStreak: 4, lastPracticedAt: NOW - 2 * DAY }),
  };

  expect(words(selectPracticePairs(all, 6, practice, { now: NOW, random: () => 0.5 })))
    .toEqual(['天地', '人口', '日月', '风雨', '山川', '江河']);
});

test('eight-pair custom round uses exactly 4 unseen, 2 weak/due, and 2 maintenance', () => {
  const all = ['甲乙', '丙丁', '戊己', '庚辛', '壬癸', '春夏', '秋冬', '东西', '南北'].map(pair);
  const practice = {
    壬癸: practiced({ wrongCount: 4 }),
    春夏: practiced({ hintCount: 2 }),
    秋冬: practiced({ correctStreak: 2 }),
    东西: practiced({ correctStreak: 3, lastPracticedAt: NOW - DAY }),
    南北: practiced({ correctStreak: 3, lastPracticedAt: NOW - 2 * DAY }),
  };

  expect(words(selectPracticePairs(all, 8, practice, { now: NOW, random: () => 0.5 })))
    .toEqual(['甲乙', '丙丁', '戊己', '庚辛', '壬癸', '春夏', '南北', '东西']);
});

test('short category quotas refill from unseen, then weak/due, then maintenance', () => {
  const all = ['甲乙', '丙丁', '戊己', '庚辛', '壬癸', '春夏', '秋冬', '东西', '南北'].map(pair);
  const practice = Object.fromEntries(all.slice(1).map((item, index) => [
    item.join(''),
    index < 3
      ? practiced({ wrongCount: 3 - index })
      : practiced({ correctStreak: 3, lastPracticedAt: NOW - (index - 2) * DAY }),
  ]));

  expect(words(selectPracticePairs(all, 8, practice, { now: NOW, random: () => 0.5 })))
    .toEqual(['甲乙', '丙丁', '戊己', '南北', '东西', '庚辛', '秋冬', '春夏']);
});

test('seven whole days adds five points and stable source order precedes random', () => {
  const all = ['风雨', '山川', '花草'].map(pair);
  const practice = {
    风雨: practiced({ correctStreak: 3, lastPracticedAt: NOW - 7 * DAY }),
    山川: practiced({ correctStreak: 3, lastPracticedAt: NOW - 6 * DAY }),
    花草: practiced({ correctStreak: 3, lastPracticedAt: NOW - 6 * DAY }),
  };
  const randomValues = [0.9, 0.8, 0.1];
  const selected = selectPracticePairs(all, 3, practice, {
    now: NOW,
    random: () => randomValues.shift() ?? 0.5,
  });

  expect(reviewPriority(practice.风雨, NOW)).toBe(105);
  expect(reviewPriority(practice.山川, NOW)).toBe(100);
  expect(words(selected)).toEqual(['风雨', '山川', '花草']);
});

test('injected random breaks ties only when priority, age, and source order all tie', () => {
  const all = ['山川', '花草'].map(pair);
  const practice = {
    山川: practiced({ correctStreak: 3, lastPracticedAt: NOW - 6 * DAY }),
    花草: practiced({ correctStreak: 3, lastPracticedAt: NOW - 6 * DAY }),
  };
  const randomValues = [0.9, 0.1];

  expect(words(selectPracticePairs(all, 2, practice, {
    now: NOW,
    sourceOrder: () => 0,
    random: () => randomValues.shift() ?? 0.5,
  }))).toEqual(['花草', '山川']);
});

test('daily candidates filter invalid sources and recent familiar words', () => {
  const candidates = buildReviewCandidates({
    builtInLevels: [
      { id: 'u1', unlocked: true, pairs: [pair('天地'), pair('人口')], practiceByWord: {
        天地: practiced({ correctStreak: 0 }),
        人口: practiced({ correctStreak: 3, lastPracticedAt: NOW - DAY }),
      } },
      { id: 'locked', unlocked: false, pairs: [pair('日月')], practiceByWord: { 日月: practiced() } },
    ],
    customLevels: [
      { id: 'custom-live', createdAt: 2, pairs: [pair('风雨')], practiceByWord: {
        风雨: practiced(),
        山川: practiced(),
      } },
    ],
    now: NOW,
  });

  expect(candidates.map(item => `${item.sourceLevelId}:${item.word}`))
    .toEqual(['u1:天地', 'custom-live:风雨']);
});

test('daily selection keeps 2–6 exact candidates and reports fewer than two unavailable', () => {
  const make = (count: number) => Array.from({ length: count }, (_, index) => ({
    id: `u${index}`,
    unlocked: true,
    pairs: [pair(`${index}甲`)],
    practiceByWord: { [`${index}甲`]: practiced({ wrongCount: index }) },
  }));

  expect(selectDailyReview(buildReviewCandidates({ builtInLevels: make(1), customLevels: [], now: NOW })))
    .toEqual({ available: false, candidates: [] });
  expect(selectDailyReview(buildReviewCandidates({ builtInLevels: make(5), customLevels: [], now: NOW })).candidates)
    .toHaveLength(5);
  expect(selectDailyReview(buildReviewCandidates({ builtInLevels: make(8), customLevels: [], now: NOW })).candidates)
    .toHaveLength(6);

  const reversed = buildReviewCandidates({ builtInLevels: make(5), customLevels: [], now: NOW }).reverse();
  expect(selectDailyReview(reversed).candidates[0].word).toBe('4甲');
});

test('visible duplicates keep priority winner, then built-in/custom/source tie order and metadata', () => {
  const candidates = buildReviewCandidates({
    builtInLevels: [
      { id: 'b-later', unlocked: true, pairs: [pair('天地'), pair('人口')], practiceByWord: {
        天地: practiced(), 人口: practiced(),
      } },
      { id: 'b-first', unlocked: true, pairs: [pair('天地')], practiceByWord: { 天地: practiced() } },
    ],
    customLevels: [
      { id: 'z-custom', createdAt: 1, pairs: [pair('天地'), pair('人口')], practiceByWord: {
        天地: practiced({ wrongCount: 5 }), 人口: practiced(),
      } },
      { id: 'a-custom', createdAt: 1, pairs: [pair('山川')], practiceByWord: { 山川: practiced() } },
      { id: 'b-custom', createdAt: 1, pairs: [pair('山川')], practiceByWord: { 山川: practiced() } },
    ],
    now: NOW,
  });

  expect(candidates.find(item => item.word === '天地')).toMatchObject({
    sourceLevelId: 'z-custom', word: '天地', pair: ['天', '地'],
  });
  expect(candidates.find(item => item.word === '人口')?.sourceLevelId).toBe('b-later');
  expect(candidates.find(item => item.word === '山川')?.sourceLevelId).toBe('a-custom');
});
