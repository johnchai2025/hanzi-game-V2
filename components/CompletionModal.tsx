'use client'

import type { AnimalCharacter } from '@/types';
import { MascotImg } from './MascotImg';

interface Props {
  onNextLevel: (() => void) | null;
  onRestart: () => void;
  onSelectLevel: () => void;
  onWordBook?: () => void;
  newCardCount?: number;
  character?: AnimalCharacter;
  stars: number;
}

export function CompletionModal({ onNextLevel, onRestart, onSelectLevel, onWordBook, newCardCount = 0, character, stars }: Props) {
  return (
    <div className="modal-overlay">
      <div className="confetti-wrap" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className="confetti-dot" style={{ '--ci': i } as React.CSSProperties} />
        ))}
      </div>
      <div className="cmp-modal">
        <div className="cmp-burst">
          <MascotImg animal={character?.animal} pose="cheer" emoji="🐰" />
        </div>
        <div className="cmp-stars" aria-label={`获得${stars}颗星`}>{'⭐'.repeat(stars)}</div>
        <div className="cmp-title">太棒了！</div>
        <div className="cmp-sub">全部消除，过关！</div>
        {newCardCount > 0 && (
          <div className="cmp-reward">🎴 本关收集了 {newCardCount} 张词卡！</div>
        )}
        <div className="cmp-actions">
          {onNextLevel && (
            <button className="btn btn-primary btn-big btn-block" onClick={onNextLevel}>下一关 →</button>
          )}
          {onWordBook && (
            <button className="btn btn-primary btn-block" onClick={onWordBook}>去词卡库看看</button>
          )}
          <button className="btn btn-restart btn-block" onClick={onRestart}>再玩一次</button>
          <button className="btn btn-ghost btn-block" onClick={onSelectLevel}>返回地图</button>
        </div>
      </div>
    </div>
  );
}
