'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { LevelData, CustomLevel, WordPair, WordCard } from '../types';
import { useGame, pickPairsForGame } from '../hooks/useGame';
import { useTTS } from '../hooks/useTTS';
import { useWordCardGeneration } from '../hooks/useWordCardGeneration';
import { GameBoard } from './GameBoard';
import { FeedbackToast } from './FeedbackToast';
import { MilestoneToast } from './MilestoneToast';
import { CompletionModal } from './CompletionModal';
import { DeadlockModal } from './DeadlockModal';
import { NewCardToast } from './NewCardToast';
import { RewardCardModal } from './RewardCardModal';
import { MascotImg } from './MascotImg';

interface RewardCardState {
  status: 'generating' | 'ready';
  card: WordCard;
  error?: string;
}

interface Props {
  level: LevelData;
  nextLevel: LevelData | null;
  onSelectLevel: () => void;
  onNextLevel: (level: LevelData) => void;
  onComplete: (levelId: string, nextId: string | null) => void;
  customLevel?: CustomLevel;
  onIncrementPlayCount?: (id: string) => void;
  onSaveCustom: (level: CustomLevel) => void;
  onPlayCustom: (level: CustomLevel) => void;
  onWordBook: () => void;
  // 新增：词卡生成相关
  onAddWordCard?: (card: WordCard) => void;
  savedWordCards?: WordCard[];
  getCharacter?: () => import('../types').AnimalCharacter;
}

export function GameScreen({
  level,
  nextLevel,
  onSelectLevel,
  onNextLevel,
  onComplete,
  customLevel,
  onIncrementPlayCount,
  onSaveCustom,
  onPlayCustom,
  onWordBook,
  onAddWordCard,
  savedWordCards = [],
  getCharacter,
}: Props) {
  // 词对数量仍按原来的方式从关卡棋盘尺寸推导（不改 curriculum/自定义关卡数据）
  const rows = customLevel ? 4 : level.boardRows ?? 4;
  const cols = customLevel ? 4 : level.boardCols ?? 4;
  const pairCount = Math.floor((rows * cols) / 2);

  // 双栏布局：左栏放每个词对的第一个字，右栏放第二个字，固定两列、
  // 行数等于本局词对数（跟原来的 rows*cols 网格尺寸解耦，只用于渲染整形）
  const boardRows = pairCount;
  const boardCols = 2;

  // 用 useState 懒初始化而不是 useMemo：保证本局抽中的词对在整局游戏期间
  // 绝对不会重新抽样（useMemo 只要依赖项引用变化就可能重算，一旦重算就会
  // 抽出不同的随机词对，但棋盘还是旧的，会导致"明明是词却消不掉"）
  const [activePairs] = useState<WordPair[]>(() =>
    customLevel ? pickPairsForGame(customLevel.pairs, pairCount) : pickPairsForGame(level.pairs, pairCount)
  );

  const completedRef = useRef(false);
  const [showNewCardToast, setShowNewCardToast] = useState(false);
  const [savedCardCount, setSavedCardCount] = useState(0);
  const [rewardCard, setRewardCard] = useState<RewardCardState | null>(null);
  const [flippedCells, setFlippedCells] = useState<Set<string>>(new Set());
  const { speak } = useTTS();

  const { generateCardPreview } = useWordCardGeneration();

  // 生成/换图成功后自动保存到词卡库，不需要用户手动点保存。
  // 去重键统一用 word（不再是 levelId+word）——图库本身就是"一词一图"，
  // 卡片库跟着按同一个键走才不会出现同一个词存两条记录、IndexedDB 里存两份图的情况。
  const persistCard = useCallback((card: WordCard) => {
    if (!card.imageUrl) return;
    const isNewWord = !savedWordCards.some(c => c.word === card.word);
    onAddWordCard?.(card);
    if (isNewWord) {
      setSavedCardCount(prev => prev + 1);
      setShowNewCardToast(true);
      setTimeout(() => setShowNewCardToast(false), 3000);
    }
  }, [savedWordCards, onAddWordCard]);

  const handlePairEliminated = useCallback(({ word, chars }: { word: string; chars: WordPair }) => {
    speak(word);

    // 该词语已经生成过图片（无论是在哪一关获得的），直接复用，不用再跑一次网络请求
    const existing = savedWordCards.find(c => c.word === word && c.imageUrl);
    if (existing) {
      setRewardCard({ status: 'ready', card: existing });
      return;
    }

    const placeholderCard: WordCard = {
      id: `card-${word}`,
      word,
      chars,
      imageUrl: '',
      generatedAt: Date.now(),
      levelId: level.id,
    };

    setRewardCard({ status: 'generating', card: placeholderCard });
    generateCardPreview(word, chars, level.id).then(({ card, error }) => {
      setRewardCard(current => {
        if (!current || current.card.word !== word) return current;
        return { status: 'ready', card, error };
      });
      if (card.imageUrl) persistCard(card);
    });
  }, [savedWordCards, generateCardPreview, level.id, speak, persistCard]);

  const gameOptions = useMemo(() => ({
    rows: boardRows,
    cols: boardCols,
    onPairEliminated: handlePairEliminated,
  }), [boardCols, boardRows, handlePairEliminated]);

  const { cells, eliminatedCount, isComplete, feedback, milestone, isDeadlock, handleCellClick, showHint, restart, reshuffle } =
    useGame(level, activePairs, gameOptions);

  // 监听关卡完成
  useEffect(() => {
    if (isComplete && !completedRef.current) {
      completedRef.current = true;
      if (!customLevel) {
        onComplete(level.id, nextLevel?.id ?? null);
      } else if (onIncrementPlayCount) {
        onIncrementPlayCount(customLevel.id);
      }

    }
  }, [isComplete, level, nextLevel, customLevel, onComplete, onIncrementPlayCount]);

  const handleFlipCell = useCallback((cellId: string) => {
    setFlippedCells(prev => {
      const next = new Set(prev);
      if (next.has(cellId)) next.delete(cellId);
      else next.add(cellId);
      return next;
    });
  }, []);

  const handleRestart = () => {
    completedRef.current = false;
    setSavedCardCount(0);
    setRewardCard(null);
    setFlippedCells(new Set());
    const newPairs = customLevel ? pickPairsForGame(customLevel.pairs, pairCount) : pickPairsForGame(level.pairs, pairCount);
    restart(newPairs);
  };

  const handleReshuffle = () => {
    reshuffle();
  };

  const handleCloseRewardCard = () => {
    setRewardCard(null);
  };

  // 不满意就换一张：不管这次是"生成失败重试"还是"生成成功但想换一张"，
  // 都走 force=true 跳过图库缓存、强制重新生成并覆盖。
  const handleRetryRewardCard = () => {
    if (!rewardCard) return;
    const { word, chars, levelId } = rewardCard.card;
    setRewardCard({ status: 'generating', card: rewardCard.card });
    generateCardPreview(word, chars, levelId, true).then(({ card, error }) => {
      setRewardCard(current => {
        if (!current || current.card.word !== word) return current;
        return { status: 'ready', card, error };
      });
      if (card.imageUrl) persistCard(card);
    });
  };

  const character = getCharacter?.() ?? { animal: '小狐狸', emoji: '🦊', name: '小狐狸' };
  const progress = activePairs.length > 0 ? Math.round((eliminatedCount / activePairs.length) * 100) : 0;
  const title = customLevel ? customLevel.title : level.title;
  const mascotMsg = (() => {
    if (progress >= 100) return '全部消完啦！🎉';
    if (eliminatedCount === 0) return '找找相同的词语，配对消除吧！';
    if (eliminatedCount >= 4) return `超厉害！${character.name}为你跳舞啦～`;
    if (eliminatedCount >= 2) return '连消达人！继续冲！';
    return '太棒了！继续加油！';
  })();

  return (
    <div className="gb">
      <div className="gb-board-wrap">
        <button className="gb-back" onClick={onSelectLevel}>← 选关</button>
        <div className="gb-board">
          <GameBoard cells={cells} onCellClick={handleCellClick} flippedCells={flippedCells} onFlipCell={handleFlipCell} />
        </div>
      </div>

      <div className="gb-side">
        <div className="gb-side-head">
          <div className="gb-lvl">{customLevel ? '✨ ' : `第${level.level}关 · `}{title}</div>
          <div className="gb-lvl-sub">点相同的词语消消看～</div>
        </div>

        {eliminatedCount >= 2 && (
          <div className="gb-combo">连消 ×{eliminatedCount} 🔥</div>
        )}

        <div className="gb-mascot-card">
          <MascotImg animal={character.animal} emoji={character.emoji} className="mascot-img-sm" />
          <div className="speech">{mascotMsg}</div>
        </div>

        <div className="gb-prog">
          <div className="gb-prog-row">
            <span>闯关进度</span>
            <span>{eliminatedCount} / {activePairs.length}</span>
          </div>
          <div className="gb-prog-track">
            <div className="gb-prog-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="gb-ctrls">
          <button className="btn btn-hint btn-big btn-block" onClick={showHint}>💡 找一对给我看</button>
          <button className="btn btn-restart btn-big btn-block" onClick={handleRestart}>🔄 重新摆放</button>
        </div>
      </div>

      <MilestoneToast message={milestone} />
      <FeedbackToast message={feedback} />
      <NewCardToast count={savedCardCount} show={showNewCardToast} />

      {isComplete && (
        <CompletionModal
          onNextLevel={nextLevel && !customLevel ? () => onNextLevel(nextLevel) : null}
          onRestart={handleRestart}
          onSelectLevel={onSelectLevel}
          onWordBook={onWordBook}
          newCardCount={savedCardCount}
          character={character}
        />
      )}
      {rewardCard && (
        <RewardCardModal
          card={rewardCard.card}
          status={rewardCard.status}
          error={rewardCard.error}
          onClose={handleCloseRewardCard}
          onRetry={handleRetryRewardCard}
        />
      )}
      {isDeadlock && (
        <DeadlockModal
          onReshuffle={handleReshuffle}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
