import { describe, it, expect } from 'vitest'
import {
  sortFields,
  totalFieldArea,
  countFieldsWithArea,
  formatArea,
  formatYen,
  formatDate,
  sortReports,
  sortWorks,
  summarizeFarmWork,
  selectEvents,
  summarizeSales,
  averageUnitPrice,
  summarizeReports,
  WORK_KIND_LABEL,
  type FieldRecord,
  type WorkRecord,
  type SaleRecord,
  type ReportRecord,
} from './achievementStats'

const field = (over: Partial<FieldRecord> = {}): FieldRecord => ({
  id: 'f',
  name: '畑',
  location: '下栗',
  order: 0,
  crops: [],
  ...over,
})

const work = (over: Partial<WorkRecord> = {}): WorkRecord => ({
  date: new Date('2025-11-02T00:00:00Z'),
  name: '大豆収穫作業',
  place: '突当り付近',
  kind: 'farmwork',
  ...over,
})

const sale = (over: Partial<SaleRecord> = {}): SaleRecord => ({
  item: '茶',
  channel: 'BASE',
  units: 10,
  amount: 15400,
  ...over,
})

const report = (over: Partial<ReportRecord> = {}): ReportRecord => ({
  id: 'r',
  name: '令和7年度',
  startDate: new Date('2025-07-01T00:00:00Z'),
  endDate: new Date('2026-06-30T00:00:00Z'),
  reportedOn: new Date('2026-08-15T00:00:00Z'),
  summary: [],
  works: [],
  sales: [],
  ...over,
})

describe('sortFields', () => {
  it('order の昇順に並べる', () => {
    const sorted = sortFields([
      field({ id: 'c', order: 3 }),
      field({ id: 'a', order: 1 }),
      field({ id: 'b', order: 2 }),
    ])
    expect(sorted.map((f) => f.id)).toEqual(['a', 'b', 'c'])
  })

  it('order が同じなら名前順で安定させる', () => {
    const sorted = sortFields([
      field({ id: 'z', name: 'わかば畑', order: 1 }),
      field({ id: 'a', name: 'あかね畑', order: 1 }),
    ])
    expect(sorted.map((f) => f.id)).toEqual(['a', 'z'])
  })

  it('入力配列を破壊しない', () => {
    const input = [field({ id: 'b', order: 2 }), field({ id: 'a', order: 1 })]
    sortFields(input)
    expect(input.map((f) => f.id)).toEqual(['b', 'a'])
  })
})

describe('totalFieldArea', () => {
  it('面積が判明しているものだけを合計する', () => {
    expect(
      totalFieldArea([field({ area: 300 }), field(), field({ area: 120 })]),
    ).toBe(420)
  })

  it('1 件も判明していなければ null を返す', () => {
    expect(totalFieldArea([field(), field()])).toBeNull()
    expect(totalFieldArea([])).toBeNull()
  })
})

describe('countFieldsWithArea', () => {
  it('面積が判明している件数を数える', () => {
    expect(countFieldsWithArea([field({ area: 1 }), field()])).toBe(1)
    expect(countFieldsWithArea([])).toBe(0)
  })
})

describe('formatArea', () => {
  it('100 ㎡ 未満はアール併記なし', () => {
    expect(formatArea(80)).toBe('80 ㎡')
  })

  it('100 ㎡ 以上はアールを併記する (1a = 100 ㎡)', () => {
    expect(formatArea(300)).toBe('300 ㎡（約 3 a）')
  })

  it('3 桁区切りを入れ、アールは小数第 1 位で丸める', () => {
    expect(formatArea(12345)).toBe('12,345 ㎡（約 123.5 a）')
  })
})

describe('formatYen', () => {
  it('3 桁区切りの金額にする', () => {
    expect(formatYen(15400)).toBe('15,400 円')
    expect(formatYen(0)).toBe('0 円')
  })
})

describe('formatDate', () => {
  it('YYYY年M月D日 に整形する (0 埋めしない)', () => {
    expect(formatDate(new Date('2026-08-15T00:00:00Z'))).toBe('2026年8月15日')
    expect(formatDate(new Date('2026-03-06T00:00:00Z'))).toBe('2026年3月6日')
  })

  it('UTC 基準で取り出す (実行タイムゾーンで日付がずれない)', () => {
    // ローカルが UTC+9 なら翌日になる時刻でも、UTC の日付を返す
    expect(formatDate(new Date('2025-10-25T23:30:00Z'))).toBe('2025年10月25日')
  })
})

describe('sortReports', () => {
  it('新しい事業年度から順に並べる', () => {
    const sorted = sortReports([
      report({ id: 'old', startDate: new Date('2024-10-01T00:00:00Z') }),
      report({ id: 'new', startDate: new Date('2025-07-01T00:00:00Z') }),
    ])
    expect(sorted.map((r) => r.id)).toEqual(['new', 'old'])
  })

  it('入力配列を破壊しない', () => {
    const input = [
      report({ id: 'old', startDate: new Date('2024-10-01T00:00:00Z') }),
      report({ id: 'new', startDate: new Date('2025-07-01T00:00:00Z') }),
    ]
    sortReports(input)
    expect(input.map((r) => r.id)).toEqual(['old', 'new'])
  })
})

describe('sortWorks', () => {
  it('実施日の古い順に並べる (報告書の表と同じ並び)', () => {
    const sorted = sortWorks([
      work({ name: 'c', date: new Date('2026-01-17T00:00:00Z') }),
      work({ name: 'a', date: new Date('2025-07-26T00:00:00Z') }),
      work({ name: 'b', date: new Date('2025-10-04T00:00:00Z') }),
    ])
    expect(sorted.map((w) => w.name)).toEqual(['a', 'b', 'c'])
  })

  it('同じ日は入力順 (事業報告書の記載順) を保つ', () => {
    const sameDay = new Date('2025-10-04T00:00:00Z')
    const sorted = sortWorks([
      work({ name: '茶畑除草作業', date: sameDay }),
      work({ name: '下栗蕎麦収穫作業', date: sameDay }),
    ])
    expect(sorted.map((w) => w.name)).toEqual([
      '茶畑除草作業',
      '下栗蕎麦収穫作業',
    ])
  })

  it('入力配列を破壊しない', () => {
    const input = [
      work({ name: 'b', date: new Date('2026-01-17T00:00:00Z') }),
      work({ name: 'a', date: new Date('2025-07-26T00:00:00Z') }),
    ]
    sortWorks(input)
    expect(input.map((w) => w.name)).toEqual(['b', 'a'])
  })
})

describe('summarizeFarmWork', () => {
  it('農作業の回数と延べ参加人数を数える', () => {
    expect(
      summarizeFarmWork([
        work({ participants: 3 }),
        work({ participants: 2 }),
        work({ participants: 1 }),
      ]),
    ).toEqual({ sessions: 3, participants: 6 })
  })

  it('農作業以外 (地域行事参加・当会実施) は数えない', () => {
    expect(
      summarizeFarmWork([
        work({ participants: 3 }),
        work({ kind: 'joined', participants: 3 }),
        work({ kind: 'hosted' }),
      ]),
    ).toEqual({ sessions: 1, participants: 3 })
  })

  it('参加人数が未記載の行は 0 として扱う', () => {
    expect(summarizeFarmWork([work(), work({ participants: 2 })])).toEqual({
      sessions: 2,
      participants: 2,
    })
  })
})

describe('selectEvents', () => {
  it('農作業以外の活動だけを取り出す', () => {
    const events = selectEvents([
      work({ name: '大豆収穫作業' }),
      work({ name: 'もみじ狩り', kind: 'joined' }),
      work({ name: '下栗蕎麦を食べる会', kind: 'hosted' }),
    ])
    expect(events.map((w) => w.name)).toEqual([
      'もみじ狩り',
      '下栗蕎麦を食べる会',
    ])
  })
})

describe('summarizeSales', () => {
  it('販売点数と売上高を合計する', () => {
    expect(summarizeSales([sale(), sale({ units: 3, amount: 5400 })])).toEqual({
      units: 13,
      amount: 20800,
    })
  })

  it('販売実績が無ければ 0 を返す', () => {
    expect(summarizeSales([])).toEqual({ units: 0, amount: 0 })
  })
})

describe('averageUnitPrice', () => {
  it('売上高を点数で割った平均単価を返す', () => {
    expect(averageUnitPrice(sale())).toBe(1540)
  })

  it('端数は四捨五入する', () => {
    expect(averageUnitPrice(sale({ units: 3, amount: 5000 }))).toBe(1667)
  })
})

describe('summarizeReports', () => {
  it('全事業年度の累計を積み上げる', () => {
    expect(
      summarizeReports([
        report({
          works: [work({ participants: 6 }), work({ participants: 3 })],
          sales: [sale({ units: 10, amount: 13800 })],
        }),
        report({
          works: [
            work({ participants: 4 }),
            work({ kind: 'joined', participants: 3 }),
          ],
          sales: [sale({ units: 3, amount: 5400 })],
        }),
      ]),
    ).toEqual({
      years: 2,
      sessions: 3,
      participants: 13,
      saleUnits: 13,
      saleAmount: 19200,
    })
  })

  it('報告が無ければすべて 0 を返す', () => {
    expect(summarizeReports([])).toEqual({
      years: 0,
      sessions: 0,
      participants: 0,
      saleUnits: 0,
      saleAmount: 0,
    })
  })
})

describe('WORK_KIND_LABEL', () => {
  it('色に頼らず語で区別できるラベルを持つ', () => {
    expect(WORK_KIND_LABEL.farmwork).toBe('農作業')
    expect(WORK_KIND_LABEL.hosted).toBe('当会実施')
    expect(WORK_KIND_LABEL.joined).toBe('地域行事参加')
  })
})
