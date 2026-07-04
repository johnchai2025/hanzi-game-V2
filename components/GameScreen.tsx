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
  getRandomScene?: () => string;
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
  getRandomScene,
}: Props) {
  const rows = customLevel ? 4 : level.boardRows ?? 4;
  const cols = customLevel ? 4 : level.boardCols ?? 4;
  const pairCount = Math.floor((rows * cols) / 2);

  const activePairs = useMemo<WordPair[]>(() => {
    if (customLevel) return pickPairsForGame(customLevel.pairs, pairCount);
    return pickPairsForGame(level.pairs, pairCount);
  }, [level, customLevel, pairCount]);

  const completedRef = useRef(false);
  const [showNewCardToast, setShowNewCardToast] = useState(false);
  const [savedCardCount, setSavedCardCount] = useState(0);
  const [rewardCard, setRewardCard] = useState<RewardCardState | null>(null);
  const [flippedCells, setFlippedCells] = useState<Set<string>>(new Set());
  const { speak } = useTTS();
  const handleGeneratedCard = useCallback(() => {}, []);

  const {
    generateCardPreview,
    resetNewCardCount,
  } = useWordCardGeneration(
    handleGeneratedCard,
    getCharacter ?? (() => ({ animal: '小兔子', emoji: '🐰', name: '小兔' })),
    getRandomScene ?? (() => '森林')
  );

  const handlePairEliminated = useCallback(({ word, chars }: { word: string; chars: WordPair }) => {
    speak(word);

    // 该词语已经生成过图片（无论是在哪一关获得的），直接复用，不再调用生图 API
    const cached = savedWordCards.find(c => c.word === word && c.imageUrl);
    if (cached) {
      const card: WordCard = {
        ...cached,
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        levelId: level.id,
        generatedAt: Date.now(),
      };
      setRewardCard({ status: 'ready', card });
      return;
    }

    const character = getCharacter?.() ?? { animal: '小兔子', emoji: '🐰', name: '小兔' };
    const scene = getRandomScene?.() ?? '森林';
    const placeholderCard: WordCard = {
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      word,
      chars,
      imageUrl: '',
      generatedAt: Date.now(),
      levelId: level.id,
      animal: character.animal,
      characterName: character.name,
      scene,
    };

    setRewardCard({ status: 'generating', card: placeholderCard });
    generateCardPreview(word, chars, level.id, character.animal, character.name, scene).then(({ card, error }) => {
      setRewardCard(current => {
        if (!current || current.card.word !== word || current.card.levelId !== level.id) return current;
        return { status: 'ready', card, error };
      });
    });
  }, [savedWordCards, generateCardPreview, getCharacter, getRandomScene, level.id, speak]);

  const gameOptions = useMemo(() => ({
    rows,
    cols,
    onPairEliminated: handlePairEliminated,
  }), [cols, handlePairEliminated, rows]);

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
    resetNewCardCount();
    const newPairs = customLevel ? pickPairsForGame(customLevel.pairs, pairCount) : pickPairsForGame(level.pairs, pairCount);
    restart(newPairs);
  };

  const handleReshuffle = () => {
    reshuffle();
  };

  const handleSaveRewardCard = () => {
    if (!rewardCard) return;
    const existingCard = savedWordCards.find(
      card => card.levelId === rewardCard.card.levelId && card.word === rewardCard.card.word
    );
    const willChangeLibrary = !existingCard || (!existingCard.imageUrl && Boolean(rewardCard.card.imageUrl));

    onAddWordCard?.(rewardCard.card);
    if (willChangeLibrary) {
      setSavedCardCount(prev => prev + 1);
      setShowNewCardToast(true);
      setTimeout(() => setShowNewCardToast(false), 3000);
    }
    setRewardCard(null);
  };

  const handleSkipRewardCard = () => {
    setRewardCard(null);
  };

  const handleRetryRewardCard = () => {
    if (!rewardCard) return;
    const { word, chars, levelId, animal, characterName, scene } = rewardCard.card;
    setRewardCard({ status: 'generating', card: rewardCard.card });
    generateCardPreview(word, chars, levelId, animal, characterName, scene).then(({ card, error }) => {
      setRewardCard(current => {
        if (!current || current.card.word !== word || current.card.levelId !== levelId) return current;
        return { status: 'ready', card, error };
      });
    });
  };

  const character = getCharacter?.() ?? { animal: '小兔子', emoji: '🐰', name: '小伙伴' };
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
          onSave={handleSaveRewardCard}
          onSkip={handleSkipRewardCard}
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
