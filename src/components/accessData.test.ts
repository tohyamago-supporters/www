import { describe, it, expect } from 'vitest'
import {
  DEST_QUERY,
  toyamagoArea,
  toyamagoBorder,
  toyamagoAreaLabels,
  mapCenter,
  restaurants,
  stays,
  mapPlaces,
  type Place,
} from './accessData'

// 各施設 (食事処・宿) が満たすべき最低限の形。地図ピンや一覧カードの描画が
// 壊れないよう、必須フィールドと緯度経度の妥当性を守る。
function expectValidPlace(p: Place) {
  expect(p.name).toBeTruthy()
  expect(p.area).toBeTruthy()
  expect(p.desc).toBeTruthy()
  expect(p.detail).toMatch(/^https?:\/\//)
  expect(p.map).toBeTruthy()
  // 遠山郷 (長野県飯田市南部) のおおよその緯度経度レンジ
  expect(p.lat).toBeGreaterThan(35)
  expect(p.lat).toBeLessThan(36)
  expect(p.lng).toBeGreaterThan(137)
  expect(p.lng).toBeLessThan(139)
}

describe('accessData の定数', () => {
  it('目的地・地図中心が遠山郷の座標系である', () => {
    expect(DEST_QUERY).toContain('下栗')
    expect(mapCenter.lat).toBeGreaterThan(35)
    expect(mapCenter.lat).toBeLessThan(36)
    expect(mapCenter.lng).toBeGreaterThan(137)
    expect(mapCenter.lng).toBeLessThan(139)
  })

  it('遠山郷エリアの外周は面を描ける頂点数と妥当な座標を持つ', () => {
    expect(toyamagoArea.length).toBeGreaterThanOrEqual(3)
    for (const point of toyamagoArea) {
      expect(point.lat).toBeGreaterThan(35)
      expect(point.lat).toBeLessThan(36)
      expect(point.lng).toBeGreaterThan(137)
      expect(point.lng).toBeLessThan(139)
    }
  })

  it('旧上村・旧南信濃の境は線を描ける頂点数と妥当な座標を持つ', () => {
    expect(toyamagoBorder.length).toBeGreaterThanOrEqual(2)
    for (const point of toyamagoBorder) {
      expect(point.lat).toBeGreaterThan(35)
      expect(point.lat).toBeLessThan(36)
      expect(point.lng).toBeGreaterThan(137)
      expect(point.lng).toBeLessThan(139)
    }
  })

  it('地区ラベルは旧上村・旧南信濃の 2 件で、遠山郷の座標系に置く', () => {
    expect(toyamagoAreaLabels.map((l) => l.text)).toEqual([
      '旧上村',
      '旧南信濃村',
    ])
    for (const label of toyamagoAreaLabels) {
      expect(label.lat).toBeGreaterThan(35)
      expect(label.lat).toBeLessThan(36)
      expect(label.lng).toBeGreaterThan(137)
      expect(label.lng).toBeLessThan(139)
    }
  })

  it('食事処・宿の各データが必須フィールドを満たす', () => {
    expect(restaurants.length).toBeGreaterThan(0)
    expect(stays.length).toBeGreaterThan(0)
    restaurants.forEach(expectValidPlace)
    stays.forEach(expectValidPlace)
  })
})

describe('mapPlaces (地図ピンの導出)', () => {
  it('食事処 → 宿の順に、施設ごとに 1 ピンを作る', () => {
    expect(mapPlaces).toHaveLength(restaurants.length + stays.length)
    const foods = mapPlaces.filter((p) => p.category === 'food')
    const lodgings = mapPlaces.filter((p) => p.category === 'stay')
    expect(foods).toHaveLength(restaurants.length)
    expect(lodgings).toHaveLength(stays.length)
    // 前半が食事処、後半が宿の並びであること
    expect(
      mapPlaces.slice(0, restaurants.length).map((p) => p.category),
    ).toEqual(restaurants.map(() => 'food'))
  })

  it('元データの名前・座標・検索クエリをピンへ引き継ぐ', () => {
    const first = restaurants[0]
    const pin = mapPlaces.find((p) => p.name === first.name)
    expect(pin).toBeDefined()
    expect(pin!.lat).toBe(first.lat)
    expect(pin!.lng).toBe(first.lng)
    expect(pin!.query).toBe(first.map)
    expect(pin!.category).toBe('food')
  })

  it('宿ピンの住所表記に地区名と「宿」を含める', () => {
    const stay = stays[0]
    const pin = mapPlaces.find((p) => p.name === stay.name)
    expect(pin).toBeDefined()
    expect(pin!.category).toBe('stay')
    expect(pin!.address).toContain(stay.area)
    expect(pin!.address).toContain('宿')
  })
})
