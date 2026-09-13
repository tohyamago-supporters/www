import { describe, it, expect, beforeEach } from 'vitest'
import { initSiteHeaderNav } from './siteHeaderNav'

// jsdom は PointerEvent を実装しないため、pointerType を持つ汎用イベントで代用する。
function firePointer(el: Element, type: string, pointerType: string) {
  const e = new Event(type, { bubbles: true })
  Object.defineProperty(e, 'pointerType', { value: pointerType })
  el.dispatchEvent(e)
}

// detail===0 をキーボード操作 (Enter/Space)、detail>0 をポインタ由来とみなす。
function fireClick(el: Element, detail: number) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }))
}

function fireFocusOut(el: Element, relatedTarget: Element | null) {
  const e = new Event('focusout', { bubbles: true })
  Object.defineProperty(e, 'relatedTarget', { value: relatedTarget })
  el.dispatchEvent(e)
}

function fireKey(el: Element, key: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

function setup() {
  document.body.innerHTML = `
    <header>
      <button data-menu-toggle aria-expanded="false">menu</button>
      <ul>
        <li class="group" data-name="know">
          <button data-dropdown-trigger aria-expanded="false">活動を知る</button>
          <ul><li><a href="/purpose">活動趣旨</a></li></ul>
        </li>
        <li class="group" data-name="support">
          <button data-dropdown-trigger aria-expanded="false">支える</button>
          <ul><li><a href="/support">寄付</a></li></ul>
        </li>
      </ul>
      <div data-mobile-nav hidden>
        <a href="/join">はじめての方へ</a>
      </div>
    </header>
  `
  initSiteHeaderNav(document)

  const lis = Array.from(
    document.querySelectorAll<HTMLLIElement>('li[data-name]'),
  )
  const dropdown = (name: string) => {
    const li = document.querySelector<HTMLLIElement>(`li[data-name="${name}"]`)!
    return {
      li,
      btn: li.querySelector<HTMLButtonElement>('[data-dropdown-trigger]')!,
      link: li.querySelector<HTMLAnchorElement>('a')!,
    }
  }
  return {
    lis,
    dropdown,
    menuToggle:
      document.querySelector<HTMLButtonElement>('[data-menu-toggle]')!,
    mobilePanel: document.querySelector<HTMLElement>('[data-mobile-nav]')!,
  }
}

const isOpen = (li: HTMLElement, btn: HTMLElement) =>
  li.hasAttribute('data-open') && btn.getAttribute('aria-expanded') === 'true'

describe('initSiteHeaderNav — ドロップダウン', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('マウスのホバーで開き、ポインタが離れると閉じる', () => {
    const { dropdown } = setup()
    const { li, btn } = dropdown('know')

    firePointer(li, 'pointerenter', 'mouse')
    expect(isOpen(li, btn)).toBe(true)

    firePointer(li, 'pointerleave', 'mouse')
    expect(isOpen(li, btn)).toBe(false)
  })

  // リグレッション: マウスでクリックしても開きっぱなしにならないこと。
  // (クリックが data-open を固定し、ポインタが離れても閉じなくなる不具合の防止)
  it('マウスではクリックしてもトグルされず、ポインタが離れれば閉じる', () => {
    const { dropdown } = setup()
    const { li, btn } = dropdown('know')

    // ホバーで開いた状態でクリックしても、閉じも固定もしない
    firePointer(li, 'pointerenter', 'mouse')
    firePointer(btn, 'pointerdown', 'mouse')
    fireClick(btn, 1)
    expect(isOpen(li, btn)).toBe(true)

    // ポインタが離れれば必ず閉じる (クリックで固定されていない)
    firePointer(li, 'pointerleave', 'mouse')
    expect(isOpen(li, btn)).toBe(false)
  })

  it('マウスのクリック単体ではドロップダウンを開かない', () => {
    const { dropdown } = setup()
    const { li, btn } = dropdown('know')

    firePointer(btn, 'pointerdown', 'mouse')
    fireClick(btn, 1)
    expect(isOpen(li, btn)).toBe(false)
  })

  it('タッチのタップでトグルし、pointerenter では開かない', () => {
    const { dropdown } = setup()
    const { li, btn } = dropdown('know')

    // タッチの pointerenter は開かない (マウスのみ反応)
    firePointer(li, 'pointerenter', 'touch')
    expect(isOpen(li, btn)).toBe(false)

    // タップで開く
    firePointer(btn, 'pointerdown', 'touch')
    fireClick(btn, 1)
    expect(isOpen(li, btn)).toBe(true)

    // もう一度タップで閉じる
    firePointer(btn, 'pointerdown', 'touch')
    fireClick(btn, 1)
    expect(isOpen(li, btn)).toBe(false)
  })

  it('キーボード操作 (detail===0) でトグルできる', () => {
    const { dropdown } = setup()
    const { li, btn } = dropdown('know')

    fireClick(btn, 0)
    expect(isOpen(li, btn)).toBe(true)

    fireClick(btn, 0)
    expect(isOpen(li, btn)).toBe(false)
  })

  it('フォーカスが項目の外へ移ると閉じる', () => {
    const { dropdown } = setup()
    const { li, btn, link } = dropdown('know')

    fireClick(btn, 0)
    expect(isOpen(li, btn)).toBe(true)

    // メニュー内へのフォーカス移動では閉じない
    fireFocusOut(btn, link)
    expect(isOpen(li, btn)).toBe(true)

    // メニュー外へフォーカスが移ると閉じる
    fireFocusOut(link, document.body)
    expect(isOpen(li, btn)).toBe(false)
  })

  it('Escape で閉じ、フォーカスをトリガーへ戻す', () => {
    const { dropdown } = setup()
    const { li, btn, link } = dropdown('know')

    fireClick(btn, 0)
    link.focus()
    expect(isOpen(li, btn)).toBe(true)

    fireKey(link, 'Escape')
    expect(isOpen(li, btn)).toBe(false)
    expect(document.activeElement).toBe(btn)
  })

  it('メニュー外をクリックすると開いているドロップダウンが閉じる', () => {
    const { dropdown, menuToggle } = setup()
    const { li, btn } = dropdown('know')

    fireClick(btn, 0)
    expect(isOpen(li, btn)).toBe(true)

    // ドロップダウン外 (ヘッダーの別要素) をクリック
    fireClick(menuToggle, 1)
    expect(isOpen(li, btn)).toBe(false)
  })
})

describe('initSiteHeaderNav — モバイルパネル', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('開閉ボタンでパネルがトグルし aria-expanded が同期する', () => {
    const { menuToggle, mobilePanel } = setup()

    expect(mobilePanel.hasAttribute('hidden')).toBe(true)

    fireClick(menuToggle, 1)
    expect(mobilePanel.hasAttribute('hidden')).toBe(false)
    expect(menuToggle.getAttribute('aria-expanded')).toBe('true')

    fireClick(menuToggle, 1)
    expect(mobilePanel.hasAttribute('hidden')).toBe(true)
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false')
  })

  // リグレッション: スクロールして閉じたあと開き直すと、前回のスクロール
  // 位置が残らず先頭に戻ること (直感に沿う初期状態で開く)。
  it('開き直すとスクロール位置が先頭に戻る', () => {
    const { menuToggle, mobilePanel } = setup()

    fireClick(menuToggle, 1) // 開く
    mobilePanel.scrollTop = 120 // 下までスクロールした状態を再現
    fireClick(menuToggle, 1) // 閉じる
    fireClick(menuToggle, 1) // 開き直す

    expect(mobilePanel.scrollTop).toBe(0)
  })

  it('Escape でモバイルパネルが閉じ、フォーカスが開閉ボタンへ戻る', () => {
    const { menuToggle, mobilePanel } = setup()

    fireClick(menuToggle, 1)
    expect(mobilePanel.hasAttribute('hidden')).toBe(false)

    fireKey(document.body, 'Escape')
    expect(mobilePanel.hasAttribute('hidden')).toBe(true)
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(menuToggle)
  })
})

describe('initSiteHeaderNav — スコープに要素を渡す', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  // 既定は document だが、Element を渡すとその配下だけを初期化し、
  // ownerDocument からドキュメント全体のハンドラ (外側クリック等) を張れること。
  it('渡した要素の配下でドロップダウンが動作する', () => {
    document.body.innerHTML = `
      <header id="scoped">
        <ul>
          <li class="group" data-name="know">
            <button data-dropdown-trigger aria-expanded="false">活動を知る</button>
            <ul><li><a href="/purpose">活動趣旨</a></li></ul>
          </li>
        </ul>
      </header>
    `
    const header = document.getElementById('scoped')!
    initSiteHeaderNav(header)

    const li = header.querySelector<HTMLLIElement>('li[data-name="know"]')!
    const btn = li.querySelector<HTMLButtonElement>('[data-dropdown-trigger]')!

    firePointer(li, 'pointerenter', 'mouse')
    expect(li.hasAttribute('data-open')).toBe(true)
    expect(btn.getAttribute('aria-expanded')).toBe('true')

    // ownerDocument に張られた外側クリックのハンドラで閉じる
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(li.hasAttribute('data-open')).toBe(false)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })
})
