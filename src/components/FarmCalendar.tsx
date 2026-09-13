import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

// useSyncExternalStore 用: 現在月は変化を購読する必要がないため何もしない。
const subscribeNoop = () => () => {}

/**
 * FarmCalendar — 農作業ガントチャート (React island)。
 *
 * 横軸＝1〜12 月 (旬粒度＝36 列: 各月 上旬/中旬/下旬)、縦軸＝作物。各作業を
 * 1 作業 1 行の期間バーで表示し、地域イベントを別レーンに重畳する。当月を
 * ハイライトし「今・近いうちに行う作業」へ視線を誘導する。
 *
 * - モバイルでバー幅が狭くても読めるよう、ラベルはバーの中ではなく横に置く。
 * - 月ごとの縦線と作物ごとの横区切り線で見やすくする。
 * - どの作業もボランティア歓迎のため、強調表示はせず「作業強度の目安」を示す。
 * - バーをタップするとその付近にポップオーバーで詳細＋参加 CTA を表示する。
 *
 * データは calendar.astro が getCollection('crops'|'events') で取得し props で渡す。
 */

export type Intensity = 'light' | 'medium' | 'hard'

export interface CalendarTask {
  label: string
  start: number
  end: number
  intensity: Intensity
  note?: string
}

export interface CalendarCrop {
  id: string
  name: string
  emoji?: string
  color: string
  order: number
  tasks: CalendarTask[]
}

export interface CalendarEvent {
  id: string
  name: string
  start: number
  end: number
  category: string
  location?: string
  url?: string
  note?: string
}

/** 12 月 × 3 旬 = 36 列。 */
export const MONTH_COLUMNS = 36

export const INTENSITY_META: Record<
  Intensity,
  { label: string; level: number }
> = {
  light: { label: '軽め', level: 1 },
  medium: { label: 'ふつう', level: 2 },
  hard: { label: 'しっかり', level: 3 },
}

/** 月.旬 (整数=上旬, .1=中旬, .2=下旬) を 1〜36 のグリッド列 (開始) に変換する。 */
export function startColumn(monthThird: number): number {
  const month = Math.floor(monthThird)
  const third = Math.round((monthThird - month) * 10) // 0 / 1 / 2
  return (month - 1) * 3 + third + 1
}

/** その旬セルを塗りつぶす grid-column 終端 (排他的) に変換する。 */
export function endColumn(monthThird: number): number {
  return startColumn(monthThird) + 1
}

/** 月.旬を「N月上旬 / N月中旬 / N月下旬」の表記に変換する。 */
export function formatMonthPart(monthThird: number): string {
  const month = Math.floor(monthThird)
  const third = Math.round((monthThird - month) * 10)
  const part = ['上旬', '中旬', '下旬'][third]
  return `${month}月${part}`
}

/** start〜end の期間表記。単一の旬なら 1 つだけ返す。 */
export function formatPeriod(start: number, end: number): string {
  return start === end
    ? formatMonthPart(start)
    : `${formatMonthPart(start)}〜${formatMonthPart(end)}`
}

/**
 * バーのラベルを左右どちらに置くか。年末 (11 月以降に終わる) バーは右へ出すと
 * 見切れるため左側に置く。
 */
export function labelOnLeft(end: number): boolean {
  return endColumn(end) >= 32
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)

/** バー (作業/イベント) の grid-column。ラベル列ぶん +1 する。 */
function barColumn(start: number, end: number): string {
  return `${1 + startColumn(start)} / ${1 + endColumn(end)}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

type SelectedTask = {
  cropName: string
  emoji?: string
  color: string
  task: CalendarTask
}

interface Props {
  crops: CalendarCrop[]
  events: CalendarEvent[]
  /** テスト用に当月を固定できる (1〜12)。既定は実行時の現在月。 */
  currentMonth?: number
}

export default function FarmCalendar({
  crops = [],
  events = [],
  currentMonth,
}: Props) {
  const detailId = useId()
  const [detail, setDetail] = useState<{
    data: SelectedTask
    rect: DOMRect
    trigger: HTMLButtonElement | null
  } | null>(null)

  // 現在月は SSR (ビルド時) と CSR (閲覧時) で結果が変わりハイドレーション
  // ミスマッチを招く。useSyncExternalStore でサーバーでは null、クライアント
  // ではマウント後に当月を返すことで、警告なく安全に切り替える。
  // テストでは currentMonth で固定できる。
  const activeMonth = useSyncExternalStore(
    subscribeNoop,
    () => currentMonth ?? new Date().getMonth() + 1,
    () => currentMonth ?? null,
  )

  // 詳細ポップオーバーを閉じる。開いたバーへフォーカスを戻す (a11y)。
  const closeDetail = () => {
    detail?.trigger?.focus()
    setDetail(null)
  }

  // 1 作業 1 行で行配置を計算する (各ブロックは直前ブロックの末尾から積み上げる)。
  // 行 1 は月ヘッダー。
  const prepared = [...crops]
    .sort((a, b) => a.order - b.order)
    .map((crop) => {
      const tasks = [...crop.tasks].sort(
        (a, b) => a.start - b.start || a.end - b.end,
      )
      return { crop, tasks, rowCount: Math.max(1, tasks.length) }
    })
  const cropBlocks = prepared.map((block, i) => ({
    ...block,
    startRow: prepared.slice(0, i).reduce((row, b) => row + b.rowCount, 2),
  }))
  const eventList = [...events].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  )
  const eventStartRow = prepared.reduce((row, b) => row + b.rowCount, 2)
  const eventBlock = {
    events: eventList,
    rowCount: Math.max(1, eventList.length),
    startRow: eventStartRow,
  }
  const lastRow = eventStartRow + eventBlock.rowCount

  // 作物・イベントブロックの境界となる行 (横区切り線を引く位置)。
  const boundaryRows = [
    ...cropBlocks.map((b) => b.startRow),
    eventBlock.startRow,
    lastRow,
  ]

  // 当月の 3 列 (上旬・中旬・下旬) を覆うハイライト帯の grid-column。ラベル列ぶん +1。
  const bandColumn = activeMonth ? `${2 + (activeMonth - 1) * 3} / span 3` : ''

  const isSelected = (cropName: string, task: CalendarTask) =>
    detail?.data.cropName === cropName && detail?.data.task.label === task.label

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div
          className="grid min-w-[52rem] items-stretch"
          style={{
            gridTemplateColumns: `minmax(5rem, max-content) repeat(${MONTH_COLUMNS}, minmax(0.7rem, 1fr))`,
            gridAutoRows: '2.5rem',
          }}
        >
          {/* 当月ハイライト帯 (ヘッダー下から最下行まで) */}
          {activeMonth && (
            <div
              data-testid="current-month-band"
              aria-hidden="true"
              className="pointer-events-none rounded-md bg-sunlight-soft/50"
              style={{ gridColumn: bandColumn, gridRow: `2 / ${lastRow}` }}
            />
          )}

          {/* 月ごとの縦グリッド線 */}
          {MONTH_LABELS.map((label, i) => (
            <div
              key={`vline-${label}`}
              aria-hidden="true"
              className="pointer-events-none border-l border-primary/10"
              style={{ gridColumn: 2 + i * 3, gridRow: `1 / ${lastRow}` }}
            />
          ))}
          {/* 右端の閉じ線 */}
          <div
            aria-hidden="true"
            className="pointer-events-none border-r border-primary/10"
            style={{ gridColumn: '37 / 38', gridRow: `1 / ${lastRow}` }}
          />

          {/* 作物・イベントの横区切り線 (ラベル列まで貫通させるため最前面に描く) */}
          {boundaryRows.map((row) => (
            <div
              key={`hline-${row}`}
              aria-hidden="true"
              className="pointer-events-none z-30 self-start border-t border-primary/15"
              style={{ gridColumn: '1 / -1', gridRow: row }}
            />
          ))}

          {/* ヘッダー: 月ラベル */}
          <div className="sticky left-0 z-20 bg-base" style={{ gridRow: 1 }} />
          {MONTH_LABELS.map((label, i) => (
            <div
              key={label}
              className={`flex items-end justify-center pb-1 font-serif text-xs ${
                activeMonth != null && i + 1 === activeMonth
                  ? 'font-medium text-accent-strong'
                  : 'text-primary/70'
              }`}
              style={{ gridColumn: `${2 + i * 3} / span 3`, gridRow: 1 }}
            >
              {label}
            </div>
          ))}

          {/* 作物の行 */}
          {cropBlocks.map(({ crop, tasks, rowCount, startRow }) => (
            <div key={crop.id} style={{ display: 'contents' }}>
              <div
                className="sticky left-0 z-20 flex items-center gap-1 bg-base pr-2 text-sm text-body"
                style={{
                  gridColumn: 1,
                  gridRow: `${startRow} / span ${rowCount}`,
                }}
              >
                {crop.emoji && (
                  <span aria-hidden="true" className="text-base">
                    {crop.emoji}
                  </span>
                )}
                <span className="font-serif">{crop.name}</span>
              </div>
              {tasks.map((task, i) => (
                <TaskBar
                  key={`${crop.id}-${task.label}-${task.start}`}
                  crop={crop}
                  task={task}
                  row={startRow + i}
                  selected={isSelected(crop.name, task)}
                  detailId={detailId}
                  onSelect={setDetail}
                />
              ))}
            </div>
          ))}

          {/* イベントレーン */}
          <div
            className="sticky left-0 z-20 flex items-center bg-base pr-2 text-sm text-body"
            style={{
              gridColumn: 1,
              gridRow: `${eventBlock.startRow} / span ${eventBlock.rowCount}`,
            }}
          >
            <span className="font-serif">季節の催し</span>
          </div>
          {eventBlock.events.map((event, i) => (
            <EventBar
              key={event.id}
              event={event}
              row={eventBlock.startRow + i}
            />
          ))}
        </div>
      </div>

      {/* 凡例 */}
      <Legend crops={cropBlocks.map((b) => b.crop)} />

      {/* タップした作業の詳細 (タップ位置の近くにポップオーバー表示) */}
      {detail && (
        <TaskPopover
          id={detailId}
          detail={detail.data}
          rect={detail.rect}
          onClose={closeDetail}
        />
      )}
    </div>
  )
}

function IntensityDots({ level }: { level: number }) {
  return (
    <span className="tracking-tight">
      <span className="text-accent-strong">{'●'.repeat(level)}</span>
      <span className="text-primary/25">{'●'.repeat(3 - level)}</span>
    </span>
  )
}

/** バーの横に置くラベル。狭いバーでも読めるよう、バーの外側へオーバーフローさせる。 */
function BarLabel({ end, children }: { end: number; children: ReactNode }) {
  const left = labelOnLeft(end)
  return (
    <span
      className={`absolute top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap text-xs text-body ${
        left
          ? 'right-full mr-1.5 flex-row-reverse text-right'
          : 'left-full ml-1.5'
      }`}
    >
      {children}
    </span>
  )
}

function TaskBar({
  crop,
  task,
  row,
  selected,
  detailId,
  onSelect,
}: {
  crop: CalendarCrop
  task: CalendarTask
  row: number
  selected: boolean
  detailId: string
  onSelect: (s: {
    data: SelectedTask
    rect: DOMRect
    trigger: HTMLButtonElement
  }) => void
}) {
  const meta = INTENSITY_META[task.intensity]
  return (
    <button
      type="button"
      data-testid="task-bar"
      data-intensity={task.intensity}
      aria-haspopup="dialog"
      aria-controls={detailId}
      aria-expanded={selected}
      aria-label={`${crop.name} ${task.label}（${formatPeriod(task.start, task.end)}・作業強度 ${meta.label}）`}
      onClick={(e) =>
        onSelect({
          data: {
            cropName: crop.name,
            emoji: crop.emoji,
            color: crop.color,
            task,
          },
          rect: e.currentTarget.getBoundingClientRect(),
          trigger: e.currentTarget,
        })
      }
      className={`relative my-1 flex h-6 items-center justify-center self-center overflow-visible rounded-full transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        selected ? 'ring-2 ring-accent ring-offset-1' : ''
      }`}
      style={{
        backgroundColor: crop.color,
        gridColumn: barColumn(task.start, task.end),
        gridRow: row,
      }}
    >
      <BarLabel end={task.end}>
        <span>{task.label}</span>
        <span
          aria-hidden="true"
          className="text-[0.6rem] leading-none"
          title={`作業強度: ${meta.label}`}
        >
          <IntensityDots level={meta.level} />
        </span>
      </BarLabel>
    </button>
  )
}

function EventBar({ event, row }: { event: CalendarEvent; row: number }) {
  // 単発の行事 (start === end) は ◆ マークのみ、期間のある行事は塗りバー (四角)。
  const single = event.start === event.end
  return (
    <div
      data-testid="event-bar"
      data-single={single}
      title={event.note}
      className={`relative my-1 flex h-6 items-center self-center overflow-visible text-xs ${
        single
          ? 'justify-center text-sky'
          : 'justify-center rounded-none bg-sky text-white'
      }`}
      style={{ gridColumn: barColumn(event.start, event.end), gridRow: row }}
    >
      {single && (
        <span aria-hidden="true" className="text-sm leading-none">
          ◆
        </span>
      )}
      <BarLabel end={event.end}>{event.name}</BarLabel>
    </div>
  )
}

function Legend({ crops }: { crops: CalendarCrop[] }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-body">
      {crops.map((crop) => (
        <span key={crop.id} className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: crop.color }}
          />
          {crop.emoji} {crop.name}
        </span>
      ))}
      <span className="flex items-center gap-1">
        作業強度:
        {(['light', 'medium', 'hard'] as const).map((key) => (
          <span key={key} className="flex items-center gap-0.5">
            <IntensityDots level={INTENSITY_META[key].level} />
            {INTENSITY_META[key].label}
          </span>
        ))}
      </span>
      <span className="flex items-center gap-1">
        <span aria-hidden="true" className="text-sky">
          ◆
        </span>
        <span aria-hidden="true" className="inline-block h-3 w-4 bg-sky" />
        季節の催し
      </span>
    </div>
  )
}

function TaskPopover({
  id,
  detail,
  rect,
  onClose,
}: {
  id: string
  detail: SelectedTask
  rect: DOMRect
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{
    left: number
    top: number
    width: number
    arrowLeft: number
    below: boolean
  } | null>(null)

  // 実際の高さを測ってからタップ位置の近くに配置する (画面外にはみ出さないよう調整)。
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(320, vw - 24)
    const height = el.offsetHeight
    const centerX = rect.left + rect.width / 2
    const left = clamp(centerX - width / 2, 12, Math.max(12, vw - width - 12))
    const spaceBelow = vh - rect.bottom
    const below = spaceBelow >= height + 14 || spaceBelow >= rect.top
    const top = below
      ? clamp(rect.bottom + 10, 12, Math.max(12, vh - height - 12))
      : clamp(rect.top - 10 - height, 12, Math.max(12, vh - height - 12))
    const arrowLeft = clamp(centerX - left, 18, width - 18)
    setPos({ left, top, width, arrowLeft, below })
  }, [rect])

  // フォーカス移動・Escape・スクロール/リサイズで閉じる。
  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const { cropName, emoji, color, task } = detail
  const meta = INTENSITY_META[task.intensity]

  return createPortal(
    <>
      {/* 背景タップで閉じる (カレンダーは透けたまま) */}
      <div
        className="fixed inset-0 z-40 bg-black/5"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={ref}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={`${cropName} ${task.label}`}
        tabIndex={-1}
        className="fixed z-50 rounded-2xl border border-primary/10 bg-surface p-4 shadow-xl outline-none"
        style={{
          left: pos?.left ?? rect.left,
          top: pos?.top ?? rect.bottom + 10,
          width: pos?.width ?? 320,
          maxHeight: 'calc(100dvh - 24px)',
          overflowY: 'auto',
          visibility: pos ? 'visible' : 'hidden',
          borderTopColor: color,
          borderTopWidth: '4px',
        }}
      >
        {/* タップしたバーを指す小さな三角 */}
        {pos && (
          <span
            aria-hidden="true"
            className="absolute h-3 w-3 rotate-45 border-primary/10 bg-surface"
            style={
              pos.below
                ? {
                    left: pos.arrowLeft,
                    top: -6,
                    borderTopWidth: 1,
                    borderLeftWidth: 1,
                  }
                : {
                    left: pos.arrowLeft,
                    bottom: -6,
                    borderBottomWidth: 1,
                    borderRightWidth: 1,
                  }
            }
          />
        )}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-serif text-base text-primary">
              {emoji} {cropName}・{task.label}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-body/80">
              <span>{formatPeriod(task.start, task.end)}</span>
              <span className="flex items-center gap-1 rounded-full bg-base px-2 py-0.5 text-xs">
                <span aria-hidden="true">
                  <IntensityDots level={meta.level} />
                </span>
                作業強度 {meta.label}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="-mr-1 -mt-1 shrink-0 rounded-full px-2 py-1 text-body/50 hover:text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>
        {task.note && (
          <p className="mt-3 text-sm leading-relaxed text-body">{task.note}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/join"
            className="inline-flex items-center justify-center rounded-full bg-accent-strong px-5 py-2 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            参加の流れを見る
          </a>
          <a
            href="https://activo.jp/s/a/119414"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-accent-strong px-5 py-2 text-sm font-medium text-accent-strong transition-colors hover:bg-accent-strong hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            募集を見る
          </a>
        </div>
      </div>
    </>,
    document.body,
  )
}
