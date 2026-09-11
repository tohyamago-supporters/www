import { describe, it, expect } from 'vitest'
import { summarizeActivity } from './purposeStats'

const post = (iso: string, images = 0) => ({
  data: { date: new Date(iso), images: Array.from({ length: images }) },
})

describe('summarizeActivity', () => {
  it('件数・写真枚数・最初と最新の年を集計する', () => {
    const summary = summarizeActivity(
      [
        post('2019-04-06T00:00:00Z', 3),
        post('2018-08-11T00:00:00Z', 0),
        post('2026-07-01T00:00:00Z', 2),
      ],
      new Date('2026-09-11T00:00:00Z'),
    )
    expect(summary.postCount).toBe(3)
    expect(summary.photoCount).toBe(5)
    expect(summary.firstYear).toBe(2018)
    expect(summary.latestYear).toBe(2026)
  })

  it('活動年数は最初の記録の年から現在までを両端込みで数える', () => {
    const summary = summarizeActivity(
      [post('2018-08-11T00:00:00Z')],
      new Date('2026-09-11T00:00:00Z'),
    )
    expect(summary.yearSpan).toBe(9)
  })

  it('記録が同じ年だけでも活動年数は 1 になる', () => {
    const summary = summarizeActivity(
      [post('2026-01-01T00:00:00Z'), post('2026-07-01T00:00:00Z')],
      new Date('2026-09-11T00:00:00Z'),
    )
    expect(summary.yearSpan).toBe(1)
  })

  it('未来日付の記録があっても年数が縮まない', () => {
    const summary = summarizeActivity(
      [post('2018-08-11T00:00:00Z'), post('2027-01-01T00:00:00Z')],
      new Date('2026-09-11T00:00:00Z'),
    )
    expect(summary.latestYear).toBe(2027)
    expect(summary.yearSpan).toBe(10)
  })

  it('images が未指定の記事は写真 0 枚として扱う', () => {
    const summary = summarizeActivity([
      { data: { date: new Date('2020-01-01T00:00:00Z') } },
    ])
    expect(summary.photoCount).toBe(0)
  })

  it('年は UTC 基準で取り出す (実行 TZ に依存しない)', () => {
    // JST では 2019-01-01 だが UTC では 2018-12-31 になる日時
    const summary = summarizeActivity(
      [post('2018-12-31T15:00:00Z')],
      new Date('2018-12-31T15:00:00Z'),
    )
    expect(summary.firstYear).toBe(2018)
  })

  it('記録が無ければ 0 と null を返す', () => {
    expect(summarizeActivity([])).toEqual({
      postCount: 0,
      photoCount: 0,
      firstYear: null,
      latestYear: null,
      yearSpan: 0,
    })
  })
})
