import type { WordPair } from '@/types';

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 优先抽取当前关卡尚未练习的词，再用已练习词补足本局。 */
export function pickPairsForPractice(
  allPairs: WordPair[],
  maxPairs: number,
  practicedWords: ReadonlySet<string>
): WordPair[] {
  const unseen = allPairs.filter(pair => !practicedWords.has(pair.join('')));
  const practiced = allPairs.filter(pair => practicedWords.has(pair.join('')));
  return [...shuffle(unseen), ...shuffle(practiced)].slice(0, maxPairs);
}
