/**
 * StoryArt — 「遠山郷との始まり」(ライトノベル) 専用のベクター挿絵。
 *
 * 読み物のトーンに合わせ、実写ではなく手描き風の SVG アートで情景を描く。
 * すべてのシーンは「空 → 遠/中/近の山並み → 段々畑」という共通の構図言語を
 * 共有しつつ、配色 (時間帯・季節) と前景のモチーフだけを差し替える。これにより
 * ページを送るたびに「同じ谷の、少しずつ違う表情」が現れる連続性を持たせている。
 *
 * 静的な装飾画像のため hydration は不要。Astro からも React 島 (StoryReader)
 * からも、同じコンポーネントとして再利用できる。
 */

export type StoryScene =
  'hero' | 'winter' | 'notice' | 'seed' | 'field' | 'gather' | 'dawn'

interface Palette {
  /** 空のグラデーション (上→下の 3 段) */
  sky: [string, string, string]
  /** 太陽/月の本体色 */
  sun: string
  /** 太陽まわりの光暈 */
  glow: string
  /** 太陽の位置 (viewBox 800x450 基準) と大きさ */
  sunPos: [number, number, number]
  /** 山並み 遠 / 中 / 近 の色 */
  far: string
  mid: string
  near: string
  /** 段々畑の基調色とコントラスト色 */
  field: string
  fieldAlt: string
  /** 雪化粧するか (冬) */
  snow: boolean
  /** 前景モチーフ */
  motif:
    'figure' | 'travelers' | 'hut' | 'sprout' | 'rows' | 'lanterns' | 'path'
}

// 共有する山の稜線 (全シーン同じシルエットを使い、色だけ変える)。
const RIDGE_FAR =
  '0,182 110,120 210,172 320,108 430,166 540,118 660,170 760,124 800,150 800,460 0,460'
const RIDGE_MID =
  '0,242 130,172 250,232 370,158 480,226 600,164 720,228 800,192 800,460 0,460'
const RIDGE_NEAR =
  '0,302 150,236 300,300 450,228 600,300 750,246 800,276 800,460 0,460'

const SCENES: Record<StoryScene, Palette> = {
  // キービジュアル: 陽光のさす谷を、ひとりの人影が見上げる。
  hero: {
    sky: ['#cdeefb', '#e9f7ee', '#fff7e2'],
    sun: '#ffc24b',
    glow: '#ffe6ac',
    sunPos: [600, 120, 46],
    far: '#9fcfd6',
    mid: '#54a585',
    near: '#2f8a64',
    field: '#1f855f',
    fieldAlt: '#44b08c',
    snow: false,
    motif: 'figure',
  },
  // プロローグ「冬の、秘境へ」: 冷たい青、雪化粧、谷へ向かう人々。
  winter: {
    sky: ['#dceaf2', '#eef5f8', '#ffffff'],
    sun: '#f6e7c4',
    glow: '#ffffff',
    sunPos: [210, 110, 40],
    far: '#b7cdd8',
    mid: '#9db4c1',
    near: '#c6d4dc',
    field: '#e6edf1',
    fieldAlt: '#cfdae1',
    snow: true,
    motif: 'travelers',
  },
  // 第一話「一枚の貼り紙」: 朝の伝承館と、貼り紙の掲示板。
  notice: {
    sky: ['#ffe8cf', '#fff2dd', '#fffaf0'],
    sun: '#ffb36b',
    glow: '#ffd9a8',
    sunPos: [150, 116, 42],
    far: '#a9c0b2',
    mid: '#6fa085',
    near: '#4d8a6a',
    field: '#7a9c5e',
    fieldAlt: '#9bb673',
    snow: false,
    motif: 'hut',
  },
  // 第二話「二度芋は、二度芋だ」: 土の畝と、芽吹き。
  seed: {
    sky: ['#eaf3df', '#f4f6e6', '#fff8e6'],
    sun: '#ffd36b',
    glow: '#ffe6ac',
    sunPos: [620, 128, 40],
    far: '#bcae8e',
    mid: '#9c8a5e',
    near: '#7d6a3e',
    field: '#8a5a32',
    fieldAlt: '#a6713f',
    snow: false,
    motif: 'sprout',
  },
  // 第三話「はじめての農作業」: 青空のもと、芽の並ぶ段々畑。
  field: {
    sky: ['#cdeafb', '#e6f6ec', '#fbfbe6'],
    sun: '#ffc24b',
    glow: '#ffe6ac',
    sunPos: [410, 96, 44],
    far: '#8fc6cf',
    mid: '#54a585',
    near: '#2f8a64',
    field: '#1f855f',
    fieldAlt: '#44b08c',
    snow: false,
    motif: 'rows',
  },
  // 第四話「通うようになった理由」: 夕暮れの灯りと、ぬくもり。
  gather: {
    sky: ['#ffd2a8', '#ff9e6b', '#f06b4b'],
    sun: '#ffb84b',
    glow: '#ffd98c',
    sunPos: [600, 150, 50],
    far: '#8a7a82',
    mid: '#6a5560',
    near: '#4a3a44',
    field: '#3a2e36',
    fieldAlt: '#5a4750',
    snow: false,
    motif: 'lanterns',
  },
  // エピローグ「活動は、続いていく」: 朝焼けと、谷を上る一本道。
  dawn: {
    sky: ['#ffdca8', '#ffeccf', '#eaf6ee'],
    sun: '#ff8a5b',
    glow: '#ffd9a8',
    sunPos: [400, 118, 48],
    far: '#a9c6cf',
    mid: '#5aa585',
    near: '#2f8a64',
    field: '#1f855f',
    fieldAlt: '#44b08c',
    snow: false,
    motif: 'path',
  },
}

/** 人影シルエット (光の谷を見上げる旅人)。 */
function Person(x: number, y: number, s: number, color: string) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={color}>
      <circle cx="0" cy="-26" r="6" />
      <path d="M-7 -20 Q0 -24 7 -20 L9 2 Q0 6 -9 2 Z" />
      <rect x="-7" y="0" width="5" height="16" rx="2" />
      <rect x="2" y="0" width="5" height="16" rx="2" />
    </g>
  )
}

export default function StoryArt({
  scene = 'hero',
  className = '',
  title,
}: {
  scene?: StoryScene
  className?: string
  /** 与えると role="img" + aria-label になる (装飾のみなら省略して aria-hidden に) */
  title?: string
}) {
  const p = SCENES[scene] ?? SCENES.hero
  const id = `art-${scene}`
  const [sx, sy, sr] = p.sunPos

  // 段々畑: 下半分に、ゆるく波打つ等高線のバンドを重ねる。
  const bands = Array.from({ length: 5 }, (_, i) => {
    const top = 318 + i * 27
    const fill = i % 2 === 0 ? p.field : p.fieldAlt
    return { top, fill, i }
  })

  return (
    <svg
      viewBox="0 0 800 450"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.sky[0]} />
          <stop offset="55%" stopColor={p.sky[1]} />
          <stop offset="100%" stopColor={p.sky[2]} />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor={p.glow} stopOpacity="0.95" />
          <stop offset="100%" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 空 */}
      <rect x="0" y="0" width="800" height="450" fill={`url(#${id}-sky)`} />

      {/* 太陽 (光暈つき) */}
      <circle cx={sx} cy={sy} r={sr * 2.4} fill={`url(#${id}-glow)`} />
      <circle cx={sx} cy={sy} r={sr} fill={p.sun} />

      {/* 山並み: 遠 → 中 → 近 */}
      <polygon points={RIDGE_FAR} fill={p.far} opacity="0.85" />
      <polygon points={RIDGE_MID} fill={p.mid} opacity="0.92" />
      <polygon points={RIDGE_NEAR} fill={p.near} />

      {/* 雪化粧 (冬のみ): 主要な稜線の頂に白を載せる */}
      {p.snow && (
        <g fill="#ffffff" opacity="0.9">
          <polygon points="320,108 300,140 345,140" />
          <polygon points="540,118 520,150 562,150" />
          <polygon points="370,158 352,186 392,186" />
        </g>
      )}

      {/* 段々畑 (共通の構図) */}
      {bands.map(({ top, fill, i }) => (
        <path
          key={i}
          d={`M0 ${top} Q200 ${top - 12} 400 ${top} T800 ${top} L800 460 L0 460 Z`}
          fill={fill}
          opacity={0.96 - i * 0.04}
        />
      ))}
      {/* 等高線 (畑のうね) */}
      {bands.map(({ top, i }) => (
        <path
          key={`l-${i}`}
          d={`M0 ${top} Q200 ${top - 12} 400 ${top} T800 ${top}`}
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.18"
          strokeWidth="1.5"
        />
      ))}

      {/* ── 前景モチーフ (シーンごと) ── */}

      {/* 旅人ひとり (キービジュアル) */}
      {p.motif === 'figure' && Person(360, 360, 1.5, '#2c2a26')}

      {/* 谷へ向かう人々 (プロローグ) */}
      {p.motif === 'travelers' && (
        <g>
          {Person(330, 356, 1.1, '#3e3a35')}
          {Person(372, 366, 1.3, '#2c2a26')}
          {Person(414, 360, 1.0, '#4a463f')}
        </g>
      )}

      {/* 伝承館と掲示板 (第一話) */}
      {p.motif === 'hut' && (
        <g>
          {/* 民家 */}
          <rect x="470" y="296" width="120" height="74" fill="#6b4a32" />
          <polygon points="460,296 530,256 600,296" fill="#4a3322" />
          <rect x="500" y="330" width="26" height="40" fill="#2c2a26" />
          <rect x="548" y="320" width="26" height="22" fill="#cfe3ea" />
          {/* 掲示板に一枚の貼り紙 */}
          <rect x="300" y="318" width="8" height="54" fill="#5a4632" />
          <rect x="356" y="318" width="8" height="54" fill="#5a4632" />
          <rect x="294" y="300" width="76" height="34" rx="3" fill="#3a2c20" />
          <rect
            x="306"
            y="306"
            width="40"
            height="22"
            rx="1"
            fill="#fffdf7"
            transform="rotate(-3 326 317)"
          />
        </g>
      )}

      {/* 土の畝と芽吹き (第二話) */}
      {p.motif === 'sprout' && (
        <g>
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3, 4, 5].map((c) => (
              <g
                key={`${r}-${c}`}
                transform={`translate(${150 + c * 90} ${350 + r * 28})`}
              >
                <path
                  d="M0 0 C-2 -14 -10 -16 -12 -22 C-4 -22 -1 -16 0 -10 C1 -16 4 -22 12 -22 C10 -16 2 -14 0 0 Z"
                  fill="#3f7a3f"
                />
              </g>
            )),
          )}
        </g>
      )}

      {/* 苗の並ぶ畑 (第三話) */}
      {p.motif === 'rows' && (
        <g fill="#1c6f4f">
          {[330, 360, 392].map((y, r) =>
            Array.from({ length: 9 }, (_, c) => (
              <circle key={`${r}-${c}`} cx={90 + c * 80} cy={y} r={5} />
            )),
          )}
        </g>
      )}

      {/* 夕暮れの灯り (第四話) */}
      {p.motif === 'lanterns' && (
        <g>
          {[
            [250, 320],
            [360, 338],
            [470, 322],
            [560, 344],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="18" fill="#ffd98c" opacity="0.45" />
              <circle cx={x} cy={y} r="6" fill="#ffe6ac" />
            </g>
          ))}
        </g>
      )}

      {/* 谷を上る一本道 (エピローグ) */}
      {p.motif === 'path' && (
        <path
          d="M380 460 C380 410 470 392 470 350 C470 314 360 306 360 276 C360 252 430 244 430 220"
          fill="none"
          stroke="#fffdf7"
          strokeOpacity="0.78"
          strokeWidth="14"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}
