'use client'

import { useEffect, useRef, useState } from 'react';
import type { LevelData, CustomLevel, ReviewContext, Story, UserProfile, WordCard } from '@/types';
import { useLevels } from '@/hooks/useLevels';
import { useSaveData } from '@/hooks/useSaveData';
import { useProfile } from '@/hooks/useProfile';
import { LevelSelectScreen } from '@/components/LevelSelectScreen';
import { GameScreen } from '@/components/GameScreen';
import { WordBookScreen } from '@/components/WordBookScreen';
import { StoryScreen } from '@/components/StoryScreen';
import { ProfileSetupModal } from '@/components/ProfileSetupModal';
import { NavRail, type NavTab } from '@/components/NavRail';
import { OrientationGate } from '@/components/OrientationGate';
import { buildReviewCandidates, selectDailyReview } from '@/lib/reviewSelection';
import { createReviewContext } from '@/lib/reviewRound';

type View = 'levelselect' | 'game' | 'wordbook' | 'story';

export default function Home() {
  const { levels, loading, error, reload } = useLevels();
  const { saveData, customLevels, completeLevel, recordPracticeEvent, addWordCard, addStory, deleteStory, saveCustomLevel, deleteCustomLevel, incrementPlayCount, deleteWordCard } = useSaveData();
  const { saveProfile, isSetupRequired, getCharacter, getRandomScene } = useProfile();

  const [view, setView] = useState<View>('levelselect');
  const [activeLevel, setActiveLevel] = useState<LevelData | null>(null);
  const [activeCustomLevel, setActiveCustomLevel] = useState<CustomLevel | null>(null);
  const [activeReviewContext, setActiveReviewContext] = useState<ReviewContext | null>(null);
  const reviewBootstrapRef = useRef(false);

  // Task 6 adds the approved visible entry. Until then, this programmatic route
  // keeps the complete review wiring testable without exposing unfinished UI.
  useEffect(() => {
    if (loading || reviewBootstrapRef.current || window.location.hash !== '#review') return;
    const candidates = buildReviewCandidates({
      builtInLevels: levels.map(level => ({
        id: level.id,
        unlocked: saveData.unlockedLevels.includes(level.id),
        pairs: level.pairs,
        practiceByWord: saveData.practiceByLevel[level.id] || {},
      })),
      customLevels: customLevels.map(level => ({
        id: level.id,
        createdAt: level.createdAt,
        pairs: level.pairs,
        practiceByWord: saveData.practiceByLevel[level.id] || {},
      })),
    });
    const selection = selectDailyReview(candidates);
    if (!selection.available) return;
    const context = createReviewContext(selection.candidates, saveData.practiceByLevel);
    const timer = window.setTimeout(() => {
      if (reviewBootstrapRef.current) return;
      reviewBootstrapRef.current = true;
      setActiveReviewContext(context);
      setActiveCustomLevel(null);
      setActiveLevel(context.level);
      setView('game');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [customLevels, levels, loading, saveData]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <div>加载字库中…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <div className="error-icon">⚠️</div>
        <div>字库加载失败</div>
        <div className="error-detail">{error}</div>
        <button className="btn btn-primary" onClick={reload}>重试</button>
      </div>
    );
  }

  const getNextLevel = (currentLevel: LevelData): LevelData | null => {
    const idx = levels.findIndex(l => l.id === currentLevel.id);
    return idx >= 0 && idx < levels.length - 1 ? levels[idx + 1] : null;
  };

  const handleSelectLevel = (level: LevelData) => {
    setActiveReviewContext(null);
    setActiveLevel(level);
    setActiveCustomLevel(null);
    setView('game');
  };

  const handlePlayCustom = (level: CustomLevel) => {
    setActiveReviewContext(null);
    setActiveCustomLevel(level);
    setActiveLevel(levels[0] ?? null);
    setView('game');
  };

  const handleNextLevel = (level: LevelData) => {
    setActiveReviewContext(null);
    setActiveLevel(level);
    setActiveCustomLevel(null);
  };

  const handleComplete = (levelId: string, nextId: string | null, stars: number) => {
    completeLevel(levelId, nextId, stars);
  };

  const handleProfileComplete = (newProfile: UserProfile) => {
    saveProfile(newProfile);
  };

  const handleAddWordCard = (card: WordCard) => {
    addWordCard(card);
  };

  const handleAddStory = (story: Story) => {
    addStory(story);
  };

  // 导航栏当前高亮项：游戏对局归属「闯关」
  const navTab: NavTab = view === 'wordbook' ? 'cards' : view === 'story' ? 'story' : 'home';

  const handleNavigate = (tab: NavTab) => {
    if (tab === 'home') setView('levelselect');
    else if (tab === 'cards') setView('wordbook');
    else setView('story');
  };

  return (
    <div className="app-shell">
      {view !== 'game' && <NavRail active={navTab} onNavigate={handleNavigate} />}
      <main className="app-content">
        {view === 'game' && activeLevel && (
          <GameScreen
            key={activeReviewContext ? activeReviewContext.level.id : activeCustomLevel ? activeCustomLevel.id : activeLevel.id}
            level={activeLevel}
            mode={activeReviewContext ? 'review' : activeCustomLevel ? 'custom' : 'curriculum'}
            reviewContext={activeReviewContext ?? undefined}
            nextLevel={activeReviewContext || activeCustomLevel ? null : getNextLevel(activeLevel)}
            onSelectLevel={() => {
              setActiveReviewContext(null);
              setView('levelselect');
            }}
            onNextLevel={handleNextLevel}
            onComplete={handleComplete}
            customLevel={activeCustomLevel ?? undefined}
            onIncrementPlayCount={incrementPlayCount}
            onWordBook={() => setView('wordbook')}
            onAddWordCard={handleAddWordCard}
            onRecordPracticeEvent={recordPracticeEvent}
            savedWordCards={saveData.wordCards}
            practiceByLevel={saveData.practiceByLevel}
            getCharacter={getCharacter}
          />
        )}

        {view === 'wordbook' && (
          <WordBookScreen
            levels={levels}
            saveData={saveData}
            customLevels={customLevels}
            onStory={() => setView('story')}
            onDeleteCard={deleteWordCard}
          />
        )}

        {view === 'story' && (
          <StoryScreen
            saveData={saveData}
            onAddStory={handleAddStory}
            onDeleteStory={deleteStory}
            getCharacter={getCharacter}
            getRandomScene={getRandomScene}
          />
        )}

        {view === 'levelselect' && (
          <LevelSelectScreen
            levels={levels}
            saveData={saveData}
            customLevels={customLevels}
            onSelectLevel={handleSelectLevel}
            onPlayCustom={handlePlayCustom}
            onSaveCustom={saveCustomLevel}
            onDeleteCustom={deleteCustomLevel}
            getCharacter={getCharacter}
          />
        )}
      </main>

      {isSetupRequired && <ProfileSetupModal onComplete={handleProfileComplete} />}
      <OrientationGate />
    </div>
  );
}
