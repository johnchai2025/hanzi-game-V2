'use client'

import { useState, useCallback, useEffect } from 'react';
import type { SaveData, CustomLevel, Story, WordCard } from '../types';
import { saveImage, loadAllImages, deleteImage } from '../lib/imageStore';

const SAVE_KEY = 'hanzi-match-save';
const CUSTOM_KEY = 'hanzi-match-custom-levels';

// 当前课程的第一关 ID，永远默认解锁。
// 换课程（如一年级下 → 二年级上）时必须跟着改，否则老存档里全是旧课程的关卡 ID，
// 新课程一关都不会解锁，游戏会整个锁死。
const FIRST_LEVEL_ID = 'g2s1u1';

const defaultSave: SaveData = {
  unlockedLevels: [FIRST_LEVEL_ID],
  completedLevels: [],
  wordCards: [],
  stories: [],
  practiceByLevel: {},
  levelStars: {},
};

export function normalizeSaveData(parsed: Partial<SaveData> | null | undefined): SaveData {
  if (!parsed) return defaultSave;

  const cards = Array.isArray(parsed.wordCards) ? parsed.wordCards : [];
  const practiceByLevel: SaveData['practiceByLevel'] = { ...(parsed.practiceByLevel || {}) };

  // 旧版卡片曾用 levelId 表示归属。只在新结构尚无该记录时迁移一次；
  // 新版卡片全局按 word 去重，不再承担关卡进度职责。
  cards.forEach(card => {
    if (!card.levelId) return;
    const levelPractice = { ...(practiceByLevel[card.levelId] || {}) };
    if (!levelPractice[card.word]) {
      levelPractice[card.word] = {
        correctCount: 1,
        lastPracticedAt: card.generatedAt || Date.now(),
      };
    }
    practiceByLevel[card.levelId] = levelPractice;
  });

  const unlockedLevels = parsed.unlockedLevels?.length ? parsed.unlockedLevels : [FIRST_LEVEL_ID];
  return {
    unlockedLevels: unlockedLevels.includes(FIRST_LEVEL_ID)
      ? unlockedLevels
      : [FIRST_LEVEL_ID, ...unlockedLevels],
    completedLevels: parsed.completedLevels || [],
    wordCards: cards,
    stories: parsed.stories || [],
    practiceByLevel,
    levelStars: parsed.levelStars || {},
  };
}

// 只剥离 base64 图片（旧版直接把整串图存本地，会撑爆 localStorage 5MB 配额）。
// 新版 imageUrl 是服务器图库的短 URL（/api/word-image/词?v=...），几十个字符，
// 不需要挪去 IndexedDB，原样存 localStorage 即可。
function stripImageUrls(data: SaveData): SaveData {
  return {
    ...data,
    wordCards: data.wordCards?.map(c => (c.imageUrl?.startsWith('data:') ? { ...c, imageUrl: '' } : c)) ?? [],
  };
}

function saveToLocalStorage(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(stripImageUrls(data)));
  } catch (e) {
    console.error('localStorage save failed:', e);
  }
}

function loadSaveFromStorage(): SaveData {
  if (typeof window === 'undefined') return defaultSave;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return normalizeSaveData(JSON.parse(raw));
  } catch {}
  return defaultSave;
}

function loadCustomLevelsFromStorage(): CustomLevel[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function useSaveData() {
  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveFromStorage());
  const [customLevels, setCustomLevels] = useState<CustomLevel[]>(() => loadCustomLevelsFromStorage());

  // One-time on mount: migrate legacy base64 imageUrls from localStorage → IndexedDB, then hydrate.
  // 新版 imageUrl 是服务器 URL，本来就直接躺在 localStorage 里，不用挪也不用 hydrate；
  // 这里只处理"升级前"遗留的老式 base64 卡片。
  useEffect(() => {
    const cards = saveData.wordCards;
    if (!cards || cards.length === 0) return;

    const legacyBase64Cards = cards.filter(c => c.imageUrl?.startsWith('data:'));
    if (legacyBase64Cards.length > 0) {
      Promise.all(legacyBase64Cards.map(c => saveImage(c.id, c.imageUrl)))
        .then(() => saveToLocalStorage(saveData))
        .catch(console.error);
    }

    // 只需要把"当前没有 imageUrl"的老卡片从 IndexedDB 读回来（新版 URL 卡片已经自带内容，不用查）
    const idsNeedingHydration = cards.filter(c => !c.imageUrl).map(c => c.id);
    if (idsNeedingHydration.length === 0) return;
    loadAllImages(idsNeedingHydration).then(imageMap => {
      if (imageMap.size === 0) return;
      setSaveData(prev => ({
        ...prev,
        wordCards: prev.wordCards?.map(c => ({
          ...c,
          imageUrl: c.imageUrl || imageMap.get(c.id) || '',
        })) ?? [],
      }));
    }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once at mount

  const completeLevel = useCallback((levelId: string, nextLevelId: string | null, stars: number) => {
    setSaveData(prev => {
      const next: SaveData = {
        ...prev,
        completedLevels: prev.completedLevels.includes(levelId)
          ? prev.completedLevels
          : [...prev.completedLevels, levelId],
        unlockedLevels:
          nextLevelId && !prev.unlockedLevels.includes(nextLevelId)
            ? [...prev.unlockedLevels, nextLevelId]
            : prev.unlockedLevels,
        levelStars: {
          ...(prev.levelStars || {}),
          [levelId]: Math.max(prev.levelStars?.[levelId] || 0, stars),
        },
      };
      saveToLocalStorage(next);
      return next;
    });
  }, []);

  const recordWordPractice = useCallback((levelId: string, word: string) => {
    setSaveData(prev => {
      const levelPractice = prev.practiceByLevel?.[levelId] || {};
      const previous = levelPractice[word];
      const next: SaveData = {
        ...prev,
        practiceByLevel: {
          ...(prev.practiceByLevel || {}),
          [levelId]: {
            ...levelPractice,
            [word]: {
              correctCount: (previous?.correctCount || 0) + 1,
              lastPracticedAt: Date.now(),
            },
          },
        },
      };
      saveToLocalStorage(next);
      return next;
    });
  }, []);

  // 去重键统一用 word（不再是 levelId+word）——服务器图库本身就是"一词一图"全局唯一，
  // 卡片库跟着按 word 走才不会出现同一个词存两条记录、老版本还会在 IndexedDB 里存两份图。
  // 已有记录时允许覆盖（不再判断"已有图就不更新"），这是"换一张图"功能能写得进去的前提。
  const addWordCard = useCallback((card: WordCard) => {
    // 旧版 base64 图片仍需要挪进 IndexedDB；新版是服务器 URL，直接存字符串即可
    if (card.imageUrl?.startsWith('data:')) {
      saveImage(card.id, card.imageUrl).catch(console.error);
    }

    setSaveData(prev => {
      const existingCards = prev.wordCards || [];
      const existingIndex = existingCards.findIndex(c => c.word === card.word);
      if (existingIndex >= 0) {
        const updatedCards = [...existingCards];
        updatedCards[existingIndex] = {
          ...existingCards[existingIndex],
          ...card,
          imageUrl: card.imageUrl || existingCards[existingIndex].imageUrl,
          levelId: existingCards[existingIndex].levelId ?? card.levelId,
        };
        const next: SaveData = { ...prev, wordCards: updatedCards };
        saveToLocalStorage(next);
        return next;
      }

      const next: SaveData = { ...prev, wordCards: [...existingCards, card] };
      saveToLocalStorage(next);
      return next;
    });
  }, []);

  const addWordCards = useCallback((cards: WordCard[]) => {
    cards.forEach(c => {
      if (c.imageUrl?.startsWith('data:')) saveImage(c.id, c.imageUrl).catch(console.error);
    });

    setSaveData(prev => {
      const existingWords = new Set(prev.wordCards?.map(c => c.word) || []);
      const newCards = cards.filter(c => !existingWords.has(c.word));
      if (newCards.length === 0) return prev;

      const next: SaveData = {
        ...prev,
        wordCards: [...(prev.wordCards || []), ...newCards],
      };
      saveToLocalStorage(next);
      return next;
    });
  }, []);

  const addStory = useCallback((story: Story) => {
    setSaveData(prev => {
      const next: SaveData = {
        ...prev,
        stories: [story, ...(prev.stories || [])],
      };
      saveToLocalStorage(next);
      return next;
    });
  }, []);

  const deleteWordCard = useCallback((id: string) => {
    deleteImage(id).catch(console.error);
    setSaveData(prev => {
      const next: SaveData = {
        ...prev,
        wordCards: (prev.wordCards || []).filter(c => c.id !== id),
      };
      saveToLocalStorage(next);
      return next;
    });
  }, []);

  const deleteStory = useCallback((id: string) => {
    setSaveData(prev => {
      const next: SaveData = {
        ...prev,
        stories: (prev.stories || []).filter(s => s.id !== id),
      };
      saveToLocalStorage(next);
      return next;
    });
  }, []);

  const saveCustomLevel = useCallback((level: CustomLevel) => {
    setCustomLevels(prev => {
      const next = [...prev, level];
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteCustomLevel = useCallback((id: string) => {
    setCustomLevels(prev => {
      const next = prev.filter(l => l.id !== id);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const incrementPlayCount = useCallback((id: string) => {
    setCustomLevels(prev => {
      const next = prev.map(l => l.id === id ? { ...l, playCount: l.playCount + 1 } : l);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    saveData,
    customLevels,
    completeLevel,
    recordWordPractice,
    addWordCard,
    addWordCards,
    addStory,
    deleteWordCard,
    deleteStory,
    saveCustomLevel,
    deleteCustomLevel,
    incrementPlayCount,
  };
}
