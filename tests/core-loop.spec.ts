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

async function seed(page: Page, save?: object, tutorialDone = true, customLevels?: object[]) {
  await page.addInitScript(({ profile, saved, dismissTutorial, custom }) => {
    localStorage.setItem('hanziGame_profile', JSON.stringify(profile));
    if (saved) localStorage.setItem('hanzi-match-save', JSON.stringify(saved));
    if (custom) localStorage.setItem('hanzi-match-custom-levels', JSON.stringify(custom));
    if (dismissTutorial) localStorage.setItem('hanzi-match-tutorial-v1', 'done');
  }, { profile: PROFILE, saved: save, dismissTutorial: tutorialDone, custom: customLevels });
}

async function enterFirstLevel(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '开始 →', exact: true }).click();
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
  const intendedWord = (char: string, side: 0 | 1) => {
    const matches = curriculum.units[0].pairs.filter(pair => pair[side] === char);
    return matches.length === 1 ? matches[0].join('') : null;
  };
  for (const left of cells.filter(cell => cell.id.endsWith('-0'))) {
    for (const right of cells.filter(cell => cell.id.endsWith('-1'))) {
      const leftWord = intendedWord(left.char, 0);
      const rightWord = intendedWord(right.char, 1);
      if (!words.has(left.char + right.char) && leftWord && rightWord) {
        return {
          left: page.locator(`[data-cell-id="${left.id}"]`),
          right: page.locator(`[data-cell-id="${right.id}"]`),
          intendedWords: [...new Set([leftWord, rightWord])],
        };
      }
    }
  }
  throw new Error(`No visible cross-column mismatch found in ${cells.map(cell => cell.char).join(',')}`);
}

async function completeVisibleRound(page: Page) {
  const total = await page.locator('.mission-progress output').evaluate(element =>
    Number(element.textContent?.split('/')[1]?.trim() || 0));
  for (let restored = 1; restored <= total; restored += 1) {
    const { left, right } = await findVisiblePair(page);
    await left.click();
    await right.click();
    await page.clock.runFor(300);
  }
}

async function completeReviewRound(page: Page) {
  const total = await page.locator('.mission-progress output').evaluate(element =>
    Number(element.textContent?.split('/')[1]?.trim() || 0));
  for (let restored = 1; restored <= total; restored += 1) {
    const { left, right } = await findVisiblePair(page);
    const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
    if (!leftBox || !rightBox) throw new Error('Review pair is not visible');
    await page.mouse.click(leftBox.x + leftBox.width / 2, leftBox.y + leftBox.height / 2);
    await page.mouse.click(rightBox.x + rightBox.width / 2, rightBox.y + rightBox.height / 2);
    await page.waitForTimeout(320);
  }
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
  const matchedWord = pair.join('');
  await left.click();
  await right.click();

  await expect(mission.locator('.mission-progress output')).toHaveText('1 / 6');
  await expect(mission.locator('[data-restored="true"]')).toHaveCount(1);
  await expect(page.locator('.pair-success-toast')).toContainText(`${pair[0]}＋${pair[1]}＝${pair.join('')}`);
  await expect(page.locator('.reward-card-modal')).toHaveCount(0);
  expect(requests.some(url => url.includes('/api/generate-image'))).toBe(false);

  await expect.poll(async () => page.evaluate(word => {
    const save = JSON.parse(localStorage.getItem('hanzi-match-save') || '{}');
    return {
      hasCard: save.wordCards?.some((card: { word: string; imageUrl: string }) =>
        card.word === word && card.imageUrl === ''
      ),
      practice: save.practiceByLevel?.g2s1u1?.[word],
    };
  }, matchedWord)).toMatchObject({
    hasCard: true,
    practice: { correctCount: 1, wrongCount: expect.any(Number), hintCount: 0, correctStreak: 1 },
  });
});

test('cross-column mismatch records each intended word once and restart does not repeat it', async ({ page }) => {
  const priorPractice = Object.fromEntries(curriculum.units[0].pairs.map(pair => [pair.join(''), {
    correctCount: 2,
    wrongCount: 0,
    hintCount: 0,
    correctStreak: 2,
    lastPracticedAt: 1,
  }]));
  await seed(page, {
    unlockedLevels: ['g2s1u1'],
    completedLevels: [],
    wordCards: [],
    stories: [],
    practiceByLevel: { g2s1u1: priorPractice },
    levelStars: {},
  });
  await enterFirstLevel(page);
  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    (window as typeof window & { __practiceSaveWrites?: number }).__practiceSaveWrites = 0;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === 'hanzi-match-save') {
        const counterWindow = window as typeof window & { __practiceSaveWrites?: number };
        counterWindow.__practiceSaveWrites = (counterWindow.__practiceSaveWrites || 0) + 1;
      }
      return originalSetItem.call(this, key, value);
    };
  });

  const mismatch = await findVisibleCrossColumnMismatch(page);
  await mismatch.left.click();
  await mismatch.right.click();

  await expect.poll(async () => page.evaluate(words => {
    const save = JSON.parse(localStorage.getItem('hanzi-match-save') || '{}');
    return words.map(word => save.practiceByLevel?.g2s1u1?.[word]);
  }, mismatch.intendedWords)).toEqual(mismatch.intendedWords.map(() => ({
    correctCount: 2,
    wrongCount: 1,
    hintCount: 0,
    correctStreak: 0,
    lastPracticedAt: expect.any(Number),
  })));

  await page.getByRole('button', { name: /重新摆放/ }).click();
  await page.waitForTimeout(100);
  const counts = await page.evaluate(words => {
    const save = JSON.parse(localStorage.getItem('hanzi-match-save') || '{}');
    return words.map(word => save.practiceByLevel.g2s1u1[word].wrongCount);
  }, mismatch.intendedWords);
  expect(counts).toEqual(mismatch.intendedWords.map(() => 1));
  expect(await page.evaluate(() => (
    window as typeof window & { __practiceSaveWrites?: number }
  ).__practiceSaveWrites)).toBe(1);
});

test('restart cancels a pending mismatch reset before it can clear a fresh selection', async ({ page }) => {
  await seed(page);
  await enterFirstLevel(page);

  const mismatch = await findVisibleCrossColumnMismatch(page);
  await mismatch.left.click();
  await mismatch.right.click();
  await page.getByRole('button', { name: /重新摆放/ }).click();
  await page.locator('.cell:not(.cell-empty)[data-cell-id$="-0"]').first().click();

  await page.waitForTimeout(450);
  await expect(page.locator('.cell-selected')).toHaveCount(1);
  await expect(page.locator('.cell:not(.cell-empty)')).toHaveCount(12);
  await expect(page.locator('.mission-progress output')).toHaveText('0 / 6');
});

test('restart cancels a pending elimination before it can mutate the fresh board', async ({ page }) => {
  await seed(page);
  await enterFirstLevel(page);

  const pair = await findVisiblePair(page);
  await pair.left.click();
  await pair.right.click();
  await page.getByRole('button', { name: /重新摆放/ }).click();
  await page.locator('.cell:not(.cell-empty)[data-cell-id$="-0"]').first().click();

  await page.waitForTimeout(350);
  await expect(page.locator('.cell-selected')).toHaveCount(1);
  await expect(page.locator('.cell:not(.cell-empty)')).toHaveCount(12);
  await expect(page.locator('.mission-progress output')).toHaveText('0 / 6');
});

test('hint records exactly the revealed word once and never creates a word card', async ({ page }) => {
  await seed(page);
  await enterFirstLevel(page);

  await page.getByRole('button', { name: /找一对给我看/ }).click();
  await expect(page.locator('.cell-hinted')).toHaveCount(2);
  const chars = await page.locator('.cell-hinted .cell-word').allTextContents();
  const forward = chars.join('');
  const backward = [...chars].reverse().join('');
  const revealedWord = curriculum.units[0].pairs.some(pair => pair.join('') === forward)
    ? forward
    : backward;

  await expect.poll(async () => page.evaluate(word => {
    const save = JSON.parse(localStorage.getItem('hanzi-match-save') || '{}');
    return {
      practice: save.practiceByLevel?.g2s1u1?.[word],
      cardCount: save.wordCards?.filter((card: { word: string }) => card.word === word).length || 0,
    };
  }, revealedWord)).toMatchObject({
    practice: { correctCount: 0, wrongCount: 0, hintCount: 1, correctStreak: 0 },
    cardCount: 0,
  });

  await page.getByRole('button', { name: /重新摆放/ }).click();
  await expect.poll(async () => page.evaluate(word => {
    const save = JSON.parse(localStorage.getItem('hanzi-match-save') || '{}');
    return save.practiceByLevel.g2s1u1[word].hintCount;
  }, revealedWord)).toBe(1);
});

test('custom rounds write learning events under the custom level id', async ({ page }) => {
  await seed(page);
  await page.addInitScript(level => {
    localStorage.setItem('hanzi-match-custom-levels', JSON.stringify([level]));
  }, CUSTOM_EIGHT_PAIR_LEVEL);
  await page.goto('/');
  await page.getByRole('button', { name: /我的字库/ }).click();
  await page.getByRole('button', { name: /开始游戏/ }).click();

  await page.locator('.cell-word', { hasText: '苹' }).click();
  await page.locator('.cell-word', { hasText: '果' }).click();
  await expect.poll(async () => page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('hanzi-match-save') || '{}');
    return save.practiceByLevel?.['custom-eight-beat-layout']?.苹果;
  })).toMatchObject({ correctCount: 1, wrongCount: 0, hintCount: 0, correctStreak: 1 });
  expect(await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('hanzi-match-save') || '{}');
    return save.practiceByLevel?.g2s1u1?.苹果;
  })).toBeUndefined();
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
  await expect(page.locator('.cmp-learning-summary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下一关 →' })).toBeVisible();
  expect(requests.some(url => url.includes('/api/generate-image'))).toBe(false);
});

test('restart at 650ms cancels the old 700ms completion modal', async ({ page }) => {
  await page.clock.install({ time: new Date('2020-01-01T00:00:00Z') });
  await seed(page);
  await enterFirstLevel(page);
  await page.clock.pauseAt(new Date('2020-01-01T00:01:00Z'));
  await completeVisibleRound(page);

  await page.clock.runFor(650);
  await page.getByRole('button', { name: /重新摆放/ }).click();
  await page.clock.runFor(100);
  await expect(page.locator('.cmp-modal')).toHaveCount(0);
  await expect(page.locator('.mission-progress output')).toHaveText('0 / 6');
});

test('leaving a completed round cancels its pending modal', async ({ page }) => {
  await page.clock.install({ time: new Date('2020-01-01T00:00:00Z') });
  await seed(page);
  await enterFirstLevel(page);
  await page.clock.pauseAt(new Date('2020-01-01T00:01:00Z'));
  await completeVisibleRound(page);

  await page.clock.runFor(650);
  await page.getByRole('button', { name: /选关/ }).click();
  await page.clock.runFor(100);
  await expect(page.locator('.cmp-modal')).toHaveCount(0);
  await expect(page.locator('.map-main')).toBeVisible();
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

test('a built-in six-beat mission fits its supported 300px sidebar without collisions', async ({ page }) => {
  await page.setViewportSize({ width: 780, height: 768 });
  await seed(page);
  await enterFirstLevel(page);

  const side = page.locator('.gb-side');
  const stage = page.locator('.mission-stage-beat-count-6');
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
      expect(
        boxesOverlap(beatBoxes[index], beatBoxes[otherIndex]),
        `beats ${index + 1} and ${otherIndex + 1} overlap: ${JSON.stringify([beatBoxes[index], beatBoxes[otherIndex]])}`,
      ).toBe(false);
    }
  }

  const mascotBox = await stage.locator('.mission-mascot').boundingBox();
  expect(mascotBox).not.toBeNull();
  for (const beatBox of beatBoxes) {
    expect(boxesOverlap(beatBox, mascotBox!)).toBe(false);
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
  await page.getByRole('button', { name: '开始 →', exact: true }).click();
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
  expect(await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('hanzi-match-save') || '{}');
    return save.practiceByLevel?.g2s1u1 || {};
  })).toEqual({});

  await page.waitForTimeout(400);
  for (let matched = 0; matched < 6; matched += 1) {
    const { left, right } = await findVisiblePair(page);
    await left.click();
    await right.click();
    await page.waitForTimeout(310);
  }
  await expect(page.locator('.cmp-modal')).toBeVisible();
  await expect(page.locator('.cmp-stars')).toHaveAttribute('aria-label', '获得3颗星');
});

test('normal selection reserves half of a six-pair round for unseen words', async ({ page }) => {
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
  const unseenVisible = curriculum.units[0].pairs.slice(6).filter(pair => {
    const hasLeft = visibleChars.some((char, index) => index % 2 === 0 && char === pair[0]);
    const hasRight = visibleChars.some((char, index) => index % 2 === 1 && char === pair[1]);
    return hasLeft && hasRight;
  });
  expect(unseenVisible.length).toBeGreaterThanOrEqual(3);
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

test('word book learning filters count and show only actually practiced words', async ({ page }) => {
  await seed(page, {
    unlockedLevels: ['g2s1u1'],
    completedLevels: [],
    wordCards: [],
    stories: [],
    practiceByLevel: {
      g2s1u1: {
        洗手: reviewPractice({ correctStreak: 0 }),
        开门: reviewPractice({ correctStreak: 2 }),
        写字: reviewPractice({ correctStreak: 3 }),
        读书: { correctCount: 0, wrongCount: 0, hintCount: 0, correctStreak: 3, lastPracticedAt: 0 },
      },
      'removed-source': { 星光: reviewPractice({ correctStreak: 1 }) },
    },
    levelStars: {},
  });
  await page.goto('/');
  await page.getByRole('button', { name: /词卡库/ }).click();
  await page.getByRole('button', { name: /词语本/ }).click();

  const filters = page.getByRole('group', { name: '按学习状态筛选' });
  await expect(filters.getByRole('button', { name: /全部练过.*4/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(filters.getByRole('button', { name: /待巩固.*3/ })).toBeVisible();
  await expect(filters.getByRole('button', { name: /已经熟悉.*1/ })).toBeVisible();
  await expect(page.locator('.wordbook-sections').getByText('读书', { exact: true })).toHaveCount(0);
  await expect(page.locator('.wordbook-sections').getByText('星光', { exact: true })).toBeVisible();

  await filters.getByRole('button', { name: /待巩固/ }).click();
  await expect(filters.getByRole('button', { name: /待巩固/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.wordbook-sections').getByText('洗手', { exact: true })).toBeVisible();
  await expect(page.locator('.wordbook-sections').getByText('开门', { exact: true })).toBeVisible();
  await expect(page.locator('.wordbook-sections').getByText('写字', { exact: true })).toHaveCount(0);

  await filters.getByRole('button', { name: /已经熟悉/ }).click();
  await expect(page.locator('.wordbook-sections').getByText('写字', { exact: true })).toBeVisible();
  await expect(page.locator('.wordbook-sections').getByText('洗手', { exact: true })).toHaveCount(0);
});

test('word book filters use encouraging empty states', async ({ page }) => {
  await seed(page, {
    unlockedLevels: ['g2s1u1'], completedLevels: [], wordCards: [], stories: [],
    practiceByLevel: { g2s1u1: { 洗手: reviewPractice({ correctStreak: 1 }) } }, levelStars: {},
  });
  await page.goto('/');
  await page.getByRole('button', { name: /词卡库/ }).click();
  await page.getByRole('button', { name: /词语本/ }).click();
  await page.getByRole('button', { name: /已经熟悉/ }).click();
  await expect(page.getByRole('status')).toHaveText('再多练几次，熟悉的词语就会来到这里～');
});

test('word book uses one canonical status for a duplicate word across sources', async ({ page }) => {
  const duplicateCustomLevel = {
    id: 'custom-duplicate-source', title: '重复词来源', pairs: [['洗', '手']], createdAt: 1, playCount: 0,
  };
  await seed(page, {
    unlockedLevels: ['g2s1u1'], completedLevels: [], wordCards: [], stories: [],
    practiceByLevel: {
      g2s1u1: { 洗手: reviewPractice({ correctStreak: 1 }) },
      'custom-duplicate-source': { 洗手: reviewPractice({ correctStreak: 3 }) },
    },
    levelStars: {},
  }, true, [duplicateCustomLevel]);
  await page.goto('/');
  await page.getByRole('button', { name: /词卡库/ }).click();
  await page.getByRole('button', { name: /词语本/ }).click();

  const filters = page.getByRole('group', { name: '按学习状态筛选' });
  await expect(filters.getByRole('button', { name: /全部练过.*1/ })).toBeVisible();
  await expect(filters.getByRole('button', { name: /待巩固.*0/ })).toBeVisible();
  await expect(filters.getByRole('button', { name: /已经熟悉.*1/ })).toBeVisible();
  await expect(page.locator('.wordbook-sections').getByText('洗手', { exact: true })).toHaveCount(1);
  await expect(page.getByText('重复词来源', { exact: true })).toBeVisible();

  await filters.getByRole('button', { name: /待巩固/ }).click();
  await expect(page.getByRole('status')).toHaveText('现在没有需要巩固的词语，保持得真棒！');
  await expect(page.locator('.wordbook-sections').getByText('洗手', { exact: true })).toHaveCount(0);

  await filters.getByRole('button', { name: /已经熟悉/ }).click();
  await expect(filters.getByRole('button', { name: /已经熟悉/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('.wordbook-sections').getByText('洗手', { exact: true })).toHaveCount(1);
});

function reviewPractice(overrides: Partial<{
  correctCount: number;
  wrongCount: number;
  hintCount: number;
  correctStreak: number;
  lastPracticedAt: number;
}> = {}) {
  return {
    correctCount: 1,
    wrongCount: 0,
    hintCount: 0,
    correctStreak: 1,
    lastPracticedAt: Date.now(),
    ...overrides,
  };
}

test('bottom review dock shows real count, stays accessible, and preserves the map at iPad landscape size', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const words = curriculum.units[0].pairs.slice(0, 4).map(pair => pair.join(''));
  await seed(page, {
    unlockedLevels: ['g2s1u1'],
    completedLevels: [],
    wordCards: [],
    stories: [],
    practiceByLevel: { g2s1u1: Object.fromEntries(words.map(word => [word, reviewPractice()])) },
    levelStars: {},
  });
  await page.goto('/');

  const dock = page.locator('.review-entry');
  const trail = page.locator('.trail-scroll');
  const start = page.getByRole('button', { name: '开始今日复习，共 4 个词' });
  await expect(dock).toContainText('4 个词');
  await expect(dock).toContainText('约 2–3 分钟');
  await expect(start).toBeEnabled();
  await expect(page.getByRole('button', { name: '我的字库' })).toBeVisible();
  const [trailBox, dockBox] = await Promise.all([trail.boundingBox(), dock.boundingBox()]);
  expect(trailBox?.height).toBeGreaterThan(dockBox?.height || 0);
  expect(await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > window.innerWidth,
    vertical: document.documentElement.scrollHeight > window.innerHeight,
  }))).toEqual({ horizontal: false, vertical: false });

  await start.focus();
  await expect(start).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('今日复习', { exact: true }).first()).toBeVisible();
});

test('empty review dock explains how to unlock review and cannot start a round', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await seed(page, {
    unlockedLevels: ['g2s1u1'],
    completedLevels: [],
    wordCards: [],
    stories: [],
    practiceByLevel: {},
    levelStars: {},
  });
  await page.goto('/');

  await expect(page.getByText('再玩一关，就能开始复习')).toBeVisible();
  const disabled = page.getByRole('button', { name: '今日复习暂不可用' });
  await expect(disabled).toBeDisabled();
  await disabled.click({ force: true });
  await expect(page.locator('.gb')).toHaveCount(0);
});

test('visible review flow routes duplicate, wrong, hint, and correct events without curriculum side effects', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const pairs = curriculum.units[0].pairs.slice(0, 6);
  const words = pairs.map(pair => pair.join(''));
  const duplicateWord = words[0];
  const losingPractice = reviewPractice({ correctCount: 2, correctStreak: 1 });
  const winningPractice = reviewPractice({ correctCount: 0, wrongCount: 5, correctStreak: 0 });
  const curriculumState = {
    unlockedLevels: ['g2s1u1', 'g2s1u2'],
    completedLevels: ['g2s1u1'],
    levelStars: { g2s1u1: 2 },
  };
  const customLevels = [{
    id: 'custom-review-winner',
    title: '复习来源',
    pairs: [pairs[0]],
    createdAt: 1,
    playCount: 7,
  }];
  await seed(page, {
    ...curriculumState,
    wordCards: [],
    stories: [],
    practiceByLevel: {
      g2s1u1: Object.fromEntries(words.map(word => [word, word === duplicateWord ? losingPractice : reviewPractice()])),
      'custom-review-winner': { [duplicateWord]: winningPractice },
    },
  }, true, customLevels);
  await page.goto('/');
  await page.getByRole('button', { name: '开始今日复习，共 6 个词' }).click();
  await expect(page.locator('.cell:not(.cell-empty)')).toHaveCount(12);

  const duplicateLeft = page.locator('.cell:not(.cell-empty)[data-cell-id$="-0"]', { hasText: pairs[0][0] });
  const wrongRight = page.locator('.cell:not(.cell-empty)[data-cell-id$="-1"]')
    .filter({ hasNotText: pairs[0][1] }).first();
  await duplicateLeft.click();
  await wrongRight.click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /找一对给我看/ }).click();
  await expect(page.locator('.cell-hinted')).toHaveCount(2);
  await page.getByRole('button', { name: /重新摆放/ }).click();
  await expect(page.locator('.cell-selected')).toHaveCount(0);
  await expect(page.locator('.cell:not(.cell-empty)')).toHaveCount(12);

  await completeReviewRound(page);
  await expect(page.locator('.cmp-modal')).toBeVisible();
  await expect(page.locator('.cmp-learning-summary')).toContainText('本轮练习 6 个词');
  await expect(page.locator('.cmp-learning-summary')).toContainText('下次再见');
  await expect(page.locator('.cmp-learning-summary')).not.toContainText('更熟悉');

  await expect.poll(async () => page.evaluate(({ duplicate, originalCurriculum, originalCustom }) => {
    const save = JSON.parse(localStorage.getItem('hanzi-match-save') || '{}');
    const custom = JSON.parse(localStorage.getItem('hanzi-match-custom-levels') || '[]');
    const curriculum = {
      unlockedLevels: save.unlockedLevels,
      completedLevels: save.completedLevels,
      levelStars: save.levelStars,
    };
    const customPlayCounts = custom.map((item: { id: string; playCount: number }) => ({
      id: item.id,
      playCount: item.playCount,
    }));
    return {
      winner: save.practiceByLevel?.['custom-review-winner']?.[duplicate],
      loser: save.practiceByLevel?.g2s1u1?.[duplicate],
      curriculumUnchanged: JSON.stringify(curriculum) === JSON.stringify(originalCurriculum),
      customPlayCountsUnchanged: JSON.stringify(customPlayCounts) === JSON.stringify(originalCustom),
    };
  }, {
    duplicate: duplicateWord,
    originalCurriculum: curriculumState,
    originalCustom: customLevels.map(item => ({ id: item.id, playCount: item.playCount })),
  })).toMatchObject({
    winner: { correctCount: 1, wrongCount: 6, correctStreak: 1 },
    loser: losingPractice,
    curriculumUnchanged: true,
    customPlayCountsUnchanged: true,
  });
});

test('two-candidate review uses exactly four cells, a two-beat scene, and positive summary rows', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const words = curriculum.units[0].pairs.slice(0, 2).map(pair => pair.join(''));
  await seed(page, {
    unlockedLevels: ['g2s1u1'],
    completedLevels: [],
    wordCards: [],
    stories: [],
    practiceByLevel: { g2s1u1: Object.fromEntries(words.map(word => [word, reviewPractice({ correctStreak: 2 })])) },
    levelStars: {},
  });
  await page.goto('/');
  await page.getByRole('button', { name: '开始今日复习，共 2 个词' }).click();

  await expect(page.locator('.cell:not(.cell-empty)')).toHaveCount(4);
  await expect(page.locator('.mission-beat')).toHaveCount(2);
  await expect(page.locator('.mission-progress output')).toHaveText('0 / 2');
  await expect(page.locator('.mission-stage')).toHaveClass(/mission-stage-beat-count-2/);

  await completeReviewRound(page);
  await expect(page.locator('.cmp-learning-summary')).toContainText('本轮练习 2 个词');
  await expect(page.locator('.cmp-learning-summary')).toContainText('更熟悉 2 个');
  await expect(page.locator('.cmp-learning-summary')).not.toContainText('下次再见');
});
