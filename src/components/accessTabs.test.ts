import { describe, it, expect, beforeEach } from 'vitest'
import {
  queryAccessTabs,
  activateTab,
  activeIndex,
  nextIndex,
  syncHeight,
} from './accessTabs'

function setup() {
  document.body.innerHTML = `
    <div data-access-tabs>
      <div role="tablist">
        <button role="tab" id="tab-routes" aria-controls="panel-routes" aria-selected="true" tabindex="0">行き方</button>
        <button role="tab" id="tab-map" aria-controls="panel-map" aria-selected="false" tabindex="-1">地図</button>
        <button role="tab" id="tab-eat" aria-controls="panel-eat" aria-selected="false" tabindex="-1">食事</button>
        <button role="tab" id="tab-stay" aria-controls="panel-stay" aria-selected="false" tabindex="-1">宿泊</button>
      </div>
      <div class="access-tabs__viewport">
        <div class="access-tabs__track" data-active="0">
          <section role="tabpanel" id="panel-routes" aria-labelledby="tab-routes">routes</section>
          <section role="tabpanel" id="panel-map" aria-labelledby="tab-map">map</section>
          <section role="tabpanel" id="panel-eat" aria-labelledby="tab-eat">eat</section>
          <section role="tabpanel" id="panel-stay" aria-labelledby="tab-stay">stay</section>
        </div>
      </div>
    </div>`
  const root = document.querySelector<HTMLElement>('[data-access-tabs]')!
  return queryAccessTabs(root)!
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('queryAccessTabs', () => {
  it('必要な要素をすべて集める', () => {
    const els = setup()
    expect(els.tabs).toHaveLength(4)
    expect(els.panels).toHaveLength(4)
    expect(els.viewport).toBeTruthy()
    expect(els.track).toBeTruthy()
  })

  it('構造が欠けていれば null を返す', () => {
    document.body.innerHTML = `<div data-access-tabs></div>`
    const root = document.querySelector<HTMLElement>('[data-access-tabs]')!
    expect(queryAccessTabs(root)).toBeNull()
  })
})

describe('activateTab', () => {
  it('選択したタブだけ aria-selected=true・tabindex=0 になる', () => {
    const els = setup()
    activateTab(els, 2)
    expect(els.tabs.map((t) => t.getAttribute('aria-selected'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ])
    expect(els.tabs.map((t) => t.tabIndex)).toEqual([-1, -1, 0, -1])
  })

  it('非選択パネルを aria-hidden かつ inert にし、選択パネルは解除する', () => {
    const els = setup()
    activateTab(els, 1)
    expect(els.panels.map((p) => p.getAttribute('aria-hidden'))).toEqual([
      'true',
      'false',
      'true',
      'true',
    ])
    expect(els.panels.map((p) => p.hasAttribute('inert'))).toEqual([
      true,
      false,
      true,
      true,
    ])
  })

  it('トラックを translateX で横移動させ、選択位置を記録する', () => {
    const els = setup()
    activateTab(els, 3)
    expect(els.track.style.transform).toBe('translateX(-300%)')
    expect(activeIndex(els)).toBe(3)
  })

  it('範囲外のインデックスは端に丸める', () => {
    const els = setup()
    expect(activateTab(els, 99)).toBe(3)
    expect(activateTab(els, -5)).toBe(0)
  })
})

describe('syncHeight', () => {
  it('ビューポートに高さ (px) を設定する', () => {
    const els = setup()
    syncHeight(els, 0)
    expect(els.viewport.style.height).toMatch(/px$/)
  })
})

describe('nextIndex', () => {
  it('矢印キーで循環移動する', () => {
    expect(nextIndex(0, 4, 'ArrowRight')).toBe(1)
    expect(nextIndex(3, 4, 'ArrowRight')).toBe(0)
    expect(nextIndex(0, 4, 'ArrowLeft')).toBe(3)
    expect(nextIndex(2, 4, 'ArrowLeft')).toBe(1)
  })

  it('Home/End で端へ移動する', () => {
    expect(nextIndex(2, 4, 'Home')).toBe(0)
    expect(nextIndex(1, 4, 'End')).toBe(3)
  })

  it('対象外のキーは null', () => {
    expect(nextIndex(0, 4, 'Enter')).toBeNull()
    expect(nextIndex(0, 4, 'a')).toBeNull()
  })
})
