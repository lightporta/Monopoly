import { test, expect } from '@playwright/test';

async function english(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch language' }).click();
}
async function createRoom(page, name) {
  await english(page);
  await page.getByRole('tab', { name: 'Play online', exact: true }).click();
  await page.getByRole('textbox', { name: 'Your nickname', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create room', exact: false }).click();
  await expect(page.locator('.room-code')).toBeVisible();
  return page.locator('.room-code').innerText();
}

test('bilingual local play, property choices, save and resume', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('沿海而行，经营你的下一站。');
  await page.getByRole('button', { name: 'Switch language' }).click();
  await page.screenshot({ path: 'test-results/home-en.png', fullPage: true });
  await page.getByRole('combobox', { name: 'Travelers 2', exact: true }).selectOption('human');
  await page.getByRole('textbox', { name: 'Your nickname 1' }).fill('Alice');
  await page.getByRole('textbox', { name: 'Your nickname 2' }).fill('Bob');
  await page.getByLabel('Game seed').fill('browser-regression');
  await page.getByTestId('start-local').click();
  await expect(page.locator('.board-cell')).toHaveCount(36);
  await page.getByTestId('action-roll').click();
  await expect(
    page.locator('[data-testid="action-decline"], [data-testid="action-endTurn"]'),
  ).toBeVisible();
  if (await page.getByTestId('action-buy').count()) await page.getByTestId('action-buy').click();
  else if (await page.getByTestId('action-decline').count())
    await page.getByTestId('action-decline').click();
  await expect(page.getByTestId('action-endTurn')).toBeVisible();
  await page.screenshot({ path: 'test-results/game-en.png', fullPage: true });
  await page.getByTestId('action-endTurn').click();
  await page.getByRole('button', { name: 'Start my turn' }).click();
  await expect(page.locator('.turn-title h3')).toHaveText('Bob');
  await page.reload();
  await page.getByRole('button', { name: 'Resume local game' }).click();
  await expect(page.locator('.turn-title h3')).toHaveText('Bob');
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog')).toContainText('¥55');
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('two browsers synchronize actions, reconnect on refresh, and migrate host', async ({
  browser,
}) => {
  const c1 = await browser.newContext(),
    c2 = await browser.newContext();
  const a = await c1.newPage(),
    b = await c2.newPage();
  try {
    const code = await createRoom(a, 'Alice');
    await english(b);
    await b.getByRole('tab', { name: 'Play online', exact: true }).click();
    await b.getByRole('textbox', { name: 'Your nickname', exact: true }).fill('Bob');
    await b.getByRole('textbox', { name: 'Room code', exact: true }).fill(code);
    await b.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(b.locator('.lobby-player')).toHaveCount(2);
    await b.getByRole('button', { name: 'Toggle ready' }).click();
    await a.getByRole('button', { name: 'Start game', exact: false }).click();
    await expect(a.locator('.board-cell')).toHaveCount(36);
    await expect(b.locator('.board-cell')).toHaveCount(36);
    await expect(b.getByTestId('action-roll')).toHaveCount(0);
    await a.getByTestId('action-roll').click();
    await expect.poll(async () => a.locator('.dice-pair').innerText()).not.toBe('·\n·');
    await expect
      .poll(async () => b.locator('.dice-pair').innerText())
      .toBe(await a.locator('.dice-pair').innerText());
    await expect(
      a.locator('[data-testid="action-decline"], [data-testid="action-endTurn"]'),
    ).toBeVisible();
    if (await a.getByTestId('action-decline').count())
      await a.getByTestId('action-decline').click();
    await a.getByTestId('action-endTurn').click();
    await expect(b.getByTestId('action-roll')).toBeVisible();
    await b.reload();
    await expect(b.getByTestId('action-roll')).toBeVisible();
    await b.getByTestId('action-roll').click();
    await expect(
      b.locator('[data-testid="action-decline"], [data-testid="action-endTurn"]'),
    ).toBeVisible();
    if (await b.getByTestId('action-decline').count())
      await b.getByTestId('action-decline').click();
    await b.getByTestId('action-endTurn').click();
    await expect(a.getByTestId('action-roll')).toBeVisible();
    await a.getByRole('button', { name: 'Leave room', exact: true }).click();
    await a.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(a.getByRole('tab', { name: 'Play locally' })).toBeVisible();
    await expect(b.locator('.players-list')).toContainText('AI');
    await expect(b.locator('.connection')).toHaveText('Connected');
  } finally {
    await c1.close();
    await c2.close();
  }
});

test('mobile layout and complete AI game remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await english(page);
  await expect(page.getByTestId('start-local')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.getByRole('combobox', { name: 'Travelers 1', exact: true }).selectOption('hard');
  await page.getByRole('combobox', { name: 'Travelers 2', exact: true }).selectOption('easy');
  await page.getByLabel('Round limit').selectOption('10');
  await page.getByTestId('start-local').click();
  await expect(page.locator('.board-cell')).toHaveCount(36);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/mobile-game.png', fullPage: true });
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 35000 });
});

test('a new human can ready up in a finished room and restart', async ({ browser }) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const [a, b, c] = await Promise.all(contexts.map((context) => context.newPage()));
  try {
    const code = await createRoom(a, 'Alice');
    async function join(page, name) {
      await english(page);
      await page.getByRole('tab', { name: 'Play online', exact: true }).click();
      await page.getByRole('textbox', { name: 'Your nickname', exact: true }).fill(name);
      await page.getByRole('textbox', { name: 'Room code', exact: true }).fill(code);
      await page.getByRole('button', { name: 'Join room', exact: true }).click();
    }
    await join(b, 'Bob');
    await b.getByRole('button', { name: 'Toggle ready' }).click();
    await a.getByRole('button', { name: 'Start game', exact: false }).click();
    await a.getByRole('button', { name: 'Surrender', exact: true }).click();
    await a.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(a.getByTestId('results')).toBeVisible();
    await join(c, 'Charlie');
    await expect(c.getByTestId('results')).toBeVisible();
    await c.getByRole('button', { name: 'Toggle ready' }).click();
    await a.getByRole('button', { name: 'Play again', exact: false }).click();
    await expect(c.getByTestId('results')).toHaveCount(0);
    await expect(c.locator('.players-list .player-card')).toHaveCount(3);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
