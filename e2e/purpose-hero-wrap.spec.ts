import { test, expect, type Page } from '@playwright/test'

/**
 * リグレッション: 「活動理念の見出しが語中で折り返す / 階段組みが崩れる」NG。
 *
 * /purpose のヒーロー見出しは意味の切れ目 (都市と地方が / 互いを理解し、/
 * 共に汗を流し、/ 豊かさを未来へ継ぐ) ごとに 1 行とし、行頭を左端から右端へ
 * 等間隔でずらした階段組みにしている。送り幅は「見出しの幅 − 最長行の幅」を
 * 3 等分した値で、基準を各行ではなく最長行に揃えないと最長の 4 行目だけ
 * 行頭が左へ戻る。行の折返し・位置はテキスト計測に依存するため jsdom では
 * 検証できない。
 */
const PHRASES = [
  '都市と地方が',
  '互いを理解し、',
  '共に汗を流し、',
  '豊かさを未来へ継ぐ',
]

/** h1 の各行の文字列と、左右端の位置 (見出しブロックの左端を 0 とする) */
async function creedLines(page: Page) {
  return page.evaluate(() => {
    const heading = document.querySelector('h1')
    if (!heading) throw new Error('見出しが見つかりませんでした')
    const base = heading.getBoundingClientRect()
    return {
      width: base.width,
      lines: [...heading.querySelectorAll('span')].map((line) => {
        const box = line.getBoundingClientRect()
        return {
          text: line.textContent ?? '',
          left: box.left - base.left,
          right: box.right - base.left,
          // 1 行に収まっていれば矩形は 1 つ。語中で折り返すと 2 つ以上になる
          rects: line.getClientRects().length,
        }
      }),
    }
  })
}

for (const width of [320, 390, 1280]) {
  test(`活動理念の見出しが幅 ${width}px で階段状に並ぶ`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/purpose')

    const { width: headingWidth, lines } = await creedLines(page)

    // 意味の切れ目ごとに 1 行、かつ語中では折り返さない
    expect(lines.map((line) => line.text)).toEqual(PHRASES)
    expect(lines.map((line) => line.rects)).toEqual([1, 1, 1, 1])

    // 先頭行は左寄せ、最終行は右寄せ (端数を考慮して 1px の許容差)
    expect(lines[0].left).toBeLessThanOrEqual(1)
    expect(Math.abs(lines[lines.length - 1].right - headingWidth)).toBeLessThan(
      1,
    )

    // 中間行の行頭は補間され、行頭は必ず右へ進む (最長行で戻らない)
    const lefts = lines.map((line) => line.left)
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i]).toBeGreaterThan(lefts[i - 1])
    }
  })
}
