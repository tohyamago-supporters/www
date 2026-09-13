import { test, expect } from '@playwright/test'

/**
 * リグレッション: 「定款ページで PDF ビューワーが起動しない」NG。
 *
 * PDF.js Express は UMD (CommonJS) 配布のため、`import()` の結果の形が
 * バンドラの CommonJS 相互運用の実装に左右される。Node 互換の相互運用が
 * 使われると `module.exports` がそのまま default に載って一段深くなり、
 * 従来どおり default を呼ぶと `e is not a function` で失敗して
 * 空の <div> だけが残る (画面は真っ白)。
 *
 * この経路はバンドル後のコードでしか再現しないため実ブラウザで検証する。
 */
test('定款ページで PDF ビューワーが起動する', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/articles')

  // ビューワーは iframe (webviewer-*) を生成する。生成されなければ起動失敗。
  await expect(page.locator('iframe[id^="webviewer-"]')).toBeAttached({
    timeout: 30_000,
  })

  // ビューワー UI が iframe 内に描画されることまで確認する
  // (data-element は PDF.js Express が公開している安定した識別子)。
  await expect(
    page
      .frameLocator('iframe[id^="webviewer-"]')
      .locator('[data-element="zoomInButton"]'),
  ).toBeVisible({ timeout: 30_000 })

  // フォールバック (ダウンロード導線) が出ている = ビューワーが起動できていない。
  await expect(
    page.getByRole('link', { name: /PDF）をダウンロード/ }),
  ).toHaveCount(0)

  // ライセンスキー未設定の警告は CI では避けられないため、モジュール解決の
  // 失敗 (今回の NG) だけを対象にする。
  expect(
    pageErrors.filter((message) => /is not a function/.test(message)),
  ).toEqual([])
})
