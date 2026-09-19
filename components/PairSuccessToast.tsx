'use client';

import type { WordPair } from '@/types';

interface Props {
  payload: { word: string; chars: WordPair } | null;
}

export function PairSuccessToast({ payload }: Props) {
  if (!payload) return null;

  return (
    <div className="pair-success-toast" role="status" aria-live="polite">
      <span>{payload.chars[0]}</span>
      <span className="pair-success-op">＋</span>
      <span>{payload.chars[1]}</span>
      <span className="pair-success-op">＝</span>
      <strong>{payload.word}</strong>
    </div>
  );
}
