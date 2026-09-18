import { describe, it, expect } from 'vitest'
import {
  sortFields,
  totalFieldArea,
  countFieldsWithArea,
  formatArea,
  countAnnualTasks,
  yearsOfActivity,
  sortActivities,
  groupActivitiesByYear,
  countActivitiesByKind,
  summarizeActivityKinds,
  formatActivityDate,
  ACTIVITY_KIND_LABEL,
  type FieldRecord,
  type ActivityRecord,
} from './achievementStats'

const field = (over: Partial<FieldRecord> = {}): FieldRecord => ({
  id: 'f',
  name: '畑',
  location: '下栗の里',
  order: 0,
  crops: [],
  ...over,
})

const activity = (over: Partial<ActivityRecord> = {}): ActivityRecord => ({
  id: 'a',
  name: '行事',
  date: new Date('2025-01-01T00:00:00Z'),
  kind: 'joined',
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
      field({ id: 'z', name: '茶畑', order: 1 }),
      field({ id: 'a', name: '大豆の畑', order: 1 }),
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

describe('countAnnualTasks', () => {
  it('作物ごとの作業件数を合計する', () => {
    expect(
      countAnnualTasks([
        { tasks: [1, 2, 3] },
        { tasks: [] },
        { tasks: [1, 2] },
      ]),
    ).toBe(5)
  })
})

describe('yearsOfActivity', () => {
  it('開始年を 1 年目として数える', () => {
    expect(yearsOfActivity(2018, new Date('2018-08-11T00:00:00Z'))).toBe(1)
    expect(yearsOfActivity(2018, new Date('2026-09-18T00:00:00Z'))).toBe(9)
  })

  it('開始年より前でも 1 を下回らない', () => {
    expect(yearsOfActivity(2018, new Date('2017-01-01T00:00:00Z'))).toBe(1)
  })
})

describe('sortActivities', () => {
  it('新しい順に並べる', () => {
    const sorted = sortActivities([
      activity({ id: 'old', date: new Date('2018-12-13T00:00:00Z') }),
      activity({ id: 'new', date: new Date('2026-03-16T00:00:00Z') }),
      activity({ id: 'mid', date: new Date('2025-10-25T00:00:00Z') }),
    ])
    expect(sorted.map((a) => a.id)).toEqual(['new', 'mid', 'old'])
  })

  it('同じ日なら名前順で安定させる', () => {
    const sameDay = new Date('2025-10-25T00:00:00Z')
    const sorted = sortActivities([
      activity({ id: 'z', name: 'もみじ狩り', date: sameDay }),
      activity({ id: 'a', name: 'そば打ち体験', date: sameDay }),
    ])
    expect(sorted.map((a) => a.id)).toEqual(['a', 'z'])
  })

  it('入力配列を破壊しない', () => {
    const input = [
      activity({ id: 'old', date: new Date('2018-01-01T00:00:00Z') }),
      activity({ id: 'new', date: new Date('2026-01-01T00:00:00Z') }),
    ]
    sortActivities(input)
    expect(input.map((a) => a.id)).toEqual(['old', 'new'])
  })
})

describe('groupActivitiesByYear', () => {
  it('年ごとにまとめ、年も年内も新しい順にする', () => {
    const groups = groupActivitiesByYear([
      activity({ id: 'a', date: new Date('2025-03-01T00:00:00Z') }),
      activity({ id: 'b', date: new Date('2026-03-16T00:00:00Z') }),
      activity({ id: 'c', date: new Date('2025-10-25T00:00:00Z') }),
    ])
    expect(groups.map((g) => g.year)).toEqual([2026, 2025])
    expect(groups[1].items.map((a) => a.id)).toEqual(['c', 'a'])
  })

  it('空配列なら空を返す', () => {
    expect(groupActivitiesByYear([])).toEqual([])
  })
})

describe('countActivitiesByKind', () => {
  it('実施 / 参加の内訳を数える', () => {
    expect(
      countActivitiesByKind([
        activity({ kind: 'hosted' }),
        activity({ kind: 'joined' }),
        activity({ kind: 'joined' }),
      ]),
    ).toEqual({ hosted: 1, joined: 2 })
  })

  it('空配列でも 0 埋めした内訳を返す', () => {
    expect(countActivitiesByKind([])).toEqual({ hosted: 0, joined: 0 })
  })
})

describe('summarizeActivityKinds', () => {
  it('両方の種別があれば内訳を並べる', () => {
    expect(summarizeActivityKinds({ hosted: 2, joined: 3 })).toBe(
      '実施 2 件・参加 3 件',
    )
  })

  it('片方しか無ければ空文字 (総数と重複するため)', () => {
    expect(summarizeActivityKinds({ hosted: 0, joined: 3 })).toBe('')
    expect(summarizeActivityKinds({ hosted: 0, joined: 0 })).toBe('')
  })
})

describe('ACTIVITY_KIND_LABEL', () => {
  it('色に頼らず語で区別できるラベルを持つ', () => {
    expect(ACTIVITY_KIND_LABEL.hosted).toBe('実施')
    expect(ACTIVITY_KIND_LABEL.joined).toBe('参加')
  })
})

describe('formatActivityDate', () => {
  it('YYYY年M月D日 に整形する (0 埋めしない)', () => {
    expect(formatActivityDate(new Date('2025-10-25T00:00:00Z'))).toBe(
      '2025年10月25日',
    )
    expect(formatActivityDate(new Date('2026-03-06T00:00:00Z'))).toBe(
      '2026年3月6日',
    )
  })

  it('UTC 基準で取り出す (実行タイムゾーンで日付がずれない)', () => {
    // ローカルが UTC+9 なら翌日になる時刻でも、UTC の日付を返す
    expect(formatActivityDate(new Date('2025-10-25T23:30:00Z'))).toBe(
      '2025年10月25日',
    )
  })
})
