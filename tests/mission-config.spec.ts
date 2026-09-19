import { expect, test } from '@playwright/test';
import {
  getMissionBeats,
  getMissionConfig,
  MISSION_CONFIG,
} from '@/lib/missionConfig';

const curriculumIds = [
  'g2s1u1', 'g2s1u2', 'g2s1u3', 'g2s1u4',
  'g2s1u5', 'g2s1u6', 'g2s1u7', 'g2s1u8',
];

test('defines six unique, labeled beats for all eight curriculum levels', () => {
  expect(Object.keys(MISSION_CONFIG).sort()).toEqual([...curriculumIds].sort());

  for (const id of curriculumIds) {
    const beats = MISSION_CONFIG[id].beats;
    expect(beats).toHaveLength(6);
    expect(new Set(beats.map(beat => beat.key)).size).toBe(6);
    expect(new Set(beats.map(beat => beat.label)).size).toBe(6);
    expect(beats.every(beat => beat.label.trim().length > 0)).toBe(true);
  }
});

test('returns exactly the requested count for a six-beat built-in round', () => {
  const config = getMissionConfig('g2s1u1', '帮团团唤醒春天');
  const beats = getMissionBeats(config, 6);

  expect(beats).toHaveLength(6);
  expect(beats.map(beat => beat.label)).toEqual([
    '阳光', '云朵', '绿叶', '花朵', '小溪', '蝴蝶',
  ]);
});

test('creates the requested number of generic beats for a custom round', () => {
  const config = getMissionConfig('custom-level-42', '我的词语乐园');
  const beats = getMissionBeats(config, 8);

  expect(beats).toHaveLength(8);
  expect(beats.map(beat => beat.label)).toEqual(
    Array.from({ length: 8 }, (_, index) => `词语星光 ${index + 1}`),
  );
  expect(new Set(beats.map(beat => beat.key)).size).toBe(8);
});

test('treats inherited object names as custom IDs and preserves the supplied title', () => {
  const config = getMissionConfig('toString', '自定义关卡');

  expect(config.title).toBe('自定义关卡');
  expect(config.isCustom).toBe(true);
  expect(getMissionBeats(config, 2).map(beat => beat.label)).toEqual([
    '词语星光 1', '词语星光 2',
  ]);
});

test('fills an oversized built-in round with numbered generic beats', () => {
  const config = getMissionConfig('g2s1u1', '帮团团唤醒春天');
  const beats = getMissionBeats(config, 8);

  expect(beats).toHaveLength(8);
  expect(beats.slice(0, 6).map(beat => beat.label)).toEqual([
    '阳光', '云朵', '绿叶', '花朵', '小溪', '蝴蝶',
  ]);
  expect(beats.slice(6).map(beat => beat.label)).toEqual(['词语星光 1', '词语星光 2']);
});
