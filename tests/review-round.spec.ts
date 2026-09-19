import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from '@playwright/test';
import {
  allowsCurriculumCompletion,
  applyReviewRoundEvent,
  createReviewContext,
  refreshReviewContext,
  summarizeReviewRound,
} from '@/lib/reviewRound';
import type { ReviewCandidate } from '@/lib/reviewSelection';
import type { WordPractice } from '@/types';

// Keep server rendering on React's runtime inside Playwright's TS transform.
// eslint-disable-next-line @typescript-eslint/no-require-imports
Object.assign(require('playwright/jsx-runtime'), require('react/jsx-runtime'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MissionScene } = require('@/components/MissionScene') as typeof import('@/components/MissionScene');

const NOW = Date.UTC(2026, 8, 19);
const practice = (correctStreak: number, correctCount = correctStreak): WordPractice => ({
  correctCount,
  wrongCount: 0,
  hintCount: 0,
  correctStreak,
  lastPracticedAt: NOW - 8 * 24 * 60 * 60 * 1000,
});

function candidate(sourceLevelId: string, word: string, streak = 1, sourceOrder = 0): ReviewCandidate {
  return {
    sourceLevelId,
    word,
    pair: [word[0], word[1]],
    sourceOrder,
    practice: practice(streak),
    priority: 500,
  };
}

test('review context keeps duplicate winner sources and routes every event only to them', () => {
  const chosen = [candidate('g2s1u2', '花朵', 2), candidate('custom-1', '月亮', 1)];
  const context = createReviewContext(chosen, {
    g2s1u1: { 花朵: practice(0) },
    g2s1u2: { 花朵: practice(2) },
    'custom-1': { 月亮: practice(1) },
  });

  const correct = applyReviewRoundEvent(context, context.baselineBySourceKey, {
    type: 'correct', words: ['花朵'], at: NOW,
  });
  expect(correct.routedEvents).toEqual([{ levelId: 'g2s1u2', words: ['花朵'], type: 'correct', at: NOW }]);
  expect(correct.projectionBySourceKey['g2s1u2\u0000花朵'].correctStreak).toBe(3);
  expect(correct.projectionBySourceKey['g2s1u1\u0000花朵']).toBeUndefined();

  const wrong = applyReviewRoundEvent(context, correct.projectionBySourceKey, {
    type: 'wrong', words: ['花朵', '月亮', '花朵'], at: NOW + 1,
  });
  expect(wrong.routedEvents).toEqual([
    { levelId: 'g2s1u2', words: ['花朵'], type: 'wrong', at: NOW + 1 },
    { levelId: 'custom-1', words: ['月亮'], type: 'wrong', at: NOW + 1 },
  ]);
  expect(wrong.projectionBySourceKey['g2s1u2\u0000花朵'].wrongCount).toBe(1);
  expect(wrong.projectionBySourceKey['custom-1\u0000月亮'].wrongCount).toBe(1);

  const hint = applyReviewRoundEvent(context, wrong.projectionBySourceKey, {
    type: 'hint', words: ['月亮'], at: NOW + 2,
  });
  expect(hint.routedEvents).toEqual([
    { levelId: 'custom-1', words: ['月亮'], type: 'hint', at: NOW + 2 },
  ]);
  expect(hint.projectionBySourceKey['custom-1\u0000月亮'].hintCount).toBe(1);
});

test('review context supports exact two and six pair missions', () => {
  for (const count of [2, 6]) {
    const candidates = Array.from({ length: count }, (_, index) =>
      candidate(`level-${index}`, `${index}甲`, 1, index));
    const context = createReviewContext(candidates, Object.fromEntries(candidates.map(item => [
      item.sourceLevelId, { [item.word]: item.practice },
    ])));
    expect(context.level.pairs).toHaveLength(count);
    const html = renderToStaticMarkup(createElement(MissionScene, {
      levelId: context.level.id,
      levelTitle: context.level.title,
      restoredCount: count,
      totalCount: context.level.pairs.length,
      character: { animal: '小狐狸', emoji: '🦊', name: '团团' },
    }));
    expect(html).toContain(`${count} / ${count}`);
  }
});

test('restart refreshes baseline and deadlock reuse keeps authoritative source metadata', () => {
  const chosen = [candidate('g2s1u1', '苹果', 1), candidate('g2s1u2', '月亮', 2)];
  const context = createReviewContext(chosen, {
    g2s1u1: { 苹果: practice(1) },
    g2s1u2: { 月亮: practice(2) },
  });
  const refreshed = refreshReviewContext(context, {
    g2s1u1: { 苹果: practice(2) },
    g2s1u2: { 月亮: practice(0) },
  });
  expect(refreshed.baselineBySourceKey['g2s1u1\u0000苹果'].correctStreak).toBe(2);

  // A deadlock replacement may reuse an already-eliminated visible word. Its
  // source remains the selected winner and summary counts distinct final words.
  const after = applyReviewRoundEvent(refreshed, refreshed.baselineBySourceKey, {
    type: 'correct', words: ['苹果'], at: NOW,
  });
  expect(after.routedEvents[0].levelId).toBe('g2s1u1');
  expect(summarizeReviewRound(refreshed, after.projectionBySourceKey, [
    ['苹', '果'], ['苹', '果'], ['月', '亮'],
  ])).toEqual({ practicedCount: 2, becameFamiliarCount: 1, revisitCount: 1 });
});

test('final correct event is included in the frozen summary and review cannot complete curriculum', () => {
  const context = createReviewContext([
    candidate('g2s1u1', '花朵', 2), candidate('g2s1u2', '月亮', 1),
  ], {
    g2s1u1: { 花朵: practice(2) },
    g2s1u2: { 月亮: practice(1) },
  });
  const result = applyReviewRoundEvent(context, context.baselineBySourceKey, {
    type: 'correct', words: ['花朵'], at: NOW,
  });
  expect(summarizeReviewRound(context, result.projectionBySourceKey, context.level.pairs))
    .toEqual({ practicedCount: 2, becameFamiliarCount: 1, revisitCount: 1 });
  expect(allowsCurriculumCompletion('curriculum')).toBe(true);
  expect(allowsCurriculumCompletion('custom')).toBe(false);
  expect(allowsCurriculumCompletion('review')).toBe(false);
});
