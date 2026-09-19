'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { LevelData, CustomLevel, WordPair, WordCard } from '../types';
import { CUSTOM_LEVEL_BOARD_ROWS, CUSTOM_LEVEL_BOARD_COLS } from '../types';
import { useGame } from '../hooks/useGame';
import { useTTS } from '../hooks/useTTS';
import { pickPairsForPractice } from '../lib/practiceSelection';
import { calculateStars } from '../lib/gameProgress';
import { GameBoard } from './GameBoard';
import { FeedbackToast } from './FeedbackToast';
import { MilestoneToast } from './MilestoneToast';
import { CompletionModal } from './CompletionModal';
import { DeadlockModal } from './DeadlockModal';
import { NewCardToast } from './NewCardToast';
import { MascotImg } from './MascotImg';
import { PairSuccessToast } from './PairSuccessToast';
import { GameTutorial } from './GameTutorial';

interface Props {
  level: LevelData;
  nextLevel: LevelData | null;
  onSelectLevel: () => void;
  onNextLevel: (level: LevelData) => void;
  onComplete: (levelId: string, nextId: string | null, stars: number) => void;
  customLevel?: CustomLevel;
  onIncrementPlayCount?: (id: string) => void;
  onWordBook: () => void;
  // 新增：词卡生成相关
  onAddWordCard?: (card: WordCard) => void;
  onRecordWordPractice?: (levelId: string, word: string) => void;
  savedWordCards?: WordCard[];
  practiceByLevel?: Record<string, Record<string, { correctCount: number; lastPracticedAt: number }>>;
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
  onWordBook,
  onAddWordCard,
  onRecordWordPractice,
  savedWordCards = [],
  practiceByLevel = {},
  getCharacter,
}: Props) {
  // 词对数量仍按原来的方式从关卡棋盘尺寸推导（不改 curriculum/自定义关卡数据）
  const rows = customLevel ? CUSTOM_LEVEL_BOARD_ROWS : level.boardRows ?? 4;
  const cols = customLevel ? CUSTOM_LEVEL_BOARD_COLS : level.boardCols ?? 4;
  const pairCount = Math.floor((rows * cols) / 2);

  // 双栏布局：左栏放每个词对的第一个字，右栏放第二个字，固定两列、
  // 行数等于本局词对数（跟原来的 rows*cols 网格尺寸解耦，只用于渲染整形）
  const boardRows = pairCount;
  const boardCols = 2;
  const currentLevelId = customLevel?.id ?? level.id;
  const practicedWords = useMemo(
    () => new Set(Object.keys(practiceByLevel[currentLevelId] || {})),
    [practiceByLevel, currentLevelId]
  );

  // 用 useState 懒初始化而不是 useMemo：保证本局抽中的词对在整局游戏期间
  // 绝对不会重新抽样（useMemo 只要依赖项引用变化就可能重算，一旦重算就会
  // 抽出不同的随机词对，但棋盘还是旧的，会导致"明明是词却消不掉"）
  const [activePairs] = useState<WordPair[]>(() =>
    pickPairsForPractice(customLevel?.pairs ?? level.pairs, pairCount, practicedWords)
  );

  const completedRef = useRef(false);
  const [showNewCardToast, setShowNewCardToast] = useState(false);
  const [savedCardCount, setSavedCardCount] = useState(0);
  const [pairSuccess, setPairSuccess] = useState<{ word: string; chars: WordPair } | null>(null);
  const [flippedCells, setFlippedCells] = useState<Set<string>>(new Set());
  const [showTutorial, setShowTutorial] = useState(() =>
    typeof window !== 'undefined' && !localStorage.getItem('hanzi-match-tutorial-v1')
  );
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { speak } = useTTS();

  const handlePairEliminated = useCallback(({ word, chars }: { word: string; chars: WordPair }) => {
    speak(word);
    setPairSuccess({ word, chars });
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setPairSuccess(null), 1200);

    const existingCard = savedWordCards.find(existing => existing.word === word);
    const card: WordCard = {
      id: `card-${word}`,
      word,
      chars,
      imageUrl: existingCard?.imageUrl || '',
      generatedAt: Date.now(),
    };
    const isNewWord = !existingCard;
    onAddWordCard?.(card);
    onRecordWordPractice?.(currentLevelId, word);
    if (isNewWord) {
      setSavedCardCount(prev => prev + 1);
      setShowNewCardToast(true);
      setTimeout(() => setShowNewCardToast(false), 1800);
    }
  }, [currentLevelId, onAddWordCard, onRecordWordPractice, savedWordCards, speak]);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  // 死局时"重新打乱"要从完整词库（不止本局抽中的这几对）里换新词，
  // 自定义关卡的完整词库是 customLevel.pairs，不是 level（那只是占位用的第一关）
  const fullPool = customLevel ? customLevel.pairs : level.pairs;

  const gameOptions = useMemo(() => ({
    rows: boardRows,
    cols: boardCols,
    fullPool,
    onPairEliminated: handlePairEliminated,
  }), [boardCols, boardRows, fullPool, handlePairEliminated]);

  const { cells, eliminatedCount, isComplete, feedback, milestone, isDeadlock, mistakeCount, hintCount, handleCellClick, showHint, restart, reshuffle } =
    useGame(level, activePairs, gameOptions);
  const earnedStars = calculateStars({ mistakeCount, hintCount });

  // 监听关卡完成
  useEffect(() => {
    if (isComplete && !completedRef.current) {
      completedRef.current = true;
      if (!customLevel) {
        onComplete(level.id, nextLevel?.id ?? null, earnedStars);
      } else if (onIncrementPlayCount) {
        onIncrementPlayCount(customLevel.id);
      }

    }
  }, [isComplete, level, nextLevel, customLevel, onComplete, onIncrementPlayCount, earnedStars]);

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
    setPairSuccess(null);
    setFlippedCells(new Set());
    const newPairs = pickPairsForPractice(customLevel?.pairs ?? level.pairs, pairCount, practicedWords);
    restart(newPairs);
  };

  const handleReshuffle = () => {
    reshuffle();
  };

  const character = getCharacter?.() ?? { animal: '小狐狸', emoji: '🦊', name: '小狐狸' };
  const progress = activePairs.length > 0 ? Math.round((eliminatedCount / activePairs.length) * 100) : 0;
  const title = customLevel ? customLevel.title : level.title;
  const mascotMsg = (() => {
    if (progress >= 100) return '全部消完啦！🎉';
    if (eliminatedCount === 0) return '左右各选一个字，组成词语吧！';
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
          <div className="gb-lvl-sub">左右各选一个字，组成词语～</div>
        </div>

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
      <PairSuccessToast payload={pairSuccess} />

      {isComplete && (
        <CompletionModal
          onNextLevel={nextLevel && !customLevel ? () => onNextLevel(nextLevel) : null}
          onRestart={handleRestart}
          onSelectLevel={onSelectLevel}
          onWordBook={onWordBook}
          newCardCount={savedCardCount}
          character={character}
          stars={earnedStars}
        />
      )}
      {isDeadlock && (
        <DeadlockModal
          onReshuffle={handleReshuffle}
          onRestart={handleRestart}
        />
      )}
      {showTutorial && (
        <GameTutorial onDismiss={() => {
          localStorage.setItem('hanzi-match-tutorial-v1', 'done');
          setShowTutorial(false);
        }} />
      )}
    </div>
  );
}
