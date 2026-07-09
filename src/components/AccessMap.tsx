import { useEffect, useRef, useState } from 'react'
import {
  loadGoogleMaps,
  mapSearchUrl,
  MAP_STYLES,
  MARKER_STYLE,
  AREA_STYLE,
  AREA_BORDER_STYLE,
  AREA_LABEL_STYLE,
  placeInfoWindowContent,
  type MapPlace,
} from './googleMaps'

// 面に重ねる地区ラベル (旧村名) 1 件分。
export interface AreaLabel {
  text: string
  lat: number
  lng: number
}

interface Props {
  apiKey: string
  center: google.maps.LatLngLiteral
  zoom?: number
  places: MapPlace[]
  // 面 (遠山郷エリア) を示すポリゴンの頂点。指定時は塗りつぶし面を描く。
  area?: google.maps.LatLngLiteral[]
  // 面の中に破線で示す内部境界 (旧上村と旧南信濃村の境) の頂点。
  border?: google.maps.LatLngLiteral[]
  // 面に重ねる地区ラベル (旧村名)。
  labels?: AreaLabel[]
  // 最初から情報ウィンドウを開いておくピンの名前 (通常は目的地)。
  openName?: string
}

// アクセスページのインタラクティブ地図 (Maps JavaScript API)。キーレス埋め込みの
// iframe を置き換え、目的地ピン・情報ウィンドウ・ブランド配色・協調ジェスチャ
// (モバイルでページスクロールを奪わない) でアクセス案内の体感を上げる。
// 読み込み中・失敗時のフォールバック表示も持つ。
export default function AccessMap({
  apiKey,
  center,
  zoom = 13,
  places,
  area,
  border,
  labels,
  openName,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let cancelled = false

    const fail = (message: string) => {
      if (cancelled) return
      console.error('[AccessMap]', message)
      setDetail(message)
      setStatus('error')
    }

    // Google はキー/リファラ/使用API制限/未有効化/課金などの「認証」失敗時に
    // window.gm_authFailure を呼ぶ。これが発火したら原因はコードではなくキー設定側、
    // と切り分けられる (地図の読込自体は成功していても呼ばれる)。
    const w = window as typeof window & { gm_authFailure?: () => void }
    const prevAuthFailure = w.gm_authFailure
    w.gm_authFailure = () =>
      fail(
        '認証エラー: APIキーの制限（HTTPリファラ / 使用API）や、APIの有効化・課金設定をご確認ください',
      )

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled) return
        const map = new maps.Map(el, {
          center,
          zoom,
          styles: MAP_STYLES,
          mapTypeControl: false,
          streetViewControl: false,
          gestureHandling: 'cooperative',
        })
        const infoWindow = new maps.InfoWindow()
        const bounds = new maps.LatLngBounds()
        // エリア (遠山郷) の面を描き、範囲にも含める
        if (area && area.length > 0) {
          new maps.Polygon({ ...AREA_STYLE, paths: area, map })
          for (const point of area) bounds.extend(point)
        }
        // 旧上村と旧南信濃村の境を、面の中に破線で重ねる
        if (border && border.length > 0) {
          new maps.Polyline({ ...AREA_BORDER_STYLE, path: border, map })
        }
        // 旧村名のラベルを面の中に置く (絵柄なしの文字のみ)
        for (const label of labels ?? []) {
          new maps.Marker({
            map,
            position: { lat: label.lat, lng: label.lng },
            clickable: false,
            label: { ...AREA_LABEL_STYLE, text: label.text },
            icon: { path: maps.SymbolPath.CIRCLE, scale: 0 },
          })
        }
        for (const place of places) {
          const position = { lat: place.lat, lng: place.lng }
          const style = MARKER_STYLE[place.category ?? 'destination']
          const marker = new maps.Marker({
            map,
            position,
            title: place.name,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: style.color,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: style.scale,
            },
          })
          bounds.extend(position)
          const open = () => {
            infoWindow.setContent(placeInfoWindowContent(place))
            infoWindow.open({ map, anchor: marker })
          }
          marker.addListener('click', open)
          if (openName && place.name === openName) open()
        }
        // 複数ピンやエリアがある時は全体が画面に収まるよう自動フィット (寄りすぎは抑制)
        if (places.length > 1 || (area && area.length > 0)) {
          map.fitBounds(bounds, 48)
          const listener = map.addListener('idle', () => {
            const z = map.getZoom()
            if (z !== undefined && z > 15) map.setZoom(15)
            listener.remove()
          })
        }
        setStatus('ready')
      })
      .catch((error: unknown) =>
        fail(error instanceof Error ? error.message : String(error)),
      )

    return () => {
      cancelled = true
      w.gm_authFailure = prevAuthFailure
    }
  }, [apiKey, center, zoom, places, area, border, labels, openName])

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="下栗の里と周辺の地図"
      />
      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary-soft/10 text-sm text-body/70">
          地図を読み込んでいます…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-primary-soft/10 px-4 text-center text-sm text-body/80">
          <p>地図を表示できませんでした。</p>
          {detail && <p className="max-w-xs text-xs text-body/60">{detail}</p>}
          <a
            href={mapSearchUrl(places[0]?.query ?? '下栗の里')}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent-strong underline underline-offset-4"
          >
            Googleマップで開く
          </a>
        </div>
      )}
    </div>
  )
}
