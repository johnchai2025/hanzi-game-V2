import { expect, test } from '@playwright/test';
import { calculateStars } from '@/lib/gameProgress';
import { normalizeSaveData } from '@/hooks/useSaveData';

test('awards stars for every attempt boundary', () => {
  expect(calculateStars({ mistakeCount: 4, hintCount: 1 })).toBe(1);
  expect(calculateStars({ mistakeCount: 3, hintCount: 0 })).toBe(1);
  expect(calculateStars({ mistakeCount: 2, hintCount: 1 })).toBe(2);
  expect(calculateStars({ mistakeCount: 0, hintCount: 1 })).toBe(2);
  expect(calculateStars({ mistakeCount: 0, hintCount: 0 })).toBe(3);
});

test('normalizes legacy saves and migrates known card ownership', () => {
  const normalized = normalizeSaveData({
    unlockedLevels: ['g2s1u1'],
    completedLevels: [],
    stories: [],
    wordCards: [{
      id: 'card-洗手',
      word: '洗手',
      chars: ['洗', '手'],
      imageUrl: '',
      generatedAt: 123,
      levelId: 'g2s1u1',
    }],
  });

  expect(normalized.levelStars).toEqual({});
  expect(normalized.practiceByLevel.g2s1u1['洗手']).toEqual({
    correctCount: 1,
    wrongCount: 0,
    hintCount: 0,
    correctStreak: 1,
    lastPracticedAt: 123,
  });
});

test('normalizes every stored practice record while preserving unrelated save fields', () => {
  const cards = [{
    id: 'card-白云', word: '白云', chars: ['白', '云'] as [string, string],
    imageUrl: '/word.png', generatedAt: 99,
  }];
  const stories = [{
    id: 'story-1', words: ['白云'], content: '故事', generatedAt: 88,
    characterName: '小白', animal: '小狐狸', scene: '天空',
  }];
  const normalized = normalizeSaveData({
    unlockedLevels: ['g2s1u1', 'g2s1u2'],
    completedLevels: ['g2s1u1'],
    wordCards: cards,
    stories,
    levelStars: { g2s1u1: 3 },
    practiceByLevel: {
      g2s1u1: {
        白云: { correctCount: 4, lastPracticedAt: 77 } as never,
        高山: { correctCount: -4, wrongCount: 2.9, hintCount: Number.NaN, correctStreak: -1, lastPracticedAt: -2 },
      },
    },
  });

  expect(normalized.unlockedLevels).toEqual(['g2s1u1', 'g2s1u2']);
  expect(normalized.completedLevels).toEqual(['g2s1u1']);
  expect(normalized.wordCards).toEqual(cards);
  expect(normalized.stories).toEqual(stories);
  expect(normalized.levelStars).toEqual({ g2s1u1: 3 });
  expect(normalized.practiceByLevel.g2s1u1['白云']).toMatchObject({ correctCount: 4, correctStreak: 3 });
  expect(normalized.practiceByLevel.g2s1u1['高山']).toEqual({
    correctCount: 0, wrongCount: 2, hintCount: 0, correctStreak: 0, lastPracticedAt: 0,
  });
});
