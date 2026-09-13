/// <reference types="google.maps" />

// Maps JavaScript API まわりの純粋関数とローダ。インタラクティブ地図 (AccessMap.tsx)
// と Astro 側 (access.astro) で共有する。DOM/外部スクリプトに触れない関数はここで
// テストし、React 島はこの薄い土台の上に乗せる。

// 地図リンク (検索 / 経路) の URL を組み立てる純粋関数。情報ウィンドウや各カードの
// 「地図」リンクで共有する。API キー不要の公開 URL なので、地図が出せない環境でも着地する。
export function mapSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function directionsUrl(query: string, travelmode = 'driving'): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=${travelmode}`
}

// ピンの種別。色分け・凡例に使う。
export type PlaceCategory = 'destination' | 'food' | 'stay'

// 地図に立てるピン (目的地・食事処・宿など) 1 件分の情報。
export interface MapPlace {
  name: string
  lat: number
  lng: number
  address?: string
  // 地図 / 経路リンクに使う検索クエリ (通常は住所か施設名)。座標が多少ずれても
  // このクエリで開けば正しい場所に着地する。
  query: string
  category?: PlaceCategory
}

// カテゴリ別のピン配色。目的地は大きめ・差し色、食事はアンバー、宿はグリーン。
// 凡例 (access.astro) と色を合わせること。
export const MARKER_STYLE: Record<
  PlaceCategory,
  { color: string; scale: number }
> = {
  destination: { color: '#c2410c', scale: 9 },
  food: { color: '#b45309', scale: 6.5 },
  stay: { color: '#1f6f43', scale: 6.5 },
}

// エリア (遠山郷) をふんわり示す面のスタイル。凡例の色と合わせること。
export const AREA_STYLE: google.maps.PolygonOptions = {
  strokeColor: '#1f6f43',
  strokeOpacity: 0.7,
  strokeWeight: 2,
  fillColor: '#2f7d4f',
  fillOpacity: 0.12,
  clickable: false,
}

// 面に重ねる旧村名ラベルのスタイル。ピンの絵柄は出さず (scale 0) 文字だけを置く。
export const AREA_LABEL_STYLE: google.maps.MarkerLabel = {
  color: '#14532d',
  fontSize: '12px',
  fontWeight: '700',
  text: '',
}

// Maps JavaScript API ローダ <script> の URL を組み立てる純粋関数。
export interface LoaderOptions {
  language?: string
  region?: string
  libraries?: readonly string[]
  // 準備完了時に呼ばれるグローバル関数名。loading=async のときは callback を
  // 指定し、その発火 (= 初期化完了) を待ってから google.maps.* を使う。
  callback?: string
}

export function googleMapsLoaderUrl(
  apiKey: string,
  options: LoaderOptions = {},
): string {
  const params = new URLSearchParams({
    key: apiKey,
    v: 'weekly',
    loading: 'async',
  })
  if (options.libraries && options.libraries.length > 0) {
    params.set('libraries', options.libraries.join(','))
  }
  if (options.language) params.set('language', options.language)
  if (options.region) params.set('region', options.region)
  if (options.callback) params.set('callback', options.callback)
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 情報ウィンドウ (ピンのクリックで開く吹き出し) の HTML。施設名・住所と、経路 /
// 地図リンクを表示する。InfoWindow は文字列 HTML を受け取るため、念のため施設名等は
// エスケープしておく。
export function placeInfoWindowContent(place: MapPlace): string {
  const address = place.address
    ? `<p style="margin:0 0 8px;color:#4b5563;font-size:13px;line-height:1.5;">${escapeHtml(place.address)}</p>`
    : ''
  return [
    '<div style="max-width:230px;font-family:inherit;">',
    `<p style="margin:0 0 4px;font-weight:600;color:#1f3a2e;font-size:15px;">${escapeHtml(place.name)}</p>`,
    address,
    '<p style="margin:0;display:flex;flex-wrap:wrap;gap:10px;font-size:13px;">',
    `<a href="${directionsUrl(place.query)}" target="_blank" rel="noopener noreferrer" style="color:#b45309;font-weight:600;">ルートを調べる</a>`,
    `<a href="${mapSearchUrl(place.query)}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43;font-weight:600;">Googleマップで開く</a>`,
    '</p>',
    '</div>',
  ].join('')
}

// ブランドカラー (緑) に寄せた控えめな地図スタイル。観光スポット等のラベルを抑え、
// 自然・水・道路を落ち着いた色みに整える。
export const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#d7e7cd' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#eef3e9' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#aecbd6' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#cdd6c5' }],
  },
]

// 地図描画に使う Maps JavaScript API のクラス群。呼び出し側は new api.Map(...)
// のように使う。
export interface GoogleMapsApi {
  Map: typeof google.maps.Map
  Marker: typeof google.maps.Marker
  InfoWindow: typeof google.maps.InfoWindow
  Polygon: typeof google.maps.Polygon
  LatLngBounds: typeof google.maps.LatLngBounds
  SymbolPath: typeof google.maps.SymbolPath
}

// 準備完了コールバックのグローバル関数名 (loading=async の初期化完了通知)。
const CALLBACK_NAME = '__accessMapGmapsInit__'

// 同一ページ内での多重読み込みを防ぐためのキャッシュ。複数の島から呼ばれても
// <script> は 1 度だけ挿入し、同じ Promise を共有する。
let loaderPromise: Promise<GoogleMapsApi> | null = null

/**
 * Maps JavaScript API を一度だけ読み込み、描画に使うクラス (Map / Marker /
 * InfoWindow) を解決して返す。`loading=async` では読込直後まだクラスが生えて
 * いないため、Google 推奨どおり callback (初期化完了通知) の発火を待ってから
 * google.maps.* を参照する。失敗時は reject し、キャッシュを捨てて再試行できる
 * ようにする。
 *
 * @param apiKey ブラウザ用 API キー
 * @param doc テスト用に差し替え可能な document (既定は実 document)
 */
export function loadGoogleMaps(
  apiKey: string,
  doc: Document = document,
): Promise<GoogleMapsApi> {
  if (loaderPromise) return loaderPromise

  loaderPromise = ensureLoaded(apiKey, doc)
    .then(() => {
      if (
        typeof google === 'undefined' ||
        typeof google.maps?.Map !== 'function'
      ) {
        throw new Error('Google Maps の初期化に失敗しました')
      }
      return {
        Map: google.maps.Map,
        Marker: google.maps.Marker,
        InfoWindow: google.maps.InfoWindow,
        Polygon: google.maps.Polygon,
        LatLngBounds: google.maps.LatLngBounds,
        SymbolPath: google.maps.SymbolPath,
      }
    })
    .catch((error: unknown) => {
      loaderPromise = null // 失敗時は次回リトライできるよう捨てる
      throw error
    })
  return loaderPromise
}

// Maps JavaScript API の <script> を一度だけ挿入し、初期化完了 (callback 発火)
// を待つ。既に読み込み済みなら即時解決する。
function ensureLoaded(apiKey: string, doc: Document): Promise<void> {
  if (typeof google !== 'undefined' && typeof google.maps?.Map === 'function') {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const globals = window as typeof window & Record<string, unknown>
    globals[CALLBACK_NAME] = () => {
      delete globals[CALLBACK_NAME]
      resolve()
    }
    const script = doc.createElement('script')
    script.src = googleMapsLoaderUrl(apiKey, {
      language: 'ja',
      region: 'JP',
      callback: CALLBACK_NAME,
    })
    script.async = true
    script.addEventListener('error', () => {
      reject(new Error('Google Maps スクリプトの読み込みに失敗しました'))
    })
    doc.head.appendChild(script)
  })
}
