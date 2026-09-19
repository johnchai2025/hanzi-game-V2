import { expect, test, type Page } from '@playwright/test';
import curriculum from '@/public/curriculum/grade2_semester1.json';

const PROFILE = {
  childName: '',
  character: { animal: '小狐狸', emoji: '🦊', name: '团团' },
  preferredScenes: [],
  setupCompleted: true,
};

const CUSTOM_EIGHT_PAIR_LEVEL = {
  id: 'custom-eight-beat-layout',
  title: '八颗词语星光',
  pairs: [['苹果'], ['香蕉'], ['天空'], ['月亮'], ['花朵'], ['小鸟'], ['书包'], ['铅笔']]
    .map(([word]) => [word[0], word[1]]),
  createdAt: 1,
  playCount: 0,
};

function boxesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
  tolerance = 1,
) {
  return (
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x) > tolerance
    && Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y) > tolerance
  );
}

async function seed(page: Page, save?: object, tutorialDone = true) {
  await page.addInitScript(({ profile, saved, dismissTutorial }) => {
    localStorage.setItem('hanziGame_profile', JSON.stringify(profile));
    if (saved) localStorage.setItem('hanzi-match-save', JSON.stringify(saved));
    if (dismissTutorial) localStorage.setItem('hanzi-match-tutorial-v1', 'done');
  }, { profile: PROFILE, saved: save, dismissTutorial: tutorialDone });
}

async function enterFirstLevel(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /开始/ }).click();
  await expect(page.locator('.mission-scene')).toBeVisible();
}

async function findVisiblePair(page: Page) {
  const cells = await page.locator('.cell:not(.cell-empty)').evaluateAll(elements =>
    elements.map(element => ({
      id: element.getAttribute('data-cell-id') || '',
      char: element.querySelector('.cell-word')?.textContent || '',
    }))
  );
  const pairs = curriculum.units[0].pairs;
  for (const pair of pairs) {
    const left = cells.find(cell => cell.id.endsWith('-0') && cell.char === pair[0]);
    const right = cells.find(cell => cell.id.endsWith('-1') && cell.char === pair[1]);
    if (left && right) {
      return {
        pair,
        left: page.locator(`[data-cell-id="${left.id}"]`),
        right: page.locator(`[data-cell-id="${right.id}"]`),
      };
    }
  }
  throw new Error(`No visible curriculum pair found in ${cells.map(cell => cell.char).join(',')}`);
}

async function findVisibleCrossColumnMismatch(page: Page) {
  const cells = await page.locator('.cell:not(.cell-empty)').evaluateAll(elements =>
    elements.map(element => ({
      id: element.getAttribute('data-cell-id') || '',
      char: element.querySelector('.cell-word')?.textContent || '',
    }))
  );
  const words = new Set(curriculum.units[0].pairs.map(pair => pair.join('')));
  for (const left of cells.filter(cell => cell.id.endsWith('-0'))) {
    for (const right of cells.filter(cell => cell.id.endsWith('-1'))) {
      if (!words.has(left.char + right.char)) {
        return {
          left: page.locator(`[data-cell-id="${left.id}"]`),
          right: page.locator(`[data-cell-id="${right.id}"]`),
        };
      }
    }
  }
  throw new Error(`No visible cross-column mismatch found in ${cells.map(cell => cell.char).join(',')}`);
}

test('correct matching is immediate, non-blocking, and image-free', async ({ page }) => {
  await seed(page);
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await enterFirstLevel(page);

  const mission = page.locator('.mission-scene');
  await expect(mission).toBeVisible();
  await expect(mission.getByRole('heading', { name: '帮团团唤醒春天' })).toBeVisible();
  await expect(mission.locator('.mission-progress output')).toHaveText('0 / 6');
  await expect(mission.locator('[data-restored="true"]')).toHaveCount(0);

  const mismatch = await findVisibleCrossColumnMismatch(page);
  await mismatch.left.click();
  await mismatch.right.click();
  await expect(mission.locator('.mission-progress output')).toHaveText('0 / 6');
  await expect(mission.locator('[data-restored="true"]')).toHaveCount(0);
  await expect(page.locator('.cell-selected')).toHaveCount(0);

  const { pair, left, right } = await findVisiblePair(page);
  await left.click();
  await right.click();

  await expect(mission.locator('.mission-progress output')).toHaveText('1 / 6');
  await expect(mission.locator('[data-restored="true"]')).toHaveCount(1);
  await expect(page.locator('.pair-success-toast')).toContainText(`${pair[0]}＋${pair[1]}＝${pair.join('')}`);
  await expect(page.locator('.reward-card-modal')).toHaveCount(0);
  expect(requests.some(url => url.includes('/api/generate-image'))).toBe(false);

  const matchedWord = pair.join('');
  await expect.poll(async () => page.evaluate(word => {
    const save = JSON.parse(localStorage.getItem('hanzi-match-save') || '{}');
    return {
      hasCard: save.wordCards?.some((card: { word: string; imageUrl: string }) =>
        card.word === word && card.imageUrl === ''
      ),
      practiced: Boolean(save.practiceByLevel?.g2s1u1?.[word]),
    };
  }, matchedWord)).toEqual({ hasCard: true, practiced: true });
});

test('mission completion waits for the final restored beat before showing its modal', async ({ page }) => {
  await page.clock.install({ time: new Date('2020-01-01T00:00:00Z') });
  await seed(page);
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await enterFirstLevel(page);
  await page.clock.pauseAt(new Date('2020-01-01T00:01:00Z'));

  const mission = page.locator('.mission-scene');
  for (let restored = 1; restored <= 6; restored += 1) {
    const { left, right } = await findVisiblePair(page);
    await left.click();
    await right.click();
    await page.clock.runFor(300);
    await expect(mission.locator('.mission-progress output')).toHaveText(`${restored} / 6`);
  }

  await expect(mission).toHaveAttribute('data-mission-complete', 'true');
  await expect(page.locator('.cmp-modal')).toHaveCount(0);
  await page.clock.runFor(699);
  await expect(page.locator('.cmp-modal')).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(page.locator('.cmp-modal')).toBeVisible({ timeout: 500 });
  expect(requests.some(url => url.includes('/api/generate-image'))).toBe(false);
});

test('mission, board, and controls remain inside the 1024 by 768 game viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await seed(page);
  await enterFirstLevel(page);

  const board = page.locator('.gb-board');
  const boardBox = await board.boundingBox();
  expect(boardBox?.width).toBe(380);

  for (const locator of [
    page.locator('.mission-scene'),
    page.locator('.mission-scene h2'),
    page.locator('.mission-stage'),
    page.locator('.mission-progress output'),
    page.getByRole('button', { name: /找一对给我看/ }),
    page.getByRole('button', { name: /重新摆放/ }),
  ]) {
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1024);
    expect(box!.y + box!.height).toBeLessThanOrEqual(768);
  }
});

test('a custom eight-beat mission fits its supported 300px sidebar without clipped objects', async ({ page }) => {
  await page.setViewportSize({ width: 780, height: 768 });
  await seed(page);
  await page.addInitScript(level => {
    localStorage.setItem('hanzi-match-custom-levels', JSON.stringify([level]));
  }, CUSTOM_EIGHT_PAIR_LEVEL);
  await page.goto('/');
  await page.getByRole('button', { name: /我的字库/ }).click();
  await page.getByRole('button', { name: /开始游戏/ }).click();

  const side = page.locator('.gb-side');
  const stage = page.locator('.mission-stage-beat-count-8');
  await expect(stage).toBeVisible();
  expect((await side.boundingBox())?.width).toBeGreaterThanOrEqual(300);

  const stageBox = await stage.boundingBox();
  expect(stageBox).not.toBeNull();
  const beatBoxes = [];
  for (const beat of await stage.locator('.mission-beat').all()) {
    const beatBox = await beat.boundingBox();
    expect(beatBox).not.toBeNull();
    expect(beatBox!.x).toBeGreaterThanOrEqual(stageBox!.x);
    expect(beatBox!.y).toBeGreaterThanOrEqual(stageBox!.y);
    expect(beatBox!.x + beatBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width);
    expect(beatBox!.y + beatBox!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height);
    beatBoxes.push(beatBox!);
  }

  for (let index = 0; index < beatBoxes.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < beatBoxes.length; otherIndex += 1) {
      expect(boxesOverlap(beatBoxes[index], beatBoxes[otherIndex])).toBe(false);
    }
  }

  const mascotBox = await stage.locator('.mission-mascot').boundingBox();
  expect(mascotBox).not.toBeNull();
  for (const beatBox of beatBoxes) {
    expect(boxesOverlap(beatBox, mascotBox!)).toBe(false);
  }
});

test('tutorial explains the real rule once', async ({ page }) => {
  await seed(page, undefined, false);
  await enterFirstLevel(page);
  await expect(page.getByRole('heading', { name: '给汉字找伙伴' })).toBeVisible();
  await expect(page.getByText(/先点左边一个字/)).toBeVisible();
  await expect(page.getByText(/长按汉字可以查看拼音/)).toBeVisible();
  await page.getByRole('button', { name: /我会啦/ }).click();
  await page.getByRole('button', { name: /选关/ }).click();
  await page.getByRole('button', { name: /开始/ }).click();
  await expect(page.getByRole('heading', { name: '给汉字找伙伴' })).toHaveCount(0);
});

test('same-column selections do not eliminate cells', async ({ page }) => {
  await seed(page);
  await enterFirstLevel(page);
  const leftCells = page.locator('.cell-word').filter({ visible: true });
  await leftCells.nth(0).click();
  await leftCells.nth(2).click();
  await expect(page.getByText('要从另一边找词语伙伴哦～')).toBeVisible();
  await expect(page.getByText('0 / 6')).toBeVisible();
  await expect(page.locator('.cell:not(.cell-empty)')).toHaveCount(12);
});

test('replay selection prioritizes words absent from per-level practice', async ({ page }) => {
  const practicedPairs = curriculum.units[0].pairs.slice(0, 6);
  const practice = Object.fromEntries(practicedPairs.map(pair => [pair.join(''), {
    correctCount: 1,
    lastPracticedAt: 1,
  }]));
  await seed(page, {
    unlockedLevels: ['g2s1u1'],
    completedLevels: [],
    wordCards: [],
    stories: [],
    practiceByLevel: { g2s1u1: practice },
    levelStars: {},
  });
  await enterFirstLevel(page);

  const visibleChars = await page.locator('.cell-word').allTextContents();
  for (const pair of practicedPairs) {
    const hasLeft = visibleChars.some((char, index) => index % 2 === 0 && char === pair[0]);
    const hasRight = visibleChars.some((char, index) => index % 2 === 1 && char === pair[1]);
    expect(hasLeft && hasRight).toBe(false);
  }
});

test('word book reports only words actually practiced', async ({ page }) => {
  await seed(page, {
    unlockedLevels: ['g2s1u1'],
    completedLevels: ['g2s1u1'],
    wordCards: [{ id: 'card-洗手', word: '洗手', chars: ['洗', '手'], imageUrl: '', generatedAt: 1 }],
    stories: [],
    practiceByLevel: { g2s1u1: { 洗手: { correctCount: 1, lastPracticedAt: 1 } } },
    levelStars: { g2s1u1: 2 },
  });
  await page.goto('/');
  await page.getByRole('button', { name: /词卡库/ }).click();
  await page.getByRole('button', { name: /词语本/ }).click();
  await expect(page.getByText('已练习的词语')).toBeVisible();
  await expect(page.getByText('已练习 1 / 20')).toBeVisible();
  await expect(page.getByText('洗手', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /宝藏图鉴/ }).click();
  await page.getByText('洗手', { exact: true }).first().click();
  await expect(page.getByRole('button', { name: /换一张图/ })).toHaveCount(0);
});
