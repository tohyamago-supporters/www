/**
 * achievementStats — 活動成果ページ (/achievements) の集計ロジック。
 *
 * 総会に提出した事業報告書 (reports コレクション) を情報源とし、実施回数・延べ参加人数・
 * 販売点数・売上高を機械的に数える。数字を本文へ手打ちすると報告書とずれていくため、
 * 表示する数値は原則としてデータから導く。
 *
 * Astro フロントマター (ビルド時) から使うが、境界条件を回帰テストできるよう
 * 純粋関数として切り出す (CLAUDE.md「インラインのロジックは *.ts へ分離」)。
 */

/** 実施内容の区分。farmwork=遊休農地活用農作業 / hosted=当会が実施 / joined=地域行事へ参加 */
export type WorkKind = 'farmwork' | 'hosted' | 'joined'

/** 耕作地 (fields コレクション 1 件)。 */
export interface FieldRecord {
  id: string
  name: string
  location: string
  order: number
  /** 耕作面積 (㎡)。未確定なら undefined。 */
  area?: number
  /** crops コレクションの ID。 */
  crops: string[]
  note?: string
}

/** 実施状況の明細 1 行 (事業報告附属明細書の実施状況表)。 */
export interface WorkRecord {
  date: Date
  name: string
  place: string
  participants?: number
  kind: WorkKind
  note?: string
}

/** 成果品販売状況 1 行。 */
export interface SaleRecord {
  item: string
  channel: string
  units: number
  amount: number
  note?: string
}

/** 事業年度ごとの事業報告 (reports コレクション 1 件)。 */
export interface ReportRecord {
  id: string
  name: string
  startDate: Date
  endDate: Date
  reportedOn: Date
  summary: string[]
  works: WorkRecord[]
  sales: SaleRecord[]
}

/** 区分の表示ラベル。色だけに頼らず語で区別するために使う。 */
export const WORK_KIND_LABEL: Record<WorkKind, string> = {
  farmwork: '農作業',
  hosted: '当会実施',
  joined: '地域行事参加',
}

/* ------------------------------------------------------------------ 耕作地 */

/** 耕作地を表示順 (order 昇順 → 同順なら名前) に並べる。 */
export function sortFields(fields: FieldRecord[]): FieldRecord[] {
  return [...fields].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ja'),
  )
}

/**
 * 面積が判明している耕作地の合計 (㎡)。
 * 1 件も判明していなければ null を返し、ページ側で「確認中」と出し分ける。
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

/* -------------------------------------------------------------------- 整形 */

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

/** 金額の表示 (3 桁区切り + 円)。 */
export function formatYen(amount: number): string {
  return `${groupDigits(amount)} 円`
}

/**
 * 日付を「YYYY年M月D日」へ整形する (曜日は不要なため postDate とは別実装)。
 * postDate / postArchive と同じく UTC 基準で取り出し、SSG の実行タイムゾーンで
 * 日付がずれないようにする。
 */
export function formatDate(date: Date): string {
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}

/* -------------------------------------------------------------------- 報告 */

/** 事業報告を新しい年度から順に並べる。 */
export function sortReports(reports: ReportRecord[]): ReportRecord[] {
  return [...reports].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime(),
  )
}

/**
 * 実施状況の明細を実施日の古い順に並べる (報告書の表と同じ並び)。
 * 同じ日は比較結果を 0 にして入力順を保ち、事業報告書の記載順をそのまま再現する
 * (Array.prototype.sort は安定ソート)。
 */
export function sortWorks(works: WorkRecord[]): WorkRecord[] {
  return [...works].sort((a, b) => a.date.getTime() - b.date.getTime())
}

/** 延べ参加人数 (参加人数が記載されている行だけを合計する)。 */
function sumParticipants(works: WorkRecord[]): number {
  return works.reduce((sum, w) => sum + (w.participants ?? 0), 0)
}

/**
 * 遊休農地活用農作業の実施回数と延べ参加人数。
 * 事業報告書の「N 回の農作業を実施し、延べ M 名の参加を得た」に対応するため、
 * 農作業以外 (地域行事への参加・当会イベント) は数えない。
 */
export function summarizeFarmWork(works: WorkRecord[]): {
  sessions: number
  participants: number
} {
  const farmwork = works.filter((w) => w.kind === 'farmwork')
  return {
    sessions: farmwork.length,
    participants: sumParticipants(farmwork),
  }
}

/** 農作業以外の活動 (当会が実施した催し・地域行事への参加) を抜き出す。 */
export function selectEvents(works: WorkRecord[]): WorkRecord[] {
  return works.filter((w) => w.kind !== 'farmwork')
}

/** 成果品の販売点数と売上高の合計。 */
export function summarizeSales(sales: SaleRecord[]): {
  units: number
  amount: number
} {
  return sales.reduce(
    (acc, sale) => ({
      units: acc.units + sale.units,
      amount: acc.amount + sale.amount,
    }),
    { units: 0, amount: 0 },
  )
}

/** 平均単価 (円/点)。端数は四捨五入する。 */
export function averageUnitPrice(sale: SaleRecord): number {
  return Math.round(sale.amount / sale.units)
}

/** 全事業年度の累計 (設立からの積み上げ)。 */
export function summarizeReports(reports: ReportRecord[]): {
  years: number
  sessions: number
  participants: number
  saleUnits: number
  saleAmount: number
} {
  return reports.reduce(
    (acc, report) => {
      const farmWork = summarizeFarmWork(report.works)
      const sales = summarizeSales(report.sales)
      return {
        years: acc.years + 1,
        sessions: acc.sessions + farmWork.sessions,
        participants: acc.participants + farmWork.participants,
        saleUnits: acc.saleUnits + sales.units,
        saleAmount: acc.saleAmount + sales.amount,
      }
    },
    { years: 0, sessions: 0, participants: 0, saleUnits: 0, saleAmount: 0 },
  )
}
