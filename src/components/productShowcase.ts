/**
 * productShowcase — 成果品ショーケースのデータと、作物コレクションとの突き合わせ。
 *
 * 成果品紹介ページ (/products) が参照するデータ。文章・成果品・旬だけをここで管理し、
 * 名称・絵文字・基調色・表示順は crops コレクションを単一の情報源とする。
 */

/** ショーケース 1 件 (crops の ID で作物と紐づく)。 */
export interface ShowcaseItem {
  /** crops コレクションの ID。 */
  id: string
  tagline: string
  story: string[]
  makes: { label: string; note?: string }[]
  season: string
}

/** 突き合わせに使う作物側の情報 (crops コレクション)。 */
export interface ShowcaseCrop {
  id: string
  name: string
  emoji?: string
  color: string
  order: number
}

/** ショーケース＋作物のブランド情報を合成した表示用データ。 */
export type ResolvedProduct = ShowcaseItem & Omit<ShowcaseCrop, 'id'>

export const PRODUCT_SHOWCASE: ShowcaseItem[] = [
  {
    id: 'shimoguri-imo',
    tagline: '日本のチロル・下栗の急斜面で育つ、小さな在来芋',
    story: [
      '標高 1,000m 前後の急傾斜地に石垣を積んで拓かれた、下栗の里の畑。耕されなくなれば荒れてしまうこの景観を守ろうと畑に通ううちに、代々この土地で受け継がれてきた在来のじゃがいも——ひと夏に二度植えられることから「二度芋」とも呼ばれる小ぶりな芋——も、毎年の畑仕事の実りとして採れています。',
      '春に植え、夏に草を取り、盛夏に皆で掘る。そんな一年を畑で過ごすうちにできた芋です。掘りたてのほくほくとした味わいは、この時期この場所ならではの楽しみになっています。',
    ],
    makes: [
      { label: '下栗芋（生芋）', note: '夏に採れた掘りたてを数量限定で' },
      { label: 'いも田楽', note: '串に刺して味噌だれで、下栗の郷土の味' },
    ],
    season: '植え付け 3〜4 月／収穫は盛夏（7〜8 月）',
  },
  {
    id: 'shimoguri-soba',
    tagline: '芋を掘った同じ畑から、白い花を経て実る蕎麦',
    story: [
      '下栗芋を収穫したあとの畑を遊ばせておくのはもったいないと蕎麦の種を蒔くと、夏の終わりには一面に白い花が咲き揃い、秋には黒い実が実ります。畑を守る一年の流れの中で、そのまま蕎麦も育っていきます。',
      '皆で刈り取り、天日で乾かして脱穀すれば、いつのまにか玄蕎麦に。冬には採れたての新蕎麦を味わう会も、活動の楽しみのひとつになっています。',
    ],
    makes: [
      { label: '玄蕎麦・そば粉', note: '秋に採れた下栗産の蕎麦' },
      { label: '新蕎麦', note: '晩秋〜冬、採れたての香りを楽しむ' },
    ],
    season: '種蒔き 7 月／収穫・脱穀は晩秋（10〜11 月）',
  },
  {
    id: 'zairai-daizu',
    tagline: '畑の草を刈り、見守るうちに実る在来大豆',
    story: [
      '蕎麦畑と並んで育っているのが、遠山郷に受け継がれてきた在来の大豆です。鳥よけのネットを張って種を蒔き、夏のあいだ畑の草を刈りながら見守るうちに、晩秋には収穫を迎えます。',
      '刈り取った株は「はざかけ」にして天日に干し、その年の〆に皆で脱穀。畑に通った一年の終わりに、ふっくらとした大豆が残ります。',
    ],
    makes: [
      { label: '在来大豆', note: '天日に干した遠山郷の大豆' },
      {
        label: '味噌・きな粉 など',
        note: '採れた大豆を活かした加工にも少しずつ挑戦',
      },
    ],
    season: '種蒔き 5 月／収穫・脱穀は晩秋（11〜12 月）',
  },
  {
    id: 'ocha',
    tagline: '茶畑を守るうちに、皆で摘む初夏の新茶',
    story: [
      '春の整枝・施肥から始まり、初夏には新芽を摘みます。「一芯三葉」——芯と若い葉だけを摘む昔ながらのやり方を、地域の人に教わりながら皆で摘む、初夏のひととき。手入れが行き届かなくなりがちな茶畑を守る活動でもあります。',
      'ある年は摘んだ 15kg の生葉が、茶工場での加工を経て 3kg ほどの茶葉になりました。茶畑に通ううちに生まれた、香りのよい新茶です。仕上がったぶんを数量限定でお分けしています。',
    ],
    makes: [
      { label: '新茶（仕上げ茶）', note: '皆で手摘みした数量限定の煎茶' },
    ],
    season: '整枝 3 月／茶摘み（新茶）は初夏（5 月）',
  },
]

/**
 * ショーケースに作物コレクションのブランド情報 (name / emoji / color / order) を補い、
 * crops の order 順に並べて返す。
 *
 * ID の不整合 (タイポやデータ削除) はビルド時に即エラーにし、
 * 成果品が静かに消えるのを防ぐ。
 */
export function resolveProducts(
  showcase: ShowcaseItem[],
  crops: ShowcaseCrop[],
): ResolvedProduct[] {
  const cropById = new Map(crops.map((c) => [c.id, c]))
  return showcase
    .map((item) => {
      const crop = cropById.get(item.id)
      if (!crop) {
        throw new Error(
          `[productShowcase] ID "${item.id}" に対応する作物が crops コレクションに見つかりません。コンテンツファイルまたは showcase の ID を確認してください。`,
        )
      }
      return {
        ...item,
        name: crop.name,
        emoji: crop.emoji,
        color: crop.color,
        order: crop.order,
      }
    })
    .sort((a, b) => a.order - b.order)
}
