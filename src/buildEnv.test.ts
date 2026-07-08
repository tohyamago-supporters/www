import { describe, it, expect } from 'vitest'
import { isProductionBranch, resolveBuildEnv } from './buildEnv'

describe('isProductionBranch', () => {
  it('main は本番ブランチ', () => {
    expect(isProductionBranch('main')).toBe(true)
  })

  it('main 以外・未設定はプレビュー扱い', () => {
    expect(isProductionBranch('preview')).toBe(false)
    expect(isProductionBranch('feature/x')).toBe(false)
    expect(isProductionBranch(undefined)).toBe(false)
    expect(isProductionBranch('')).toBe(false)
  })
})

describe('resolveBuildEnv', () => {
  it('本番ブランチでは _PRODUCTION を採用する', () => {
    const resolved = resolveBuildEnv({
      WORKERS_CI_BRANCH: 'main',
      GA_MEASUREMENT_ID_PRODUCTION: 'G-PROD',
      GA_MEASUREMENT_ID_PREVIEW: 'G-PREV',
      PDFJS_EXPRESS_VIEWER_PRODUCTION: 'key-prod',
      PDFJS_EXPRESS_VIEWER_PREVIEW: 'key-prev',
      GOOGLE_MAPS_API_KEY_PRODUCTION: 'maps-prod',
      GOOGLE_MAPS_API_KEY_PREVIEW: 'maps-prev',
    })
    expect(resolved).toEqual({
      GA_MEASUREMENT_ID: 'G-PROD',
      PDFJS_EXPRESS_VIEWER: 'key-prod',
      GOOGLE_MAPS_API_KEY: 'maps-prod',
    })
  })

  it('非本番ブランチでは _PREVIEW を採用する', () => {
    const resolved = resolveBuildEnv({
      WORKERS_CI_BRANCH: 'some-feature',
      GA_MEASUREMENT_ID_PRODUCTION: 'G-PROD',
      GA_MEASUREMENT_ID_PREVIEW: 'G-PREV',
    })
    expect(resolved).toEqual({ GA_MEASUREMENT_ID: 'G-PREV' })
  })

  it('素の名前があれば最優先する (CI・手動上書き用)', () => {
    const resolved = resolveBuildEnv({
      WORKERS_CI_BRANCH: 'main',
      GA_MEASUREMENT_ID: 'G-EXPLICIT',
      GA_MEASUREMENT_ID_PRODUCTION: 'G-PROD',
    })
    expect(resolved.GA_MEASUREMENT_ID).toBe('G-EXPLICIT')
  })

  it('該当する値が無いキーは結果に含めない (undefined 代入事故の防止)', () => {
    // プレビューに GA を出さない運用 (_PREVIEW 未設定) を想定
    const resolved = resolveBuildEnv({
      WORKERS_CI_BRANCH: 'pr-branch',
      GA_MEASUREMENT_ID_PRODUCTION: 'G-PROD',
    })
    expect(resolved).not.toHaveProperty('GA_MEASUREMENT_ID')
    expect(resolved).toEqual({})
  })

  it('keys 引数で対象を限定できる', () => {
    const resolved = resolveBuildEnv(
      {
        WORKERS_CI_BRANCH: 'main',
        FOO_PRODUCTION: 'foo',
        BAR_PRODUCTION: 'bar',
      },
      ['FOO'],
    )
    expect(resolved).toEqual({ FOO: 'foo' })
  })
})
