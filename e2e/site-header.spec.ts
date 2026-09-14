import { test, expect } from '@playwright/test'

/**
 * リグレッション: 「デスクトップのドロップダウンがコンテンツの背後に隠れる」NG。
 *
 * ヘッダーは backdrop-blur で重ね合わせコンテキストを作るが、z-index/位置指定が
 * 無いと DOM 上後続の <main> が前面に描画され、ドロップダウンがコンテンツに隠れる。
 * jsdom はレイアウト/描画を行わないため、この重なり順は実ブラウザでしか検証できない。
 */
test('デスクトップのドロップダウンがコンテンツの前面に表示される', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  // 「活動を知る」ドロップダウンをホバーで開く
  await page.getByRole('button', { name: '活動を知る' }).hover()

  const item = page.getByRole('link', { name: '活動方針', exact: true })
  await expect(item).toBeVisible()
  // 開閉アニメーション (transform/opacity) が落ち着くのを待つ
  await page.waitForTimeout(250)

  const box = await item.boundingBox()
  if (!box) throw new Error('ドロップダウン項目の位置を取得できませんでした')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  // 当該座標の最前面要素がドロップダウン項目自身であること。
  // ヘッダーの z-index が不足してコンテンツに隠れると、別要素が返り false になる。
  const topmostIsItem = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return Boolean(el && el.closest('a[href="/purpose"]'))
    },
    { x, y },
  )
  expect(topmostIsItem).toBe(true)
})
