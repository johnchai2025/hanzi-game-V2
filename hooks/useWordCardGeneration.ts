'use client';

import type { WordCard, WordPair } from '@/types';
import { fetchWordImage } from '@/lib/wordImageClient';

// 词现在是全局唯一的图库主键，卡片 id 直接用 `card-${word}`——
// 天然保证"一词一卡"，不会再出现同一个词跨关卡产生多条重复记录的情况
// （历史遗留问题：以前用 levelId+word 去重写入、却用 word 去重读取，两边不一致）。
function createWordCard(word: string, chars: WordPair, levelId: string, imageUrl = ''): WordCard {
  return {
    id: `card-${word}`,
    word,
    chars,
    imageUrl,
    generatedAt: Date.now(),
    levelId,
  };
}

export function useWordCardGeneration() {
  const generateCardPreview = async (
    word: string,
    chars: WordPair,
    levelId: string,
    force = false
  ): Promise<{ card: WordCard; error?: string }> => {
    const { imageUrl, error } = await fetchWordImage(word, force);
    if (error) console.error('generateCardPreview failed:', error);
    return { card: createWordCard(word, chars, levelId, imageUrl), error };
  };

  return { generateCardPreview };
}
