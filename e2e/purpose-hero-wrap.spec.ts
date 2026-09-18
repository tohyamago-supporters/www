import { test, expect, type Page } from '@playwright/test'

/**
 * リグレッション: 「活動理念の見出しが語中で折り返す / 階段組みが崩れる /
 * 広い画面で改行が増えすぎる」NG。
 *
 * /purpose のヒーロー見出しは意味の切れ目で改行し、行頭を左端から右端へ
 * ずらした階段組みにしている。改行の数は画面幅で変え、狭い画面 (〜sm) は
 * 4 つの句をそれぞれ 1 行に、sm 以上は 2 句ずつまとめて 2 行にする。
 * 狭い画面の送り幅は「見出しの幅 − 最長行の幅」を 3 等分した値で、基準を
 * 各行ではなく最長行に揃えないと最長の 4 行目だけ行頭が左へ戻る。
 * 行の折返し・位置はテキスト計測に依存するため jsdom では検証できない。
 */
const NARROW_LINES = [
  '都市と地方が',
  '互いを理解し、',
  '共に汗を流し、',
  '豊かさを未来へ継ぐ',
]
const WIDE_LINES = [
  '都市と地方が互いを理解し、',
  '共に汗を流し、豊かさを未来へ継ぐ',
]

/** h1 を描画された行ごとにまとめ、文字列と左右端 (見出しの左端を 0 とする) を返す */
async function creedLines(page: Page) {
  return page.evaluate(() => {
    const heading = document.querySelector('h1')
    if (!heading) throw new Error('見出しが見つかりませんでした')
    const base = heading.getBoundingClientRect()
    const rows = new Map<
      number,
      {
        text: string
        left: number
        right: number
        phrases: number
        rects: number
      }
    >()
    // 句 (最も内側の span) を矩形の上端でグループ化すると、実際の行になる
    for (const phrase of heading.querySelectorAll('span:not(:has(span))')) {
      const box = phrase.getBoundingClientRect()
      const top = Math.round(box.top)
      const row = rows.get(top) ?? {
        text: '',
        left: Infinity,
        right: -Infinity,
        phrases: 0,
        rects: 0,
      }
      rows.set(top, {
        text: row.text + (phrase.textContent ?? ''),
        left: Math.min(row.left, box.left - base.left),
        right: Math.max(row.right, box.right - base.left),
        phrases: row.phrases + 1,
        // 句が 1 行に収まっていれば矩形は句ごとに 1 つ。語中で折り返すと増える
        rects: row.rects + phrase.getClientRects().length,
      })
    }
    return {
      width: base.width,
      lines: [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v),
    }
  })
}

const CASES = [
  { width: 320, expected: NARROW_LINES },
  { width: 390, expected: NARROW_LINES },
  { width: 768, expected: WIDE_LINES },
  { width: 1280, expected: WIDE_LINES },
]

for (const { width, expected } of CASES) {
  test(`活動理念の見出しが幅 ${width}px で ${expected.length} 行の階段組みになる`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/purpose')

    const { width: headingWidth, lines } = await creedLines(page)

    // 画面幅に応じた行数・行の内容になる
    expect(lines.map((line) => line.text)).toEqual(expected)
    // 語中では折り返さない (行の矩形数 = その行に含まれる句の数)
    expect(lines.map((line) => line.rects)).toEqual(
      lines.map((line) => line.phrases),
    )

    // 先頭行は左寄せ、最終行は右寄せ (端数を考慮して 1px の許容差)
    expect(lines[0].left).toBeLessThanOrEqual(1)
    expect(Math.abs(lines[lines.length - 1].right - headingWidth)).toBeLessThan(
      1,
    )

    // 行頭は必ず右へ進む (最長行で戻らない)
    const lefts = lines.map((line) => line.left)
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i]).toBeGreaterThan(lefts[i - 1])
    }
  })
}
