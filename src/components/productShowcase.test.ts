import { describe, it, expect } from 'vitest'
import {
  PRODUCT_SHOWCASE,
  resolveProducts,
  type ShowcaseCrop,
} from './productShowcase'

const crop = (over: Partial<ShowcaseCrop> & { id: string }): ShowcaseCrop => ({
  name: '作物',
  color: '#000000',
  order: 0,
  ...over,
})

describe('resolveProducts', () => {
  it('作物のブランド情報 (name / emoji / color) を補う', () => {
    const [product] = resolveProducts(
      [{ id: 'ocha', tagline: 't', story: [], makes: [], season: 's' }],
      [crop({ id: 'ocha', name: 'お茶', emoji: '🍵', color: '#2f8f6b' })],
    )
    expect(product).toMatchObject({
      name: 'お茶',
      emoji: '🍵',
      color: '#2f8f6b',
      tagline: 't',
    })
  })

  it('crops の order 順に並べる (ショーケースの記述順に依存しない)', () => {
    const item = (id: string) => ({
      id,
      tagline: '',
      story: [],
      makes: [],
      season: '',
    })
    const products = resolveProducts(
      [item('c'), item('a'), item('b')],
      [
        crop({ id: 'a', order: 1 }),
        crop({ id: 'b', order: 2 }),
        crop({ id: 'c', order: 3 }),
      ],
    )
    expect(products.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('対応する作物が無い ID はビルド時エラーにする (成果品が静かに消えない)', () => {
    expect(() =>
      resolveProducts(
        [{ id: 'unknown', tagline: '', story: [], makes: [], season: '' }],
        [crop({ id: 'ocha' })],
      ),
    ).toThrow(/unknown/)
  })
})

describe('PRODUCT_SHOWCASE', () => {
  it('ID が重複しない', () => {
    const ids = PRODUCT_SHOWCASE.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('各項目が物語・成果品・旬を持つ', () => {
    for (const item of PRODUCT_SHOWCASE) {
      expect(item.story.length).toBeGreaterThan(0)
      expect(item.makes.length).toBeGreaterThan(0)
      expect(item.season).not.toBe('')
    }
  })
})
