import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import AccessMap from './AccessMap'
import {
  loadGoogleMaps,
  mapSearchUrl,
  type GoogleMapsApi,
  type MapPlace,
} from './googleMaps'

// 実スクリプトを読み込まずに、ローダの解決/失敗だけを差し替える。
vi.mock('./googleMaps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./googleMaps')>()
  return { ...actual, loadGoogleMaps: vi.fn() }
})

const mockedLoad = vi.mocked(loadGoogleMaps)

const place: MapPlace = {
  name: '下栗の里',
  lat: 35.3,
  lng: 137.9,
  address: '長野県飯田市上村下栗',
  query: '下栗1296',
}

function makeFakeMaps() {
  const addListener = vi.fn()
  const setContent = vi.fn()
  const open = vi.fn()
  const mapCtor = vi.fn()
  const markerCtor = vi.fn()
  const fitBounds = vi.fn()
  const boundsExtend = vi.fn()

  class FakeMap {
    fitBounds = fitBounds
    addListener = vi.fn(() => ({ remove: vi.fn() }))
    getZoom = () => 12
    setZoom = vi.fn()
    constructor(...args: unknown[]) {
      mapCtor(...args)
    }
  }
  class FakeMarker {
    addListener = addListener
    constructor(...args: unknown[]) {
      markerCtor(...args)
    }
  }
  class FakeInfoWindow {
    setContent = setContent
    open = open
  }
  class FakeLatLngBounds {
    extend = boundsExtend
  }

  const maps = {
    Map: FakeMap,
    Marker: FakeMarker,
    InfoWindow: FakeInfoWindow,
    LatLngBounds: FakeLatLngBounds,
    SymbolPath: { CIRCLE: 0 },
  } as unknown as GoogleMapsApi
  return {
    maps,
    mapCtor,
    markerCtor,
    addListener,
    setContent,
    open,
    fitBounds,
    boundsExtend,
  }
}

beforeEach(() => {
  mockedLoad.mockReset()
  // 診断用の console.error はテスト出力を汚さないよう抑制する。
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('AccessMap', () => {
  it('読み込み中はローディング表示を出す', () => {
    mockedLoad.mockReturnValue(new Promise(() => {}))
    render(
      <AccessMap
        apiKey="K"
        center={{ lat: 35.3, lng: 137.9 }}
        places={[place]}
      />,
    )
    expect(screen.getByText('地図を読み込んでいます…')).toBeInTheDocument()
  })

  it('読み込み成功で地図・マーカー・情報ウィンドウを生成する', async () => {
    const f = makeFakeMaps()
    mockedLoad.mockResolvedValue(f.maps)
    render(
      <AccessMap
        apiKey="K"
        center={{ lat: 35.3, lng: 137.9 }}
        zoom={13}
        places={[place]}
        openName="下栗の里"
      />,
    )

    await waitFor(() => expect(f.mapCtor).toHaveBeenCalledTimes(1))
    expect(f.mapCtor.mock.calls[0][1]).toMatchObject({
      center: { lat: 35.3, lng: 137.9 },
      zoom: 13,
      gestureHandling: 'cooperative',
    })
    expect(f.markerCtor).toHaveBeenCalledTimes(1)
    expect(f.addListener).toHaveBeenCalledWith('click', expect.any(Function))
    // openName のピンははじめから情報ウィンドウを開く
    expect(f.setContent).toHaveBeenCalledTimes(1)
    expect(f.open).toHaveBeenCalledTimes(1)
    // 単一ピンでは自動フィットしない
    expect(f.fitBounds).not.toHaveBeenCalled()
    expect(
      screen.queryByText('地図を読み込んでいます…'),
    ).not.toBeInTheDocument()
  })

  it('複数スポットは全ピンを立て、fitBounds で全体を収める', async () => {
    const f = makeFakeMaps()
    mockedLoad.mockResolvedValue(f.maps)
    const places: MapPlace[] = [
      { ...place, category: 'destination' },
      {
        name: 'かぐら山荘',
        lat: 35.29,
        lng: 137.9,
        query: '遠山郷 かぐら山荘',
        category: 'stay',
      },
    ]
    render(
      <AccessMap
        apiKey="K"
        center={{ lat: 35.3, lng: 137.9 }}
        places={places}
      />,
    )

    await waitFor(() => expect(f.markerCtor).toHaveBeenCalledTimes(2))
    expect(f.boundsExtend).toHaveBeenCalledTimes(2)
    expect(f.fitBounds).toHaveBeenCalledTimes(1)
  })

  it('読み込み失敗でフォールバックのリンクを出す', async () => {
    mockedLoad.mockRejectedValue(new Error('boom'))
    render(
      <AccessMap
        apiKey="K"
        center={{ lat: 35.3, lng: 137.9 }}
        places={[place]}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByText('地図を表示できませんでした。'),
      ).toBeInTheDocument(),
    )
    // 失敗理由 (エラーメッセージ) を画面にも出す
    expect(screen.getByText('boom')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Googleマップで開く' })
    expect(link).toHaveAttribute('href', mapSearchUrl('下栗1296'))
  })

  it('gm_authFailure 発火で認証エラーの案内を出す', async () => {
    mockedLoad.mockReturnValue(new Promise(() => {})) // ロードは保留のまま
    render(
      <AccessMap
        apiKey="K"
        center={{ lat: 35.3, lng: 137.9 }}
        places={[place]}
      />,
    )

    const w = window as typeof window & { gm_authFailure?: () => void }
    expect(typeof w.gm_authFailure).toBe('function')
    await act(async () => {
      w.gm_authFailure?.()
    })

    expect(screen.getByText(/認証エラー/)).toBeInTheDocument()
  })
})
