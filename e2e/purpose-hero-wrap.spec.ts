import { test, expect } from '@playwright/test'

/**
 * リグレッション: 「狭い画面で活動理念の見出しが語中で折り返す」NG。
 *
 * /purpose のヒーロー見出しは意味の切れ目 (都市と地方が / 互いを理解し、/
 * 共に汗を流し、/ 豊かさを未来へ継ぐ) を inline-block に分け、幅が足りないときは
 * その境界で折り返させている。分割が粗いと「…互いを理解 / し、」のように
 * 語中で折れてしまう。行分割は実際のテキスト計測に依存するため jsdom では検証できない。
 */
const PHRASES = [
  '都市と地方が',
  '互いを理解し、',
  '共に汗を流し、',
  '豊かさを未来へ継ぐ',
]

/** h1 内の各 span を、描画された行 (矩形の上端) ごとにまとめた文字列の配列 */
async function headingLines(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const lines = new Map<number, string>()
    for (const span of document.querySelectorAll('h1 span')) {
      const top = Math.round(span.getBoundingClientRect().top)
      lines.set(top, (lines.get(top) ?? '') + (span.textContent ?? ''))
    }
    return [...lines.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, text]) => text)
  })
}

test('狭い画面では活動理念の見出しが意味の切れ目で折り返す', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/purpose')

  // 意味の切れ目ごとに 1 行ずつ折り返す
  expect(await headingLines(page)).toEqual(PHRASES)

  // どの句も、それ自体が 2 行に折れていない (= 語中で折り返していない)
  const wrappedSpans = await page.evaluate(
    () =>
      [...document.querySelectorAll('h1 span')].filter(
        (span) => span.getClientRects().length > 1,
      ).length,
  )
  expect(wrappedSpans).toBe(0)
})

test('広い画面では活動理念の見出しが 2 行に収まる', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/purpose')

  expect(await headingLines(page)).toEqual([
    '都市と地方が互いを理解し、',
    '共に汗を流し、豊かさを未来へ継ぐ',
  ])
})
