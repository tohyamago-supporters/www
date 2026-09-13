import { describe, it, expect } from 'vitest'
import { resolvePdfViewer } from './pdfViewer'

describe('resolvePdfViewer', () => {
  const webViewer = () => Promise.resolve('instance')

  it('__esModule を尊重する相互運用の形 ({ default: fn }) を解決する', () => {
    expect(resolvePdfViewer({ default: webViewer })).toBe(webViewer)
  })

  it('Node 互換の相互運用の形 ({ default: { default: fn } }) を解決する', () => {
    // module.exports がそのまま default に載るため一段深くなるケース。
    // これを解決できずに定款ページのビューワーが起動しなくなった。
    const moduleExports = { __esModule: true, default: webViewer }
    expect(resolvePdfViewer({ default: moduleExports })).toBe(webViewer)
  })

  it('関数そのものを渡された場合はそのまま返す', () => {
    expect(resolvePdfViewer(webViewer)).toBe(webViewer)
  })

  it('関数に default が生えていてもその関数を優先する', () => {
    const fn = Object.assign(() => Promise.resolve('instance'), {
      default: webViewer,
    })
    expect(resolvePdfViewer(fn)).toBe(fn)
  })

  it('ビューワー関数が見つからなければ null を返す', () => {
    expect(resolvePdfViewer({})).toBeNull()
    expect(resolvePdfViewer(null)).toBeNull()
    expect(resolvePdfViewer(undefined)).toBeNull()
    expect(resolvePdfViewer({ default: {} })).toBeNull()
  })

  it('default が循環していても無限ループしない', () => {
    const circular: Record<string, unknown> = {}
    circular.default = circular
    expect(resolvePdfViewer(circular)).toBeNull()
  })
})
