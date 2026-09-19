'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { GameMode, LearningSummary, LevelData, CustomLevel, ReviewContext, WordPair, WordCard, WordPractice } from '../types';
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
import { PairSuccessToast } from './PairSuccessToast';
import { GameTutorial } from './GameTutorial';
import { MissionScene } from './MissionScene';
import type { PracticeEventType } from '../lib/learningProgress';
import {
  allowsCurriculumCompletion,
  applyReviewRoundEvent,
  refreshReviewContext,
  reconcileReviewReplacement,
  summarizeReviewRound,
} from '../lib/reviewRound';

interface Props {
  level: LevelData;
  mode?: GameMode;
  reviewContext?: ReviewContext;
  nextLevel: LevelData | null;
  onSelectLevel: () => void;
  onNextLevel: (level: LevelData) => void;
  onComplete: (levelId: string, nextId: string | null, stars: number) => void;
  customLevel?: CustomLevel;
  onIncrementPlayCount?: (id: string) => void;
  onWordBook: () => void;
  // 新增：词卡生成相关
  onAddWordCard?: (card: WordCard) => void;
  onRecordPracticeEvent?: (event: {
    levelId: string;
    words: readonly string[];
    type: PracticeEventType;
    at: number;
  }) => void;
  savedWordCards?: WordCard[];
  practiceByLevel?: Record<string, Record<string, WordPractice>>;
  getCharacter?: () => import('../types').AnimalCharacter;
}

export function GameScreen({
  level,
  mode = 'curriculum',
  reviewContext,
  nextLevel,
  onSelectLevel,
  onNextLevel,
  onComplete,
  customLevel,
  onIncrementPlayCount,
  onWordBook,
  onAddWordCard,
  onRecordPracticeEvent,
  savedWordCards = [],
  practiceByLevel = {},
  getCharacter,
}: Props) {
  // 词对数量仍按原来的方式从关卡棋盘尺寸推导（不改 curriculum/自定义关卡数据）
  const rows = mode === 'review' ? level.pairs.length
    : customLevel ? CUSTOM_LEVEL_BOARD_ROWS : level.boardRows ?? 4;
  const cols = mode === 'review' ? 2
    : customLevel ? CUSTOM_LEVEL_BOARD_COLS : level.boardCols ?? 4;
  const pairCount = Math.floor((rows * cols) / 2);

  // 双栏布局：左栏放每个词对的第一个字，右栏放第二个字，固定两列、
  // 行数等于本局词对数（跟原来的 rows*cols 网格尺寸解耦，只用于渲染整形）
  const boardRows = pairCount;
  const boardCols = 2;
  const currentLevelId = mode === 'review' ? level.id : customLevel?.id ?? level.id;
  const completionScope = useMemo(() => ({ levelId: currentLevelId }), [currentLevelId]);
  const currentPractice = useMemo(
    () => practiceByLevel[currentLevelId] || {},
    [practiceByLevel, currentLevelId]
  );

  // 用 useState 懒初始化而不是 useMemo：保证本局抽中的词对在整局游戏期间
  // 绝对不会重新抽样（useMemo 只要依赖项引用变化就可能重算，一旦重算就会
  // 抽出不同的随机词对，但棋盘还是旧的，会导致"明明是词却消不掉"）
  // This value only seeds useGame. All rendering and completion logic below use
  // the authoritative activePairs returned by useGame after restart/reshuffle.
  const [initialPairs] = useState<WordPair[]>(() =>
    mode === 'review'
      ? [...level.pairs]
      : pickPairsForPractice(customLevel?.pairs ?? level.pairs, pairCount, currentPractice)
  );

  const reviewContextRef = useRef<ReviewContext | null>(reviewContext ?? null);
  const reviewProjectionRef = useRef<Record<string, WordPractice>>(
    reviewContext?.baselineBySourceKey ?? {},
  );

  const completedRef = useRef(false);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionLevelRef = useRef(currentLevelId);
  const wasCompleteRef = useRef(false);
  const [completionReady, setCompletionReady] = useState<{ levelId: string; scope: object } | null>(null);
  const [showNewCardToast, setShowNewCardToast] = useState(false);
  const [savedCardCount, setSavedCardCount] = useState(0);
  const [pairSuccess, setPairSuccess] = useState<{ word: string; chars: WordPair } | null>(null);
  const [flippedCells, setFlippedCells] = useState<Set<string>>(new Set());
  const [learningSummary, setLearningSummary] = useState<LearningSummary | undefined>();
  const [showTutorial, setShowTutorial] = useState(() =>
    typeof window !== 'undefined' && !localStorage.getItem('hanzi-match-tutorial-v1')
  );
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { speak } = useTTS();

  const recordEvent = useCallback((type: PracticeEventType, words: readonly string[]) => {
    const at = Date.now();
    if (mode !== 'review' || !reviewContextRef.current) {
      onRecordPracticeEvent?.({ levelId: currentLevelId, words, type, at });
      return;
    }
    const applied = applyReviewRoundEvent(
      reviewContextRef.current,
      reviewProjectionRef.current,
      { type, words, at },
    );
    reviewProjectionRef.current = applied.projectionBySourceKey;
    applied.routedEvents.forEach(onRecordPracticeEvent ?? (() => {}));
  }, [currentLevelId, mode, onRecordPracticeEvent]);

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
    recordEvent('correct', [word]);
    if (isNewWord) {
      setSavedCardCount(prev => prev + 1);
      setShowNewCardToast(true);
      setTimeout(() => setShowNewCardToast(false), 1800);
    }
  }, [onAddWordCard, recordEvent, savedWordCards, speak]);

  const handlePairMistake = useCallback(({ words }: { words: string[] }) => {
    recordEvent('wrong', words);
  }, [recordEvent]);

  const handleHintUsed = useCallback(({ word }: { word: string }) => {
    recordEvent('hint', [word]);
  }, [recordEvent]);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const clearCompletionTimer = useCallback(() => {
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearCompletionTimer(), [clearCompletionTimer]);

  // 死局时"重新打乱"要从完整词库（不止本局抽中的这几对）里换新词，
  // 自定义关卡的完整词库是 customLevel.pairs，不是 level（那只是占位用的第一关）
  const fullPool = mode === 'review'
    ? reviewContext?.replacementPairs ?? level.pairs
    : customLevel ? customLevel.pairs : level.pairs;

  const handlePairsReplaced = useCallback(({ replacementPairs }: { replacementPairs: WordPair[] }) => {
    if (mode !== 'review' || !reviewContextRef.current) return;
    const reconciled = reconcileReviewReplacement(
      reviewContextRef.current,
      reviewProjectionRef.current,
      replacementPairs,
      practiceByLevel,
    );
    reviewContextRef.current = reconciled.context;
    reviewProjectionRef.current = reconciled.projectionBySourceKey;
  }, [mode, practiceByLevel]);

  const gameOptions = useMemo(() => ({
    rows: boardRows,
    cols: boardCols,
    fullPool,
    onPairEliminated: handlePairEliminated,
    onPairMistake: handlePairMistake,
    onHintUsed: handleHintUsed,
    onPairsReplaced: handlePairsReplaced,
  }), [boardCols, boardRows, fullPool, handleHintUsed, handlePairEliminated, handlePairMistake, handlePairsReplaced]);

  const { activePairs, cells, eliminatedCount, isComplete, feedback, milestone, isDeadlock, mistakeCount, hintCount, handleCellClick, showHint, restart, reshuffle } =
    useGame(level, initialPairs, gameOptions);
  const earnedStars = calculateStars({ mistakeCount, hintCount });

  // 完成存档与完成弹窗是两件事：存档立即完成，而弹窗等最后一个任务物件出现后再展示。
  // currentLevelId 变化时即使组件没有卸载，也不能让旧关卡的计时器盖住新关卡。
  useEffect(() => {
    if (completionLevelRef.current !== currentLevelId) {
      completionLevelRef.current = currentLevelId;
      completedRef.current = false;
      wasCompleteRef.current = isComplete;
      clearCompletionTimer();
      return;
    }

    if (!isComplete) {
      wasCompleteRef.current = false;
      clearCompletionTimer();
      return;
    }

    if (wasCompleteRef.current || completedRef.current) return;

    wasCompleteRef.current = true;
    completedRef.current = true;
    if (mode === 'review' && reviewContextRef.current) {
      setLearningSummary(summarizeReviewRound(
        reviewContextRef.current,
        reviewProjectionRef.current,
        activePairs,
      ));
    } else if (allowsCurriculumCompletion(mode)) {
      onComplete(level.id, nextLevel?.id ?? null, earnedStars);
    } else if (mode === 'custom' && customLevel && onIncrementPlayCount) {
      onIncrementPlayCount(customLevel.id);
    }

    const completedLevelId = currentLevelId;
    completionTimerRef.current = setTimeout(() => {
      if (
        completionLevelRef.current === completedLevelId
        && completedRef.current
      ) {
        setCompletionReady({ levelId: completedLevelId, scope: completionScope });
      }
      completionTimerRef.current = null;
    }, 700);
  }, [isComplete, currentLevelId, completionScope, level, nextLevel, customLevel, onComplete, onIncrementPlayCount, earnedStars, clearCompletionTimer, mode, activePairs]);

  const handleFlipCell = useCallback((cellId: string) => {
    setFlippedCells(prev => {
      const next = new Set(prev);
      if (next.has(cellId)) next.delete(cellId);
      else next.add(cellId);
      return next;
    });
  }, []);

  const handleRestart = () => {
    clearCompletionTimer();
    completedRef.current = false;
    wasCompleteRef.current = false;
    setCompletionReady(null);
    setSavedCardCount(0);
    setPairSuccess(null);
    setFlippedCells(new Set());
    setLearningSummary(undefined);
    if (mode === 'review' && reviewContextRef.current) {
      reviewContextRef.current = refreshReviewContext(reviewContextRef.current, practiceByLevel);
      reviewProjectionRef.current = { ...reviewContextRef.current.baselineBySourceKey };
    }
    const newPairs = mode === 'review'
      ? [...level.pairs]
      : pickPairsForPractice(customLevel?.pairs ?? level.pairs, pairCount, currentPractice);
    restart(newPairs);
  };

  const handleReshuffle = () => {
    reshuffle();
  };

  const character = getCharacter?.() ?? { animal: '小狐狸', emoji: '🦊', name: '小狐狸' };
  const title = mode === 'review' ? '今日复习' : customLevel ? customLevel.title : level.title;

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
          <div className="gb-lvl">{mode === 'review' ? '🌿 ' : customLevel ? '✨ ' : `第${level.level}关 · `}{title}</div>
          <div className="gb-lvl-sub">{mode === 'review' ? '这些词值得再见一次～' : '左右各选一个字，组成词语～'}</div>
        </div>

        <MissionScene
          levelId={currentLevelId}
          levelTitle={title}
          restoredCount={eliminatedCount}
          totalCount={activePairs.length}
          character={character}
        />

        <div className="gb-ctrls">
          <button className="btn btn-hint btn-big btn-block" onClick={showHint}>💡 找一对给我看</button>
          <button className="btn btn-restart btn-big btn-block" onClick={handleRestart}>🔄 重新摆放</button>
        </div>
      </div>

      <MilestoneToast message={milestone} />
      <FeedbackToast message={feedback} />
      <NewCardToast count={savedCardCount} show={showNewCardToast} />
      <PairSuccessToast payload={pairSuccess} />

      {completionReady?.levelId === currentLevelId && completionReady.scope === completionScope && isComplete && (
        <CompletionModal
          onNextLevel={nextLevel && mode === 'curriculum' ? () => onNextLevel(nextLevel) : null}
          onRestart={handleRestart}
          onSelectLevel={onSelectLevel}
          onWordBook={onWordBook}
          newCardCount={savedCardCount}
          character={character}
          stars={earnedStars}
          learningSummary={learningSummary}
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
