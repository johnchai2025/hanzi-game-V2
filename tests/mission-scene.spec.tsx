import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Playwright gives TSX files its own JSX runtime for browser-test markup. Restore
// React's runtime before loading the component so server rendering stays real React.
// eslint-disable-next-line @typescript-eslint/no-require-imports
Object.assign(require('playwright/jsx-runtime'), require('react/jsx-runtime'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MissionScene } = require('@/components/MissionScene') as typeof import('@/components/MissionScene');
type MissionSceneProps = Parameters<typeof MissionScene>[0];

const character = { animal: '小狐狸', emoji: '🦊', name: '团团' };

function renderMission(restoredCount: number, overrides: Partial<MissionSceneProps> = {}) {
  return renderToStaticMarkup(createElement(MissionScene, {
    levelId: 'g2s1u1',
    levelTitle: '不应覆盖课程任务',
    restoredCount,
    totalCount: 6,
    character,
    ...overrides,
  }));
}

function restoredBeatCount(markup: string) {
  return (markup.match(/data-restored="true"/g) ?? []).length;
}

test('renders the built-in mission at zero progress with accessible waiting beats', () => {
  const markup = renderMission(0);

  expect(restoredBeatCount(markup)).toBe(0);
  expect(markup).toContain('帮团团唤醒春天');
  expect(markup).toContain('团团和你一起，把春天一点点唤醒吧！');
  expect(markup).toContain('0 / 6');
  for (const label of ['阳光', '云朵', '绿叶', '花朵', '小溪', '蝴蝶']) {
    expect(markup).toContain(`aria-label="${label}：等待恢复"`);
    expect(markup).toContain(`>${label}</span>`);
  }
  expect(markup).not.toContain('class="mission-complete"');
});

test('derives the built-in restored beats strictly from the supplied count', () => {
  const markup = renderMission(3);

  expect(restoredBeatCount(markup)).toBe(3);
  expect(markup).toContain('3 / 6');
  for (const label of ['阳光', '云朵', '绿叶']) {
    expect(markup).toContain(`aria-label="${label}：已恢复"`);
  }
  for (const label of ['花朵', '小溪', '蝴蝶']) {
    expect(markup).toContain(`aria-label="${label}：等待恢复"`);
  }
});

test('announces completion when every built-in beat is restored', () => {
  const markup = renderMission(6);

  expect(restoredBeatCount(markup)).toBe(6);
  expect(markup).toContain('6 / 6');
  expect(markup).toContain('role="status"');
  expect(markup).toContain('春天已经醒来啦！团团和你完成了任务！');
});

function renderCustomMission(restoredCount: number) {
  return renderMission(restoredCount, {
    levelId: 'custom-autumn-words',
    levelTitle: '我的词语乐园',
    totalCount: 8,
  });
}

test('renders all eight custom beats at zero progress using its supplied mission copy', () => {
  const markup = renderCustomMission(0);

  expect(restoredBeatCount(markup)).toBe(0);
  expect(markup).toContain('我的词语乐园');
  expect(markup).toContain('团团和你一起，把词语星光一颗颗点亮吧！');
  expect(markup).toContain('0 / 8');
  for (let index = 1; index <= 8; index += 1) {
    expect(markup).toContain(`aria-label="词语星光 ${index}：等待恢复"`);
  }
});

test('keeps the seventh custom beat pending until its matching restored count', () => {
  const markup = renderCustomMission(7);

  expect(restoredBeatCount(markup)).toBe(7);
  expect(markup).toContain('7 / 8');
  expect(markup).toContain('aria-label="词语星光 7：已恢复"');
  expect(markup).toContain('aria-label="词语星光 8：等待恢复"');
  expect(markup).not.toContain('class="mission-complete"');
});

test('announces completion after the eighth custom beat', () => {
  const markup = renderCustomMission(8);

  expect(restoredBeatCount(markup)).toBe(8);
  expect(markup).toContain('8 / 8');
  expect(markup).toContain('词语星光都收集好啦！团团和你完成了任务！');
});
