/**
 * アクセスページの「食事・宿泊・交通」タブ — クライアント側 DOM 操作ロジック。
 * インライン script から呼ぶ処理を分離し、jsdom でテスト可能にする。
 *
 * これらのセクション (行き方 / 地図 / 食事 / 宿泊) は連続した読み物である必然性が
 * ないため、縦スクロールではなく横スライドのタブで一つずつ見せる。
 *
 * 期待する DOM 構造:
 *   [data-access-tabs]
 *     [role="tablist"]
 *       button[role="tab"][aria-controls="panel-<id>"]   … タブ
 *     .access-tabs__viewport
 *       .access-tabs__track                               … translateX で横移動
 *         section[role="tabpanel"][id="panel-<id>"]       … 各パネル
 *
 * JS が無くても全パネルが縦に並んで表示される (プログレッシブエンハンスメント)。
 */
export interface AccessTabsEls {
  tabs: HTMLElement[]
  viewport: HTMLElement
  track: HTMLElement
  panels: HTMLElement[]
}

/** ルート要素からタブ・パネル等を収集する。構造が欠けていれば null。 */
export function queryAccessTabs(root: ParentNode): AccessTabsEls | null {
  const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'))
  const viewport = root.querySelector<HTMLElement>('.access-tabs__viewport')
  const track = root.querySelector<HTMLElement>('.access-tabs__track')
  const panels = Array.from(
    root.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
  )
  if (!viewport || !track || tabs.length === 0 || panels.length === 0) {
    return null
  }
  return { tabs, viewport, track, panels }
}

/** index を [0, count-1] に丸める。 */
function clampIndex(index: number, count: number): number {
  if (index < 0) return 0
  if (index > count - 1) return count - 1
  return index
}

/**
 * 選択中パネルの高さにビューポートを合わせる。オフスクリーンのパネルは
 * translateX で退避しているだけでレイアウトは保たれるため offsetHeight を読める。
 * (jsdom では offsetHeight が 0 になるが、実ブラウザでのみ意味を持つ)
 */
export function syncHeight(els: AccessTabsEls, index: number): void {
  const panel = els.panels[clampIndex(index, els.panels.length)]
  if (panel) els.viewport.style.height = `${panel.offsetHeight}px`
}

/**
 * 指定したタブを選択状態にする。aria 属性・inert・トラックの translateX・高さを更新。
 * @returns 実際に選択されたインデックス (丸め後)
 */
export function activateTab(els: AccessTabsEls, index: number): number {
  const i = clampIndex(index, els.tabs.length)

  els.tabs.forEach((tab, n) => {
    const selected = n === i
    tab.setAttribute('aria-selected', selected ? 'true' : 'false')
    tab.tabIndex = selected ? 0 : -1
  })

  els.panels.forEach((panel, n) => {
    const active = n === i
    panel.setAttribute('aria-hidden', active ? 'false' : 'true')
    if (active) panel.removeAttribute('inert')
    else panel.setAttribute('inert', '')
  })

  els.track.style.transform = `translateX(-${i * 100}%)`
  els.track.dataset.active = String(i)
  syncHeight(els, i)
  return i
}

/** トラックが現在保持している選択インデックス。 */
export function activeIndex(els: AccessTabsEls): number {
  return Number(els.track.dataset.active ?? 0)
}

/**
 * tablist のキー操作 (WAI-ARIA tabs パターン) で移動先インデックスを返す。
 * 対象外のキーは null。左右で循環、Home/End で端へ。
 */
export function nextIndex(
  current: number,
  count: number,
  key: string,
): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
