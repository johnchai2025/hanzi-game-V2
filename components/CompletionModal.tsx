'use client'

import type { AnimalCharacter, LearningSummary } from '@/types';
import { MascotImg } from './MascotImg';

interface Props {
  onNextLevel: (() => void) | null;
  onRestart: () => void;
  onSelectLevel: () => void;
  onWordBook?: () => void;
  newCardCount?: number;
  character?: AnimalCharacter;
  stars: number;
  learningSummary?: LearningSummary;
}

export function CompletionModal({ onNextLevel, onRestart, onSelectLevel, onWordBook, newCardCount = 0, character, stars, learningSummary }: Props) {
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
        {learningSummary && (
          <div className="cmp-learning-summary" aria-label="本轮学习小结">
            <div><span>本轮练习</span>{' '}<b>{learningSummary.practicedCount} 个词</b></div>
            {learningSummary.becameFamiliarCount > 0 && (
              <div><span>更熟悉</span>{' '}<b>{learningSummary.becameFamiliarCount} 个</b></div>
            )}
            {learningSummary.revisitCount > 0 && (
              <div><span>下次再见</span>{' '}<b>{learningSummary.revisitCount} 个</b></div>
            )}
          </div>
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
