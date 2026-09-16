'use client';

import { useState, useCallback } from 'react';
import type { UserProfile, AnimalCharacter } from '@/types';
import { AVAILABLE_SCENES } from '@/types';

const PROFILE_KEY = 'hanziGame_profile';

const FOX_ANIMAL = '小狐狸';
const defaultCharacter: AnimalCharacter = { animal: FOX_ANIMAL, emoji: '🦊', name: FOX_ANIMAL };

const defaultProfile: UserProfile = {
  childName: '',
  character: defaultCharacter,
  preferredScenes: [],
  setupCompleted: false,
};

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile>(() => {
    if (typeof window === 'undefined') return defaultProfile;
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged: UserProfile = { ...defaultProfile, ...parsed };
        // 角色收敛为狐狸单选之后，老档案里可能还存着别的动物（如"小兔子"）——
        // 强制迁移成狐狸，并让向导重新弹出来，请孩子给狐狸重新起个名字
        // （用户明确要求这么处理，而不是静默继承旧名字）。
        if (merged.character?.animal !== FOX_ANIMAL) {
          return { ...merged, character: defaultCharacter, setupCompleted: false };
        }
        return merged;
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
    return defaultProfile;
  });

  const saveProfile = useCallback((newProfile: UserProfile) => {
    setProfile(newProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
    }
  }, []);

  const isSetupRequired = !profile.setupCompleted;

  const getCharacter = useCallback((): AnimalCharacter => {
    return profile.character ?? defaultCharacter;
  }, [profile.character]);

  // 场景现在只服务于故事生成（生图已经不再传场景），直接从全部场景里随机挑一个，
  // 不再依赖向导里勾选的"偏好场景"——向导已经不收集这个了。
  const getRandomScene = useCallback(() => {
    return AVAILABLE_SCENES[Math.floor(Math.random() * AVAILABLE_SCENES.length)].name;
  }, []);

  return {
    profile,
    saveProfile,
    isSetupRequired,
    isLoaded: true,
    getCharacter,
    getRandomScene,
  };
}
