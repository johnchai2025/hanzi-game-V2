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
    lastPracticedAt: 123,
  });
});
