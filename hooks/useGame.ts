'use client'

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Cell, LevelData, WordPair } from '../types';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickPairsForGame(allPairs: WordPair[], maxPairs = 18): WordPair[] {
  if (allPairs.length <= maxPairs) return [...allPairs];
  return shuffleArray(allPairs).slice(0, maxPairs);
}

interface ReshuffleReplacement {
  activePairs: WordPair[];
  freshPairs: WordPair[];
}

/**
 * 死局回收的核心逻辑：棋盘上所有未消除的字，内容上已经无法互相配对
 * （调用前已经用 hasValidPair 确认过）。单纯打乱这批字的行位置毫无意义——
 * 判定完全按字符内容查表、不看位置，字不变，死局必然原样复现。
 * 真正能解开死局的唯一办法是把这批卡住的词换成词库里没出现过的新词。
 *
 * 优先从"本局还没抽到过"的词里换新词；真的不够用（词库太小）才退而求其次，
 * 允许拿"这局已经消除过"的词回收再来一遍——比让孩子永远卡死强。
 *
 * 抽出的每个新词本身都是词库里真实、独立、自成一对的词，所以新换上的这批字
 * 之间必然至少存在一组有效配对；如果这次刚好又撞上小概率的二次死局，
 * 玩家可以再点一次"重新打乱"重抽，不是必然无解。
 */
export function computeReshuffleReplacement(
  activePairs: WordPair[],
  stuckWords: Set<string>,
  fullPool: WordPair[],
  replacementCount = stuckWords.size,
): ReshuffleReplacement {
  const neededCount = Math.max(0, replacementCount);
  const usedThisRound = new Set(activePairs.map(p => p[0] + p[1]));

  const spare = fullPool.filter(p => !usedThisRound.has(p[0] + p[1]));
  let freshPairs = pickPairsForGame(spare, Math.min(neededCount, spare.length));

  if (freshPairs.length < neededCount) {
    // 词库太小，spare 不够：从"这局已经消除过"的词里回收（排除仍卡住的这几个，
    // 避免把死局本身原样放回去）
    const resolvedWords = new Set([...usedThisRound].filter(w => !stuckWords.has(w)));
    const fallbackPool = fullPool.filter(p => resolvedWords.has(p[0] + p[1]));
    freshPairs = [...freshPairs, ...pickPairsForGame(fallbackPool, neededCount - freshPairs.length)];
  }

  // A review round can deadlock before enough words have been eliminated to
  // supply unique fallbacks. Reconstruct every stuck slot from the valid pool,
  // cycling words when necessary. This guarantees paired cells and exact size.
  const recoveryPool = fullPool.length > 0 ? fullPool : activePairs;
  while (freshPairs.length < neededCount && recoveryPool.length > 0) {
    const cycle = pickPairsForGame(recoveryPool, recoveryPool.length);
    freshPairs.push(...cycle.slice(0, neededCount - freshPairs.length));
  }

  const retainedCount = Math.max(0, activePairs.length - neededCount);
  const retained = activePairs.filter(p => !stuckWords.has(p[0] + p[1])).slice(0, retainedCount);
  if (retained.length < retainedCount) {
    retained.push(...activePairs.slice(0, retainedCount - retained.length));
  }
  const newActivePairs = [...retained, ...freshPairs.slice(0, neededCount)];

  return { activePairs: newActivePairs, freshPairs };
}

interface UseGameOptions {
  rows?: number;
  cols?: number;
  fullPool?: WordPair[]; // 本关完整词库（不止本局抽中的这几对），死局时从里面换新词用
  onPairEliminated?: (payload: { word: string; chars: WordPair; pairId: number }) => void;
  onPairMistake?: (payload: { words: string[] }) => void;
  onHintUsed?: (payload: { word: string }) => void;
  onCellSelected?: (payload: { char: string; word: string }) => void;
  onPairsReplaced?: (payload: { activePairs: WordPair[]; replacementPairs: WordPair[] }) => void;
}

/**
 * 将词对列表转换为棋盘初始状态。
 * 双栏配词模式：每个词对的第一个字只进左栏（第0列），第二个字只进右栏（第1列），
 * 两栏各自独立打乱顺序（不能让行号暗示正确配对）。
 * 玩家点左栏一个字、右栏一个字，两字能组成有效词语即可消除。
 */
function initBoard(pairs: WordPair[], rows: number, cols: number): Cell[][] {
  const leftEntries = pairs.map((pair, pairId) => ({ char: pair[0], word: pair[0] + pair[1], pairId }));
  const rightEntries = pairs.map((pair, pairId) => ({ char: pair[1], word: pair[0] + pair[1], pairId }));
  const shuffledLeft = shuffleArray(leftEntries);
  const shuffledRight = shuffleArray(rightEntries);

  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const cellData = c === 0 ? shuffledLeft[r] : c === 1 ? shuffledRight[r] : undefined;
      return {
        id: `cell-${r}-${c}`,
        char: cellData?.char ?? '',
        word: cellData?.word ?? '',
        pairId: cellData?.pairId ?? -1,
        isEmpty: !cellData,
        isSelected: false,
        isHinted: false,
        isEliminating: false,
        isShaking: false,
      };
    })
  );
}

// 检测棋盘上是否还有可消除的对（按词语有效性，而非 pairId）
function hasValidPair(cells: Cell[][], activePairs: WordPair[]): boolean {
  const validWords = new Set(activePairs.map(p => p[0] + p[1]));
  const remaining = cells.flat().filter(c => !c.isEmpty && c.char);
  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      if (
        validWords.has(remaining[i].char + remaining[j].char) ||
        validWords.has(remaining[j].char + remaining[i].char)
      ) return true;
    }
  }
  return false;
}

export function useGame(level: LevelData, pairsOverride?: WordPair[], options: UseGameOptions = {}) {
  const rows = options.rows ?? level.boardRows ?? 6;
  const cols = options.cols ?? level.boardCols ?? 6;
  const fullPool = options.fullPool ?? level.pairs;
  // activePairs 用 state 而不是纯派生值：死局时"重新打乱"需要真的替换掉
  // 卡住的词（见 computeReshuffleReplacement），这必须能实际改变判定用的词表，
  // 不能只是原样复用传进来的 pairsOverride。
  const [activePairs, setActivePairs] = useState<WordPair[]>(() => pairsOverride ?? level.pairs);
  const [cells, setCells] = useState<Cell[][]>(() => initBoard(activePairs, rows, cols));
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [eliminatedCount, setEliminatedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<string | null>(null);
  const [isDeadlock, setIsDeadlock] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const milestoneShownRef = useRef(false);
  const pendingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const clearPendingTimers = useCallback(() => {
    pendingTimersRef.current.forEach(timer => clearTimeout(timer));
    pendingTimersRef.current.clear();
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      pendingTimersRef.current.delete(timer);
      callback();
    }, delay);
    pendingTimersRef.current.add(timer);
    return timer;
  }, []);

  useEffect(() => clearPendingTimers, [clearPendingTimers]);

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    schedule(() => setFeedback(null), 1500);
  }, [schedule]);

  const restart = useCallback((newPairs?: WordPair[]) => {
    clearPendingTimers();
    const nextPairs = newPairs ?? activePairs;
    setActivePairs(nextPairs);
    setCells(initBoard(nextPairs, rows, cols));
    setSelected(null);
    setEliminatedCount(0);
    setIsComplete(false);
    setFeedback(null);
    setMilestone(null);
    setIsDeadlock(false);
    setMistakeCount(0);
    setHintCount(0);
    milestoneShownRef.current = false;
  }, [activePairs, clearPendingTimers, rows, cols]);

  // 死局回收：不是简单打乱位置——判定完全按字符内容查表、不看行列位置，
  // 卡住的字原样挪个位置，内容没变，死局会原样复现。真正要做的是把卡住的这批
  // 字换成词库里没出现过的新词（见 computeReshuffleReplacement 的完整原因说明）。
  const reshuffle = useCallback(() => {
    const stuckLeft: { row: number; col: number }[] = [];
    const stuckRight: { row: number; col: number }[] = [];
    const stuckWords = new Set<string>();
    cells.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell.isEmpty) return;
        stuckWords.add(cell.word);
        (c === 0 ? stuckLeft : stuckRight).push({ row: r, col: c });
      })
    );

    if (stuckWords.size === 0) {
      setIsDeadlock(false);
      return;
    }

    const { activePairs: newActivePairs, freshPairs } =
      computeReshuffleReplacement(activePairs, stuckWords, fullPool, stuckLeft.length);

    if (freshPairs.length !== stuckLeft.length || freshPairs.length !== stuckRight.length) {
      showFeedback('暂时找不到可换的词，请重新摆放～');
      return;
    }
    options.onPairsReplaced?.({ activePairs: newActivePairs, replacementPairs: freshPairs });

    // 新词分别独立打乱后，按栏位填回原本卡住的那些格子位置
    const shuffledForLeft = shuffleArray(freshPairs);
    const shuffledForRight = shuffleArray(freshPairs);

    const nextCells = cells.map(row => row.map(cell => ({ ...cell })));
    stuckLeft.forEach(({ row, col }, i) => {
      const pair = shuffledForLeft[i];
      if (!pair) return; // 极端情况下新词凑不够，格子保持原样，避免崩溃
      nextCells[row][col] = { ...nextCells[row][col], char: pair[0], word: pair[0] + pair[1] };
    });
    stuckRight.forEach(({ row, col }, i) => {
      const pair = shuffledForRight[i];
      if (!pair) return;
      nextCells[row][col] = { ...nextCells[row][col], char: pair[1], word: pair[0] + pair[1] };
    });

    setCells(nextCells);
    setActivePairs(newActivePairs);
    setSelected(null);
    // 换上的新词理论上有极小概率自己又凑巧卡住（词库字符复用总有一点概率）——
    // 换完立刻重新检测一次，不能无条件当作"肯定解开了"，否则真遇上这种小概率
    // 情况，死局弹窗不会再出现，孩子会在毫无提示的情况下第二次卡死。
    setIsDeadlock(!hasValidPair(nextCells, newActivePairs));
    showFeedback('换了几个新词，再试试！');
  }, [cells, activePairs, fullPool, options, showFeedback]);

  const showHint = useCallback(() => {
    const flat: { cell: Cell; row: number; col: number }[] = [];
    cells.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (!cell.isEmpty) flat.push({ cell, row: r, col: c });
      })
    );

    // 找到一对可组成有效词语的汉字格
    const validWords = new Set(activePairs.map(p => p[0] + p[1]));
    const validPairs: { cells: [typeof flat[0], typeof flat[0]]; word: string }[] = [];
    for (let i = 0; i < flat.length; i++) {
      for (let j = i + 1; j < flat.length; j++) {
        if (flat[i].col === flat[j].col) continue;
        const w1 = flat[i].cell.char + flat[j].cell.char;
        const w2 = flat[j].cell.char + flat[i].cell.char;
        const word = validWords.has(w1) ? w1 : validWords.has(w2) ? w2 : null;
        if (word) validPairs.push({ cells: [flat[i], flat[j]], word });
      }
    }

    if (validPairs.length === 0) return;
    setHintCount(prev => prev + 1);
    const pick = validPairs[Math.floor(Math.random() * validPairs.length)];
    options.onHintUsed?.({ word: pick.word });
    setCells(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell, isHinted: false })));
      next[pick.cells[0].row][pick.cells[0].col].isHinted = true;
      next[pick.cells[1].row][pick.cells[1].col].isHinted = true;
      return next;
    });
    schedule(() => {
      setCells(prev => prev.map(row => row.map(cell => ({ ...cell, isHinted: false }))));
    }, 2000);
  }, [cells, activePairs, options, schedule]);

  const handleCellClick = useCallback((row: number, col: number) => {
    const cell = cells[row][col];
    if (cell.isEmpty || cell.isEliminating) return;

    if (selected === null) {
      // 第一次选择
      setCells(prev => {
        const next = prev.map(r => r.map(c => ({ ...c, isSelected: false })));
        next[row][col].isSelected = true;
        return next;
      });
      setSelected({ row, col });
      options.onCellSelected?.({ char: cell.char, word: cell.word });
      return;
    }

    // 点击同一格 — 取消选中
    if (selected.row === row && selected.col === col) {
      setCells(prev => prev.map(r => r.map(c => ({ ...c, isSelected: false }))));
      setSelected(null);
      return;
    }

    const first = cells[selected.row][selected.col];
    const second = cell;

    // 双栏配词必须左右各选一个字。若点到同一栏，明确告诉孩子规则，
    // 不把第二次点击悄悄当作新的第一次选择。
    if (selected.col === col) {
      setCells(prev => {
        const next = prev.map(r => r.map(c => ({ ...c })));
        next[selected.row][selected.col].isShaking = true;
        next[row][col].isShaking = true;
        return next;
      });
      showFeedback('要从另一边找词语伙伴哦～');
      schedule(() => {
        setCells(prev => prev.map(r => r.map(c => ({ ...c, isSelected: false, isShaking: false }))));
        setSelected(null);
      }, 400);
      return;
    }

    // 两个汉字能组成有效词语即可消除（无顺序要求，不依赖 pairId）
    const w1 = first.char + second.char;
    const w2 = second.char + first.char;
    const matchedPair = activePairs.find(p => p[0] + p[1] === w1 || p[0] + p[1] === w2);
    const canEliminate = !!matchedPair;

    if (canEliminate) {
      const eliminatedWord = matchedPair![0] + matchedPair![1];
      const matchedPairIndex = activePairs.indexOf(matchedPair!);
      options.onPairEliminated?.({
        word: eliminatedWord,
        chars: matchedPair!,
        pairId: matchedPairIndex,
      });

      // 消除动画
      setCells(prev => {
        const next = prev.map(r => r.map(c => ({ ...c, isSelected: false, isHinted: false })));
        next[selected.row][selected.col].isEliminating = true;
        next[row][col].isEliminating = true;
        return next;
      });
      setSelected(null);

      schedule(() => {
        setCells(prev => {
          const next = prev.map(r => r.map(c => ({ ...c })));
          next[selected.row][selected.col].isEmpty = true;
          next[selected.row][selected.col].isEliminating = false;
          next[row][col].isEmpty = true;
          next[row][col].isEliminating = false;
          return next;
        });

        setEliminatedCount(prev => {
          const next = prev + 1;
          if (next >= activePairs.length) {
            setIsComplete(true);
          }
          if (next === Math.floor(activePairs.length / 2) && !milestoneShownRef.current) {
            milestoneShownRef.current = true;
            setMilestone('已经消了一半啦！继续加油 ⚡');
            schedule(() => setMilestone(null), 2000);
          }
          return next;
        });

        // 死局检测
        schedule(() => {
          setCells(currentCells => {
            if (!hasValidPair(currentCells, activePairs)) {
              const remainingCount = currentCells.flat().filter(c => !c.isEmpty).length;
              if (remainingCount > 0) {
                setIsDeadlock(true);
              }
            }
            return currentCells;
          });
        }, 50);
      }, 300);

    } else {
      // 不是有效词语 — 短暂震动提示两个格子，随后清空选中
      // （不能把这次失败的点击悄悄当成"新的第一次选择"，否则玩家分不清是选中了新格子
      //  还是刚才那次点击失败了）
      setMistakeCount(prev => prev + 1);
      options.onPairMistake?.({ words: [...new Set([first.word, second.word].filter(Boolean))] });
      setCells(prev => {
        const next = prev.map(r => r.map(c => ({ ...c })));
        next[selected.row][selected.col].isShaking = true;
        next[row][col].isShaking = true;
        return next;
      });
      showFeedback('这两个字拼不成词，再试试～');
      schedule(() => {
        setCells(prev => prev.map(r => r.map(c => ({ ...c, isSelected: false, isShaking: false }))));
        setSelected(null);
      }, 400);
    }
  }, [cells, selected, activePairs, options, schedule, showFeedback]);

  return {
    activePairs,
    cells,
    eliminatedCount,
    isComplete,
    feedback,
    milestone,
    isDeadlock,
    mistakeCount,
    hintCount,
    handleCellClick,
    showHint,
    restart,
    reshuffle,
  };
}
