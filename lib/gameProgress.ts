import type { AttemptSummary } from '@/types';

/**
 * 完成即得 1 星；错误不超过 2 次得第 2 星；零错误且未用提示得第 3 星。
 */
export function calculateStars({ mistakeCount, hintCount }: AttemptSummary): 1 | 2 | 3 {
  if (mistakeCount === 0 && hintCount === 0) return 3;
  if (mistakeCount <= 2) return 2;
  return 1;
}
