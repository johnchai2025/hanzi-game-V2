'use client';

import { useCallback, useState } from 'react';
import type { Story, WordCard, AnimalCharacter } from '@/types';
import { STORY_CARD_MINIMUM } from '@/types';

interface UseStoryOptions {
  onStoryGenerated: (story: Story) => void;
  getCharacter: () => AnimalCharacter;
  getRandomScene: () => string;
}

async function callStoryAPI(words: string[], animal: string, characterName: string, scene: string): Promise<{ content: string; isFallback: boolean }> {
  const response = await fetch('/api/generate-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words, animal, characterName, scene }),
  });
  if (!response.ok) throw new Error('故事生成失败');
  const data = await response.json();
  return { content: data.story as string, isFallback: Boolean(data.fallback) };
}

export function useStory({ onStoryGenerated, getCharacter, getRandomScene }: UseStoryOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateStoryFromCards = useCallback(async (selectedCards: WordCard[]) => {
    if (selectedCards.length < STORY_CARD_MINIMUM) {
      setError(`至少需要${STORY_CARD_MINIMUM}个词才能编故事`);
      return null;
    }

    const words = selectedCards.map(card => card.word);
    const character = getCharacter();
    const scene = getRandomScene();

    setIsGenerating(true);
    setError(null);

    try {
      const { content: rawContent, isFallback } = await callStoryAPI(words, character.animal, character.name, scene);
      if (isFallback) console.warn('[Story] Gemini failed, using fallback template');

      // 解析第一行《标题》
      const lines = rawContent.split('\n');
      const titleMatch = lines[0]?.trim().match(/^《(.+)》$/);
      const title = titleMatch ? titleMatch[1] : undefined;
      const rawBody = titleMatch ? lines.slice(1).join('\n').trim() : rawContent;
      const content = rawBody.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');

      const story: Story = {
        id: `story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        words,
        wordCards: selectedCards.map(card => card.id),
        content,
        generatedAt: Date.now(),
        animal: character.animal,
        characterName: character.name,
        scene,
      };
      onStoryGenerated(story);
      return story;
    } catch (err) {
      setError(err instanceof Error ? err.message : '故事生成失败');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [getCharacter, getRandomScene, onStoryGenerated]);

  const regenerateStory = useCallback(async (words: string[], animal: string, characterName: string, scene: string) => {
    setIsGenerating(true);
    setError(null);
    try {
      const { content: rawContent, isFallback } = await callStoryAPI(words, animal, characterName, scene);
      if (isFallback) console.warn('[Story] Gemini failed, using fallback template');

      // 解析第一行《标题》
      const lines = rawContent.split('\n');
      const titleMatch = lines[0]?.trim().match(/^《(.+)》$/);
      const title = titleMatch ? titleMatch[1] : undefined;
      const rawBody = titleMatch ? lines.slice(1).join('\n').trim() : rawContent;
      const content = rawBody.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');

      const story: Story = {
        id: `story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        words,
        wordCards: [],
        content,
        generatedAt: Date.now(),
        animal,
        characterName,
        scene,
      };
      onStoryGenerated(story);
      return story;
    } catch (err) {
      setError(err instanceof Error ? err.message : '故事生成失败');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [onStoryGenerated]);

  return { isGenerating, error, generateStoryFromCards, regenerateStory };
}
