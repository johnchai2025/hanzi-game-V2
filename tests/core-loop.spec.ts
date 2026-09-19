import { expect, test, type Page } from '@playwright/test';
import curriculum from '@/public/curriculum/grade2_semester1.json';

const PROFILE = {
  childName: '',
  character: { animal: '小狐狸', emoji: '🦊', name: '团团' },
  preferredScenes: [],
  setupCompleted: true,
};

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
  await expect(page.getByText('闯关进度')).toBeVisible();
}

async function findVisiblePair(page: Page) {
  const chars = await page.locator('.cell-word').allTextContents();
  const pairs = curriculum.units[0].pairs;
  for (const pair of pairs) {
    const leftIndex = chars.findIndex((char, index) => index % 2 === 0 && char === pair[0]);
    const rightIndex = chars.findIndex((char, index) => index % 2 === 1 && char === pair[1]);
    if (leftIndex >= 0 && rightIndex >= 0) {
      return { pair, leftIndex, rightIndex };
    }
  }
  throw new Error(`No visible curriculum pair found in ${chars.join(',')}`);
}

test('correct matching is immediate, non-blocking, and image-free', async ({ page }) => {
  await seed(page);
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await enterFirstLevel(page);

  const { pair, leftIndex, rightIndex } = await findVisiblePair(page);
  await page.locator('.cell-word').nth(leftIndex).click();
  await page.locator('.cell-word').nth(rightIndex).click();

  await expect(page.getByText('1 / 6')).toBeVisible();
  await expect(page.getByRole('status')).toContainText(`${pair[0]}＋${pair[1]}＝${pair.join('')}`);
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
