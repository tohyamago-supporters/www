/**
 * achievementStats — 活動成果ページ (/achievements) の集計ロジック。
 *
 * 「法人としてどれだけのことを積み重ねてきたか」を、コンテンツコレクション
 * (fields / crops / activities / posts) から機械的に導く。数字を手打ちすると
 * 実態とずれていくため、原則としてデータから数える。
 *
 * Astro フロントマター (ビルド時) から使うが、境界条件を回帰テストできるよう
 * 純粋関数として切り出す (CLAUDE.md「インラインのロジックは *.ts へ分離」)。
 */

export type ActivityKind = 'hosted' | 'joined'

/** 耕作地 (fields コレクション 1 件)。 */
export interface FieldRecord {
  id: string
  name: string
  location: string
  order: number
  /** 耕作面積 (㎡)。未確定なら undefined。 */
  area?: number
  since?: number
  /** crops コレクションの ID。 */
  crops: string[]
  note?: string
}

/** イベントの実施・参加の記録 (activities コレクション 1 件)。 */
export interface ActivityRecord {
  id: string
  name: string
  date: Date
  kind: ActivityKind
  location?: string
  organizer?: string
  participants?: number
  url?: string
  note?: string
}

/** 実施 / 参加の表示ラベル。色だけに頼らず語で区別するために使う。 */
export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  hosted: '実施',
  joined: '参加',
}

/** 耕作地を表示順 (order 昇順 → 同順なら名前) に並べる。 */
export function sortFields(fields: FieldRecord[]): FieldRecord[] {
  return [...fields].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ja'),
  )
}

/**
 * 面積が判明している耕作地の合計 (㎡)。
 * 1 件も判明していなければ null を返し、ページ側で「集計中」と出し分ける。
 */
export function totalFieldArea(fields: FieldRecord[]): number | null {
  // 型述語で area を必須に絞り込み、合計側に到達不能なフォールバックを残さない
  const known = fields.filter(
    (f): f is FieldRecord & { area: number } => typeof f.area === 'number',
  )
  if (known.length === 0) return null
  return known.reduce((sum, f) => sum + f.area, 0)
}

/** 面積が判明している耕作地の件数。 */
export function countFieldsWithArea(fields: FieldRecord[]): number {
  return fields.filter((f) => typeof f.area === 'number').length
}

/** 3 桁区切り (ロケール設定に依存しないよう自前で挿入する)。 */
function groupDigits(value: number): string {
  const [int, frac] = String(value).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac ? `${grouped}.${frac}` : grouped
}

/**
 * 面積 (㎡) の表示。100 ㎡ 以上は農地で使い慣れた「アール (a)」を併記する
 * (1a = 100 ㎡)。アールは小数第 1 位で丸める。
 */
export function formatArea(squareMeters: number): string {
  const base = `${groupDigits(squareMeters)} ㎡`
  if (squareMeters < 100) return base
  const are = Math.round((squareMeters / 100) * 10) / 10
  return `${base}（約 ${groupDigits(are)} a）`
}

/** 年間に行う農作業の延べ件数 (crops の tasks 合計)。 */
export function countAnnualTasks(crops: { tasks: unknown[] }[]): number {
  return crops.reduce((sum, crop) => sum + crop.tasks.length, 0)
}

/**
 * 活動年数 (「N 年目」の N)。開始年を 1 年目として数える。
 * 開始年より前の日付を渡された場合でも 1 を下回らない。
 *
 * 日付は postDate / postArchive と同じく UTC 基準で扱い、SSG の実行タイムゾーンに
 * よって表示がずれないようにする。
 */
export function yearsOfActivity(startYear: number, now: Date): number {
  return Math.max(1, now.getUTCFullYear() - startYear + 1)
}

/** 記録を新しい順に並べる (同日は名前順で安定させる)。 */
export function sortActivities(activities: ActivityRecord[]): ActivityRecord[] {
  return [...activities].sort(
    (a, b) =>
      b.date.getTime() - a.date.getTime() || a.name.localeCompare(b.name, 'ja'),
  )
}

/** 年ごとにまとめた記録 (年は新しい順、年内も新しい順)。 */
export function groupActivitiesByYear(
  activities: ActivityRecord[],
): { year: number; items: ActivityRecord[] }[] {
  const byYear = new Map<number, ActivityRecord[]>()
  for (const activity of sortActivities(activities)) {
    const year = activity.date.getUTCFullYear()
    const bucket = byYear.get(year)
    if (bucket) bucket.push(activity)
    else byYear.set(year, [activity])
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({ year, items }))
}

/** kind ごとの件数 (実施 / 参加の内訳)。 */
export function countActivitiesByKind(
  activities: ActivityRecord[],
): Record<ActivityKind, number> {
  return activities.reduce(
    (acc, a) => ({ ...acc, [a.kind]: acc[a.kind] + 1 }),
    { hosted: 0, joined: 0 } as Record<ActivityKind, number>,
  )
}

/**
 * 「実施 2 件・参加 3 件」の内訳表記。0 件の種別は省く。
 * 種別が 1 つしかないときは総数と同じ情報になるため空文字を返す。
 */
export function summarizeActivityKinds(
  counts: Record<ActivityKind, number>,
): string {
  const parts = (Object.keys(ACTIVITY_KIND_LABEL) as ActivityKind[])
    .filter((kind) => counts[kind] > 0)
    .map((kind) => `${ACTIVITY_KIND_LABEL[kind]} ${counts[kind]} 件`)
  return parts.length >= 2 ? parts.join('・') : ''
}

/**
 * 記録の日付を「YYYY年M月D日」へ整形する (曜日は不要なため postDate とは別実装)。
 * postDate と同じく UTC 基準で取り出し、実行タイムゾーンで日付がずれないようにする。
 */
export function formatActivityDate(date: Date): string {
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}
