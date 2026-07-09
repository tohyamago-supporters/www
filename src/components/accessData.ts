/**
 * アクセス系ページ (交通案内 /access・食べる/泊まる /eat-stay) が共有するデータ。
 * 食事処・宿・地図ピン・遠山郷エリアの外周など、複数ページで同じものを使う定数を集約する。
 * (ルート = 行き方の一覧は交通案内ページ固有のため access.astro 側に置く)
 */
import type { MapPlace } from './googleMaps'

// 行き方の目的地・経路リンクは主な活動エリアの下栗を基準にする。集合場所は応募後に案内。
export const DEST_QUERY = '長野県飯田市上村下栗1296'

// 遠山郷エリア (旧上村＋旧南信濃村) を面で示すための外周。行政界そのものではなく
// 「このあたり一帯が遠山郷」を示す概略。東縁は長野・静岡県境の稜線＝実座標が確実な
// 主要ピーク (赤石岳・聖岳・光岳・黒法師岳) に固定し、北・西・南は境界図
// (Google マップの点線) と周辺地名から近似した。細かなギザギザは再現していないため
// 数 km 程度の誤差がある。正確な形にするには行政界の GeoJSON/KML を頂点へ流し込む。
// 頂点は外周を時計回り (北 → 東の稜線 → 南 → 西 → 北) に並べる。
export const toyamagoArea = [
  { lat: 35.455, lng: 138.01 }, // 上村 北 (R152 最上部付近)
  { lat: 35.4606, lng: 138.1583 }, // 赤石岳付近 (北東の稜線)
  { lat: 35.4183, lng: 138.1417 }, // 聖岳
  { lat: 35.3367, lng: 138.1533 }, // 光岳
  { lat: 35.2894, lng: 138.0903 }, // 黒法師岳 (南東の稜線)
  { lat: 35.272, lng: 137.985 }, // 八重河内 南
  { lat: 35.284, lng: 137.905 }, // 南和田 南 (国盗り公園方面)
  { lat: 35.302, lng: 137.867 }, // 南和田 西 (天龍村・為栗寄り)
  { lat: 35.34, lng: 137.878 }, // 和田 西 (為栗・温田方面)
  { lat: 35.405, lng: 137.918 }, // 上村・南信濃 西境 (泰阜村寄り)
  { lat: 35.44, lng: 137.958 }, // 上村 北西
]

// 地図の初期中心 (自動フィット前の一時的な中心)。遠山郷のおおよその中央。
export const mapCenter = { lat: 35.343, lng: 137.977 }

export interface Place {
  name: string
  area: string
  desc: string
  info?: string
  detail: string
  map: string
  lat: number
  lng: number
}

// 食事処。当会の参加者がよく利用する 2 軒をおすすめとして主に紹介する。
// （価格・営業時間・電話番号など変動・管理負荷の大きい情報は載せず、詳細は各施設の
//  「詳しく見る」リンク先で確認してもらう。info には所在地など安定した情報だけを添える）
// lat/lng は地図ピン用 (Google マップ上の各施設位置)。
export const restaurants: Place[] = [
  {
    name: '食事処 いっ福',
    area: '下栗',
    desc: '下栗の郷土料理を味わえる食事処。旬の野菜や採れたて山菜の天ぷらが付く「いっ福定食」が名物です。',
    info: '飯田市上村下栗',
    detail: 'https://tohyamago.com/archives/14052',
    map: '長野県飯田市上村下栗 いっ福',
    lat: 35.3730318,
    lng: 137.983029,
  },
  {
    name: '豊坂屋',
    area: '程野',
    desc: '古民家でいただく、上村・遠山郷の郷土料理たっぷりの定食。同じ店内でカフェメニューもいただけ、季節のパフェやドリンクも楽しめます。',
    info: '営業日はInstagramの営業カレンダーをご確認ください（飯田市上村程野）',
    detail: 'https://www.instagram.com/toyosakaya.129/',
    map: '長野県飯田市上村程野 豊坂屋',
    lat: 35.4337973,
    lng: 137.9866986,
  },
]

// 宿泊施設。こちらも参加者がよく利用する 3 軒をおすすめとして主に紹介する。
// lat/lng は地図ピン用 (Google マップ上の各施設位置)。
export const stays: Place[] = [
  {
    name: 'ゲストハウス太陽堂',
    area: '南信濃',
    desc: '旧商店をリノベーションした小さな素泊まりの宿。男女別ドミトリーと個室があり、共用キッチンで自炊も可能。カフェ&バルを併設し、温泉「かぐらの湯」へは徒歩 8 分です。',
    info: '飯田市南信濃和田・和田バス停から徒歩5分',
    detail: 'https://tohyamago-taiyodo.com/',
    map: '長野県飯田市南信濃和田1496-2 遠山郷ゲストハウス太陽堂',
    lat: 35.3196412,
    lng: 137.9321702,
  },
  {
    name: 'かぐら山荘',
    area: '南信濃',
    desc: 'ログハウスの宿。夕食には下栗芋や豆腐田楽など、地元の味が並びます。温泉「かぐらの湯」から徒歩 1 分です。',
    info: '飯田市南信濃・かぐらの湯すぐ',
    detail: 'https://kagurasansou.com/',
    map: '遠山郷 かぐら山荘',
    lat: 35.3206307,
    lng: 137.9296818,
  },
  {
    name: '高原ロッジ下栗',
    area: '下栗',
    desc: '天空の里ビューポイントに最も近い宿。和洋の客室があり、下栗の里の散策拠点に便利です。',
    info: '飯田市上村下栗',
    detail: 'https://www.tiroljapan.com/',
    map: '長野県飯田市上村下栗 高原ロッジ下栗',
    lat: 35.3745308,
    lng: 137.9821829,
  },
]

// 地図に立てるピン一覧: 食事処 + 宿。カテゴリで色分けし、AccessMap 側で
// 全ピンが収まるよう自動フィットする。
export const mapPlaces: MapPlace[] = [
  ...restaurants.map(
    (r): MapPlace => ({
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      address: `${r.area}（食事処）`,
      query: r.map,
      category: 'food',
    }),
  ),
  ...stays.map(
    (s): MapPlace => ({
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      address: `${s.area}（宿）`,
      query: s.map,
      category: 'stay',
    }),
  ),
]
