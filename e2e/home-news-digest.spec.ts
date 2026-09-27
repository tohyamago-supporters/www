import { test, expect } from '@playwright/test'

/**
 * トップの活動記録ダイジェストの表示件数。
 * sm 以上 (2 列) では列が欠けないよう 4 件、1 列のモバイルでは縦に長くならないよう 3 件。
 * 件数の出し分けは CSS (max-sm:hidden) のブレークポイントで決まるため実ブラウザで確認する。
 */

const cards = '#feed article'

test('モバイルではダイジェストを 3 件だけ表示する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.locator(cards)).toHaveCount(4)
  await expect(page.locator(`${cards}:visible`)).toHaveCount(3)
})

test('デスクトップではダイジェストを 4 件 (2 列 × 2 行) 表示する', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  await expect(page.locator(`${cards}:visible`)).toHaveCount(4)
})
