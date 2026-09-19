import type { WordPair, WordPractice } from '@/types';
import { selectPracticePairs, type SelectionOptions } from '@/lib/reviewSelection';

/** Compatibility entry point; the selection algorithm lives in reviewSelection. */
export function pickPairsForPractice(
  allPairs: readonly WordPair[],
  maxPairs: number,
  practiceByWord: Readonly<Record<string, WordPractice | undefined>>,
  options?: SelectionOptions,
): WordPair[] {
  return selectPracticePairs(allPairs, maxPairs, practiceByWord, options);
}
