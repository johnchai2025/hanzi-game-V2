'use client'

import { useState, useEffect, useCallback } from 'react';
import type { Curriculum, CurriculumUnit, LevelData } from '../types';

function unitToLevel(unit: CurriculumUnit): LevelData {
  return {
    id: unit.id,
    grade: unit.grade,
    semester: unit.semester,
    level: unit.unit,
    title: unit.title,
    lessons: unit.lessons,
    newChars: unit.newChars,
    pairs: unit.pairs,
    boardRows: unit.boardRows,
    boardCols: unit.boardCols,
  };
}

export function useLevels() {
  const [levels, setLevels] = useState<LevelData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLevels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/curriculum/grade2_semester1.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data: Curriculum = await res.json();
      const levels = data.units.map(unitToLevel);
      const valid = levels.every(
        (l: LevelData) => {
          const cellCount = (l.boardRows ?? 6) * (l.boardCols ?? 6);
          return Array.isArray(l.pairs) && l.pairs.length >= Math.floor(cellCount / 2);
        }
      );
      
      if (!valid) throw new Error('字库格式错误：存在关卡词对数量不足');
      
      setLevels(levels);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadLevels();
    });
  }, [loadLevels]);

  return { levels, loading, error, reload: loadLevels };
}
