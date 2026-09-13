# 遠山郷応援会 ウェブサイト — 実装リファレンス

一般社団法人遠山郷応援会の公式ウェブサイト（tohyamago.org）。

> **このファイルの役割**: AI セッションを動かすための **前提・ルール・実装の細部**（デプロイ / CI・環境変数の解決・ディレクトリ構造・データスキーマ・記事の追加手順・コマンド）をまとめる。
> サイトの **目的・情報設計・ターゲット/ゴール・デザインシステム・コピー方針・ロードマップ**（人間向けの「なぜ・何を」）は [`README.md`](./README.md) にある。設計判断の背景は README を参照し、以下の実装規約に従って作業する。

## ホスティング

Cloudflare Pages にデプロイする静的サイト。デプロイは **Cloudflare ダッシュボードの GitHub 連携 (Workers Builds)** を使用し、`main` への push や PR の作成で自動的にビルド・公開される。GitHub Actions (`ci.yml`) は品質チェック (Lint / Format / 型チェック / テスト) を行う CI として動作し、デプロイは行わない。フルビルド検証は通常 Cloudflare のプレビュー/本番ビルドが担うため、`ci.yml` の `build` ジョブは **Cloudflare が自動ビルドしないフォーク由来の PR のときだけ**実行する（二重ビルド回避）。品質チェック系ジョブは **`pull_request` と `push` の両方**で走らせる（リポジトリ移管後に一部 PR で `pull_request` イベントがワークフローを起動しない事象があったため、`push` を保険にする）。`concurrency` グループは **イベント種別ごとに分ける**（`ci-<event>-<branch>`）。こうすると同一コミットで `push` と `pull_request` が同時起動しても相互キャンセルされず、両方 green で完走する（片方が `cancelled` になって必須チェック扱いでマージがブロックされるのを防ぐ）。同一イベントの連続 push では進行中の古い実行だけをキャンセルして無駄を省く。

### 環境変数の本番 / プレビュー切り分け (ビルド時にブランチ判定)

単一 Worker (`tohyamago`) のまま、本番ブランチ (`main`) のビルドとプレビュー (PR / 非本番ブランチ) のビルドで **ビルド時変数を出し分ける**。Cloudflare ダッシュボードのビルド設定はトリガー単位で本番/プレビューの値を分けにくいため、**両方の値をビルド変数に登録しておき、ビルド時にブランチを見て選ぶ**方式を採る。

- このサイトは Astro の静的生成で、`GA_MEASUREMENT_ID` / `PDFJS_EXPRESS_VIEWER` / `GOOGLE_MAPS_API_KEY` は **ビルド時**に `import.meta.env` 経由で HTML へ焼き込む。ランタイムに Worker スクリプトは無く (assets のみ) `[vars]` は読まれないため、これらは Cloudflare の **ビルド変数** として設定する。
  - Cloudflare には 2 系統あり混同しやすい: **ビルド時変数** = ダッシュボードの **Settings > Build > 「Build variables and secrets」**（`npm run build` の実行環境にのみ注入、ランタイム不可）／**ランタイム変数** = Settings > Variables & Secrets（＝`wrangler.toml` の `[vars]`、デプロイ後の Worker が `env.X` で読む）。本サイトが使うのは前者。
- **設定方法**: ビルド変数に `GA_MEASUREMENT_ID_PRODUCTION` / `GA_MEASUREMENT_ID_PREVIEW`（および `PDFJS_EXPRESS_VIEWER_PRODUCTION` / `..._PREVIEW`、`GOOGLE_MAPS_API_KEY_PRODUCTION` / `..._PREVIEW`）を登録する。Cloudflare がビルド時に注入する `WORKERS_CI_BRANCH` を見て、`main` なら `_PRODUCTION`、それ以外なら `_PREVIEW` を採用し、素の名前 (`GA_MEASUREMENT_ID` 等) に解決する。**プレビューに値を出したくない変数は `_PREVIEW` を未設定にすれば、その変数は注入されない**（例: プレビューには計測タグが出ない）。
- 解決ロジックは純粋関数 `src/buildEnv.ts`（`resolveBuildEnv`）に分離し Vitest でテストする。`astro.config.mjs` が読み込み時に `process.env` へ反映するため、`BaseLayout.astro` / `articles.astro` 側は従来どおり `import.meta.env.<NAME>` を読むだけでよい。
- 素の名前 (`GA_MEASUREMENT_ID`) が直接設定されていればそれを最優先する（CI のビルド検証や手動上書き・ローカル開発の `.env` 用）。
- `PUBLIC_SITE_URL`（canonical / OGP / 構造化データの基点）は **出し分けない**。プレビューが本番と別に索引されるのを防ぐため、プレビュー・本番とも同じ値を参照し常に本番 URL を出す（未設定なら本番ドメインにフォールバック。`astro.config.mjs` と `src/components/siteMeta.ts` の `SITE_URL` が同じ既定値・同じ環境変数を使う）。
- 今後 Stripe / Clerk を追加する際の住み分け: **ビルド時に埋め込む公開キー**（publishable key 等）は同じく `_PRODUCTION` / `_PREVIEW` のビルド変数で出し分ける。**サーバー側で使う秘密鍵**はビルド変数に置かず（公開リポジトリの PR ビルドにも値が見えてしまうため）、ランタイムのシークレットとして扱う。

### Cloudflare ダッシュボード側の設定

- Build command: `npm run build`
- Build output directory: `dist`（`wrangler.toml` の `[assets]` でも指定済み）
- Root directory: `/`
- Node version: 22
- ビルド時の環境変数は **Settings > Build > 「Build variables and secrets」** に `<NAME>_PRODUCTION` / `<NAME>_PREVIEW` の形で登録（ランタイム用の Variables & Secrets ではない）。PR / 非本番ブランチも自動ビルドするため、非本番ブランチビルドを有効化しておく。

## 技術スタック

| 用途                 | ライブラリ                                             |
| -------------------- | ------------------------------------------------------ |
| フレームワーク       | Astro 7 (静的サイト生成)                               |
| インタラクティブ部品 | React 19 (Astro Islands)                               |
| 言語                 | TypeScript                                             |
| スタイリング         | Tailwind CSS v4 (`@tailwindcss/vite`)                  |
| PDF 表示             | @pdftron/pdfjs-express-viewer (クライアント側)         |
| 地図                 | Google Maps JavaScript API (`/access`, クライアント側) |
| SEO                  | `@astrojs/sitemap` ＋ OGP / JSON-LD                    |

## ディレクトリ構造

> 各 `*.ts` ロジックモジュールには原則 `*.test.ts`（Vitest）を併設する。React 島（`*.tsx`）にも `*.test.tsx` を添える。以下ではテストファイルは省略する。

```
tohyamago/
├── astro.config.mjs            # Astro 設定 (React + Tailwind v4 + sitemap + remark-breaks + buildEnv 反映)
├── eslint.config.js            # ESLint (flat config: TS / React / a11y / Astro)
├── .prettierrc.json            # Prettier 設定 (.prettierignore も併設)
├── vitest.config.ts            # Vitest 設定 (vitest.setup.ts も併設)
├── playwright.config.ts        # Playwright 設定 (E2E, e2e/ 配下)
├── tsconfig.json               # `~/*` エイリアス → src/*
├── package.json
├── src/
│   ├── pages/                  # ファイルベースルーティング
│   │   ├── index.astro         # トップ (ヒーロー + 3導線 + 今月の活動 + 物語teaser + 活動記録ダイジェスト)
│   │   ├── purpose.astro       # 活動趣旨
│   │   ├── story.astro         # 遠山郷との始まり (StoryReader 島によるライトノベル風の読み物)
│   │   ├── join.astro          # はじめての方へ / 参加案内
│   │   ├── calendar.astro      # 農作業カレンダー
│   │   ├── access.astro        # 交通案内 (経路・所要時間 + AccessMap 島)
│   │   ├── eat-stay.astro      # 食べる・泊まる (周辺の食事処・宿。AccessMapCard を共有)
│   │   ├── products.astro      # 成果品紹介 → shop
│   │   ├── support.astro       # 寄付案内 (口座振込。Stripe は Phase 4)
│   │   ├── membership.astro    # 入会案内 (入会手続きは準備中 = Phase 5)
│   │   ├── news.astro          # 活動記録一覧 (全記事をダイジェストカードで表示。トップは最新数件)
│   │   ├── news/
│   │   │   ├── [slug].astro     # 記事個別ページ (全文 + 写真 + 前後記事導線。SEO/共有用)
│   │   │   └── archive.astro    # 活動記録アーカイブ (公開年でまとめた索引 + 季節フィルタ)
│   │   ├── articles.astro      # 定款 (PDF, fullscreen)
│   │   ├── public_notices.astro# 公告 (URL 固定・変更禁止)
│   │   ├── notation.astro      # 特定商取引法に基づく表記
│   │   └── 404.astro           # Not Found (noindex)
│   ├── layouts/
│   │   └── BaseLayout.astro    # 共通レイアウト (SiteHeader + SiteFooter + Seo。GA/OG/JSON-LD の値解決)
│   ├── components/
│   │   ├── SiteHeader.astro / siteHeaderNav.ts  # グローバルナビ (ジャーナリー導線。挙動を ts に分離)
│   │   ├── SiteFooter.astro    # 共通フッター (法令・規約 / 法人概要)
│   │   ├── SiteLogo.astro      # ブランドマーク (重なる稜線 + 陽光 + コーラルの頂)
│   │   ├── Seo.astro / siteMeta.ts  # <head> メタ (OGP/canonical/robots) と JSON-LD 組み立て
│   │   ├── JourneyCards.astro / JourneyIcon.astro  # トップの3導線カード (参加/購入/支える)
│   │   ├── homeTasks.ts        # トップ「今月の活動」抽出ロジック (crops から当月作業)
│   │   ├── FarmCalendar.tsx    # 農作業ガントチャート (React island)
│   │   ├── ProductCard.astro   # 成果品カード
│   │   ├── Button.astro / ArrowIcon.astro / buttonArrow.ts  # CTA ボタンと末尾矢印
│   │   ├── Card.astro / Container.astro / SectionHeading.astro  # 共通 UI プリミティブ
│   │   ├── Posts.astro         # Content Collection からダイジェストカード一覧を描画 (ctaEvery で NewsCta を挿入)
│   │   ├── PostCard.astro      # 活動記録一覧のダイジェストカード (抜粋 + サムネイル → /news/[slug])
│   │   ├── postExcerpt.ts      # 記事本文から一覧用プレーンテキスト抜粋を作る
│   │   ├── postDate.ts         # 記事日付を「YYYY年M月D日(曜)」へ整形
│   │   ├── postArchive.ts      # 記事を公開年でグループ化 (/news/archive 用)
│   │   ├── postSeason.ts       # 記事日付を季節 (春夏秋冬) に分類
│   │   ├── newsArchiveFilter.ts# アーカイブの季節フィルタ DOM 操作 (クライアント側)
│   │   ├── NewsCta.astro       # 「次は、あなたの番です」CTA (compact / full)
│   │   ├── postCtaLayout.ts    # 記事間 CTA の挿入位置を決める
│   │   ├── BlurImage.astro / blur-placeholder.ts / image-fade-in.ts  # LQIP/blur-up 画像 (下絵生成 + フェード)
│   │   ├── StoryReader.tsx / StoryArt.tsx  # /story のライトノベル読み物と専用ベクター挿絵 (React)
│   │   ├── AccessMap.tsx / AccessMapCard.astro / accessData.ts / googleMaps.ts  # 交通案内の地図と共有データ
│   │   ├── ComingSoon.astro    # 準備中ページの共通テンプレート
│   │   └── PdfViewer.tsx       # PDF.js Express ラッパー (React, client:only)
│   ├── content.config.ts       # Content Collection スキーマ (posts / crops / events)
│   ├── buildEnv.ts             # ビルド時変数を本番/プレビューで出し分ける純粋関数 (astro.config.mjs が利用)
│   ├── content/
│   │   ├── posts/              # 記事 (Markdown) と添付画像
│   │   ├── crops/              # 農作業カレンダーの作物・作業データ (YAML)
│   │   └── events/             # 地域イベントデータ (YAML)
│   ├── assets/                 # Astro が処理する画像・PDF (farm.jpg / mounts.jpg / articles.pdf 等)
│   ├── types/                  # 型定義の補完 (例: pdfjs-express-viewer.d.ts)
│   └── styles/global.css       # Tailwind の import・@theme トークン・body スタイル
├── public/
│   ├── _headers                # Cloudflare Pages のヘッダー設定
│   ├── robots.txt              # sitemap.xml を参照
│   └── .well-known/
│       └── apple-developer-merchantid-domain-association
├── e2e/                        # Playwright の実ブラウザ E2E
├── wrangler.toml               # Cloudflare Pages 設定 (出力ディレクトリ)
└── .github/workflows/ci.yml    # 品質チェック CI + フォーク PR のみフルビルド検証 (デプロイは Cloudflare 側)
```

## ページ / ルート

ページの狙い・ターゲット・ナビ構成は [README「サイト構成」](./README.md) を参照。実装上の制約のみ以下に記す。

- **`/public_notices` の URL は法人登記に記載されているため変更禁止**（最重要制約）。
- グローバルナビ（ジャーナリー導線）は `SiteHeader.astro`、法令系文書（定款 / 公告 / 特商法表記）と法人概要は `SiteFooter.astro`。旧フローティング `RouterMenu` は廃止済み。ナビ項目・CTA は `SiteHeader.astro` の `groups` / `ctas` 定義を単一の情報源とする。
- ナビの表記ゆれに注意: `/story` はナビ上「遠山郷との始まり」、`/news` は「活動記録」。

### 活動記録 (/news) の描画

- 一覧は `Posts.astro`（`PostCard` のグリッド）で全記事をダイジェスト（抜粋 + サムネイル 1 枚）表示。トップ（`index.astro`）は `<Posts limit={3} />` の最新数件のみ。カードのタップで記事個別ページ `/news/[slug]` へ。
- 全記事一覧は縦に長いため `<Posts ctaEvery={12} />` で一定間隔に `NewsCta`（compact）を挿入する。挿入位置は `postCtaLayout.ts`（`ctaPositions`）が決定し、最終記事直後は末尾の本 CTA（`NewsCta` full）と重複しないよう除外する。
- `/news/[slug].astro` は `getCollection('posts')` を新しい順に並べ `getStaticPaths` で全件生成。本文・全写真・`sourceUrl`・前後記事導線・末尾 `NewsCta`（full）・`#タグ` を表示。
- `/news/archive.astro` は公開年で章立て（`postArchive.ts` の `groupPostsByYear`）＋季節フィルタ。季節判定は `postSeason.ts`（`getSeason`。境界は春 3/1–6/20・夏 6/21–9/15・秋 9/16–12/5・冬 12/6–翌 2 月末）。フィルタの DOM 操作は `newsArchiveFilter.ts`（`applySeasonFilter`）に分離。JS 無効時は全件表示のプログレッシブエンハンスメント。
- トップ末尾の活動記録ダイジェストには `id="feed"` を残し、旧 `/#feed` ブックマークの着地点として後方互換を保つ（新規リンクは `/news`）。

## 記事 (Content Collection)

- `src/content/posts/` に `<slug>.md` (Markdown 本文) を配置。
- 添付画像は `src/content/posts/<slug>/<filename>` に置き、frontmatter の `images` で参照。
- スキーマは `src/content.config.ts` の `posts` で定義: `title`（必須, 空文字不可）/ `date` / `tags`（任意, 既定 `[]`）/ `images`（既定 `[]`）/ `sourceUrl`（任意）。
  - `title`: 一覧カード・前後記事導線・個別ページ見出し・`<title>` / SNS 共有の見出しに使う。
  - `tags`: 作物・作業・地名などのキーワード。SNS のハッシュタグ流用も想定し、個別ページ末尾に `#タグ` として表示する。
- Markdown は `remark-breaks` で単一改行も `<br>` 化されるため、Facebook 風の改行スタイルがそのまま再現される。
- **frontmatter の後方互換は厳守**（`date` / `images` / `sourceUrl` を含む既存記事を壊さない）。

### 農作業カレンダー データ (crops / events)

作物の作業は **毎年ほぼ同時期に繰り返す** ため旬粒度の循環データ、地域イベントは **特定日** を持つデータとして分離する。管理者が 1 ファイルで更新できるよう YAML データコレクションとする。

- **時期は「月.旬」で表す**: 各月を `.0`=上旬 / `.1`=中旬 / `.2`=下旬 の 3 分割。範囲は `1.0`〜`12.2`。CSS Grid の列計算（12 か月 × 3 = 36 列）に直結するためスキーマ（`monthThird`）で厳密に検証する。`start <= end` も検証する。

`src/content/crops/<id>.yaml`（作物 1 件＝1 ファイル）:

```yaml
name: お茶
emoji: 🍵
color: '#2f8f6b' # ガントバーの基調色
order: 4 # 表示順
tasks:
  - label: 整枝・施肥
    start: 3.1 # 3月中旬
    end: 3.2 # 3月下旬
    intensity: light # 作業強度: light=軽め / medium=ふつう / hard=しっかり (既定 medium)
    note: 春一番の作業。茶樹の形を整え、肥料を施します。
  - label: 茶摘み（新茶）
    start: 5.1
    end: 5.2
    intensity: hard
    note: 「一芯三葉」で手摘み。
```

`src/content/events/<id>.yaml`（地域イベント 1 件＝1 ファイル）:

```yaml
name: 霜月祭
start: 12.0 # 月.旬。複数日にまたがる行事は start/end で範囲指定
end: 12.2
category: 地域行事 # 地域行事 / 当会イベント / 販売 など (既定 地域行事)
location: 遠山郷各地区 # 任意
url: https://example.com # 任意
note: 国指定重要無形民俗文化財。# 任意
```

- `FarmCalendar.tsx`（React island, `client:load`）が描画。データは `calendar.astro`（`getCollection('crops'|'events')`）から props で渡す。レイアウトは CSS Grid（36 列）、バーは `grid-column: start / end` でスパン、色は作物の `color`。当月ハイライト・バー展開などのインタラクションを担う。
- アクセシビリティ: 色だけに依存しない（ラベル・凡例・`aria`）。表形式の意味を保持する。

## 外部リンク

- ボランティア募集 (activo): `https://activo.jp/s/a/119414`
- 成果品販売 (shop): `https://shop.tohyamago.org`

## 環境変数

| 変数名                 | 用途                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `PDFJS_EXPRESS_VIEWER` | PDF.js Express ビューワーライセンスキー                                                                                            |
| `GA_MEASUREMENT_ID`    | Google Analytics 測定 ID（例: `G-XXXXXXXXXX`）。`BaseLayout.astro` が設定時のみ gtag.js を出力                                     |
| `GOOGLE_MAPS_API_KEY`  | Maps JavaScript API のブラウザキー。`/access` の `AccessMap.tsx` で使う。未設定なら API キー不要の埋め込み iframe にフォールバック |
| `PUBLIC_SITE_URL`      | canonical / OGP / 構造化データの基点 URL。未設定なら本番ドメインにフォールバック（出し分けない）                                   |

- いずれも秘匿情報ではない（`GA_MEASUREMENT_ID` は公開の測定 ID、`PDFJS_EXPRESS_VIEWER` はドメイン固定のビューワーキー、`GOOGLE_MAPS_API_KEY` は HTTP リファラ制限で保護する公開のブラウザキー）ため、**シークレットではなく通常の「変数」として扱う**。`GOOGLE_MAPS_API_KEY` は Google Cloud 側で「HTTP リファラ（本番・プレビューのドメイン）」と「Maps JavaScript API」に利用を絞る。
- **デプロイ時（Cloudflare）**: 静的生成でビルド時に HTML へ焼き込むため、**Settings > Build > 「Build variables and secrets」**（ビルド変数）に `<NAME>_PRODUCTION` / `<NAME>_PREVIEW` の形で登録し、ブランチで出し分ける（上記「環境変数の本番 / プレビュー切り分け」参照）。プレビューに出したくない変数は `_PREVIEW` を未設定にする。
- **CI（GitHub Actions）**: `ci.yml` のビルド検証・E2E は値を必要としない。素の名前が未設定なら `import.meta.env.*` は undefined になるだけでビルドは成功する。必要になった場合のみ GitHub Actions の **Variables（`vars`）** に素の名前で登録する（`resolveBuildEnv` は素の名前を最優先する）。
- 今後追加する Stripe / Clerk のシークレットキーはビルド変数に置かず（公開リポジトリの PR ビルドにも見えてしまう）、ランタイムのシークレットとして本番/プレビュー別々に設定し、CI で必要なものは GitHub Secrets に登録する。

## ビルド時の補助処理

PDF.js Express ビューワーは `node_modules/@pdftron/pdfjs-express-viewer/public/` 配下に静的アセット (Web Worker 等) を持つ。`npm run build` の `postbuild` フックでこれらを `dist/` へコピーしているため、ローカル / GitHub Actions / Cloudflare Pages のいずれの環境でも自動で配置される。

## 開発コマンド

```bash
npm ci          # 依存インストール
npm run dev     # 開発サーバー (http://localhost:4321)
npm run build   # 静的ビルド (dist/)
npm run preview # ビルド成果物のローカル確認
```

## 品質チェック (Lint / Format / 型チェック / テスト)

CI (`ci.yml`) でも同じコマンドを実行する。**各変更の完了時に lint / format:check / typecheck / test / build を通すこと。**

```bash
npm run lint          # ESLint (TS / React / a11y / Astro)
npm run lint:fix      # ESLint 自動修正
npm run format        # Prettier で整形 (--write)
npm run format:check  # Prettier の整形チェック (CI 用)
npm run typecheck     # astro check による型チェック
npm test              # Vitest を 1 回実行
npm run test:watch    # Vitest ウォッチモード
npm run test:coverage # カバレッジ付きで実行 (coverage/ に lcov / html を出力)
npm run test:e2e      # Playwright (実ブラウザ E2E, e2e/ 配下)
```

- **Linter**: ESLint 9 (flat config, `eslint.config.js`)。TypeScript / React / React Hooks / jsx-a11y / Astro 対応。整形系ルールは `eslint-config-prettier` で無効化し Prettier に委譲。日本語コンテンツの全角スペースを許容するため `no-irregular-whitespace` は無効。
- **Formatter**: Prettier (`.prettierrc.json`)。セミコロンなし・シングルクォート。`.astro` は `prettier-plugin-astro` で整形。対象外は `.prettierignore`。
- **テスト方針**: リグレッションテストは可能な限りコードを広くカバーする。ブラウザ依存の不具合を修正したときは、その再発防止として実ブラウザテストを追加する。
  - **単体/結合 (jsdom)**: Vitest + Testing Library。React 島や DOM ロジックの「動き」と「スタイリング」を `src/**/*.{test,spec}.{ts,tsx}` に配置。インライン `<script>` のロジックは `*.ts` モジュールへ分離してテスト可能にする（例: `SiteHeader.astro` の挙動は `siteHeaderNav.ts` に分離し `siteHeaderNav.test.ts` で検証）。
  - **E2E (実ブラウザ)**: Playwright (`playwright.config.ts` / `e2e/*.spec.ts`)。jsdom が扱えないレイアウト・重なり順 (z-index/stacking) など、描画を伴う回帰のみを対象とする。CI では `e2e` ジョブで `npx playwright install --with-deps chromium` 後に実行する。
  - **カバレッジ (Codecov)**: `vitest.config.ts` の `coverage` 設定で v8 プロバイダを使い `coverage/lcov.info` を生成。CI の `coverage` ジョブが `npm run test:coverage` を実行し `codecov/codecov-action` で送信する。トークンは GitHub Secrets の `CODECOV_TOKEN`。Codecov のステータスは `codecov.yml` で非ブロッキング（情報提供）。

## 実装上の厳守事項

デザイン・コピーの詳細な指針は [README「デザインシステム」「コピー（文章）の方針」](./README.md) にある。作業時に破ってはならない要点のみ以下に再掲する。

- **`/public_notices` の URL は変更禁止**（法人登記に記載）。
- **記事 frontmatter の後方互換を維持**する（`date` / `images` / `sourceUrl` を含む既存記事を壊さない）。
- **色はデザイントークンで指定し、ハードコード hex を使わない**（`global.css` の `@theme`。濃色派生 `-deep` / `-strong` は白文字 AA 用）。
- **見出しは `SectionHeading.astro` の「三つの実」マーク**、山（▲）は `SiteLogo.astro` のブランドマークに限定。バッジは三角なし・ベタ塗り・白文字・`rounded-full` のピルに統一。
- **画像は `<Image>` / `BlurImage.astro` を使う**（レスポンシブ webp + LQIP。LCP 画像のみ `loading="eager"` ＋ `fetchpriority="high"`、`fade={false}`）。
- **コピーは行動を主語に**し、「畑」を前面で繰り返さない（「活動に参加する」等）。**「お気軽に」は使わない**。既存記事本文と `/story` の地の文は書き手の表現を尊重し機械置換しない。
- 新規 React 島・DOM ロジックには代表的な Vitest テストを添える。インライン `<script>` のロジックは `*.ts` へ分離する。
