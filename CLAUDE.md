# 遠山郷応援会 ウェブサイト

一般社団法人遠山郷応援会の公式ウェブサイト。

## ホスティング

Cloudflare Pages にデプロイする静的サイト。デプロイは **Cloudflare ダッシュボードの GitHub 連携 (Workers Builds)** を使用し、`main` への push や PR の作成で自動的にビルド・公開される。GitHub Actions (`ci.yml`) は品質チェック (Lint / Format / 型チェック / テスト) を行う CI として動作し、デプロイは行わない。フルビルド検証は通常 Cloudflare のプレビュー/本番ビルドが担うため、`ci.yml` の `build` ジョブは **Cloudflare が自動ビルドしないフォーク由来の PR のときだけ**実行する（二重ビルド回避）。品質チェック系ジョブは **`pull_request` と `push` の両方**で走らせる（リポジトリ移管後に一部 PR で `pull_request` イベントがワークフローを起動しない事象があったため、`push` を保険にする）。同一ブランチの二重実行は `concurrency`（進行中の古い実行をキャンセル）で抑制する。

### 環境変数の本番 / プレビュー切り分け (ビルド時にブランチ判定)

単一 Worker (`tohyamago`) のまま、本番ブランチ (`main`) のビルドとプレビュー (PR / 非本番ブランチ) のビルドで **ビルド時変数を出し分ける**。Cloudflare ダッシュボードのビルド設定はトリガー単位で本番/プレビューの値を分けにくいため、**両方の値をビルド変数に登録しておき、ビルド時にブランチを見て選ぶ**方式を採る。

- このサイトは Astro の静的生成で、`GA_MEASUREMENT_ID` / `PDFJS_EXPRESS_VIEWER` は **ビルド時**に `import.meta.env` 経由で HTML へ焼き込む。ランタイムに Worker スクリプトは無く (assets のみ) `[vars]` は読まれないため、これらは Cloudflare の **ビルド変数** として設定する。
  - Cloudflare には 2 系統あり混同しやすい: **ビルド時変数** = ダッシュボードの **Settings > Build > 「Build variables and secrets」**（`npm run build` の実行環境にのみ注入、ランタイム不可）／**ランタイム変数** = Settings > Variables & Secrets（＝`wrangler.toml` の `[vars]`、デプロイ後の Worker が `env.X` で読む）。本サイトが使うのは前者。
- **設定方法**: ビルド変数に `GA_MEASUREMENT_ID_PRODUCTION` / `GA_MEASUREMENT_ID_PREVIEW`（および `PDFJS_EXPRESS_VIEWER_PRODUCTION` / `..._PREVIEW`）を登録する。Cloudflare がビルド時に注入する `WORKERS_CI_BRANCH` を見て、`main` なら `_PRODUCTION`、それ以外なら `_PREVIEW` を採用し、素の名前 (`GA_MEASUREMENT_ID` 等) に解決する。**プレビューに値を出したくない変数は `_PREVIEW` を未設定にすれば、その変数は注入されない**（例: プレビューには計測タグが出ない）。
- 解決ロジックは純粋関数 `src/buildEnv.ts`（`resolveBuildEnv`）に分離し Vitest でテストする。`astro.config.mjs` が読み込み時に `process.env` へ反映するため、`BaseLayout.astro` / `articles.astro` 側は従来どおり `import.meta.env.<NAME>` を読むだけでよい。
- 素の名前 (`GA_MEASUREMENT_ID`) が直接設定されていればそれを最優先する（CI のビルド検証や手動上書き・ローカル開発の `.env` 用）。
- 今後 Stripe / Clerk を追加する際の住み分け: **ビルド時に埋め込む公開キー**（publishable key 等）は同じく `_PRODUCTION` / `_PREVIEW` のビルド変数で出し分ける。**サーバー側で使う秘密鍵**はビルド変数に置かず（公開リポジトリの PR ビルドにも値が見えてしまうため）、ランタイムのシークレットとして扱う。

### Cloudflare ダッシュボード側の設定

- Build command: `npm run build`
- Build output directory: `dist`（`wrangler.toml` の `[assets]` でも指定済み）
- Root directory: `/`
- Node version: 22
- ビルド時の環境変数は **Settings > Build > 「Build variables and secrets」** に `<NAME>_PRODUCTION` / `<NAME>_PREVIEW` の形で登録（ランタイム用の Variables & Secrets ではない）。PR / 非本番ブランチも自動ビルドするため、非本番ブランチビルドを有効化しておく。

## 技術スタック

| 用途                 | ライブラリ                                     |
| -------------------- | ---------------------------------------------- |
| フレームワーク       | Astro 7 (静的サイト生成)                       |
| インタラクティブ部品 | React 19 (Astro Islands)                       |
| 言語                 | TypeScript                                     |
| スタイリング         | Tailwind CSS v4 (`@tailwindcss/vite`)          |
| PDF表示              | @pdftron/pdfjs-express-viewer (クライアント側) |

## ディレクトリ構造

```
tohyamago/
├── astro.config.mjs            # Astro 設定 (React + Tailwind v4)
├── eslint.config.js            # ESLint (flat config: TS / React / a11y / Astro)
├── .prettierrc.json            # Prettier 設定 (.prettierignore も併設)
├── vitest.config.ts            # Vitest 設定 (vitest.setup.ts も併設)
├── tsconfig.json
├── package.json
├── src/
│   ├── pages/                  # ファイルベースルーティング
│   │   ├── index.astro         # トップ (ヒーロー + 3導線 + 今月の活動 + 物語teaser + 近況ダイジェスト)
│   │   ├── purpose.astro       # 活動趣旨
│   │   ├── story.astro         # 活動の始まり物語 (新規)
│   │   ├── join.astro          # はじめての方へ / 参加案内 (新規)
│   │   ├── calendar.astro      # 農作業カレンダー (新規)
│   │   ├── products.astro      # 成果品紹介 → shop (新規)
│   │   ├── support.astro       # 寄付案内 (新規, Phase 4)
│   │   ├── membership.astro    # 入会案内
│   │   ├── news.astro          # 近況一覧 (新規, 全記事をダイジェストカードで表示。トップは最新数件)
│   │   ├── news/
│   │   │   ├── [slug].astro     # 記事個別ページ (新規, 全文＋写真＋前後記事導線。SEO/共有用)
│   │   │   └── archive.astro    # 近況アーカイブ (新規, 公開年でまとめた索引ページ)
│   │   ├── articles.astro      # 定款 (PDF, fullscreen)
│   │   ├── public_notices.astro# 公告 (URL 固定・変更禁止)
│   │   └── notation.astro      # 特定商取引法に基づく表記
│   ├── layouts/
│   │   └── BaseLayout.astro    # 共通レイアウト (SiteHeader + SiteFooter)
│   ├── components/
│   │   ├── SiteHeader.astro    # グローバルナビ (新規, ジャーナリー導線ヘッダー)
│   │   ├── SiteFooter.astro    # 共通フッター (法令・規約 / 法人概要。旧 RouterMenu の収れん先)
│   │   ├── JourneyCards.astro  # トップの3導線カード (新規: 参加/購入/支える)
│   │   ├── homeTasks.ts        # トップ「今月の活動」抽出ロジック (crops から当月作業)
│   │   ├── homeTasks.test.ts   # homeTasks のテスト (Vitest)
│   │   #  ↑ 旧 HomeTabs.tsx / HomeTabs.test.tsx (近況/予定タブ) は廃止・削除済み (「近況 / 予定の扱い」参照)
│   │   ├── FarmCalendar.tsx    # 農作業ガントチャート (新規, React island)
│   │   ├── FarmCalendar.test.tsx # FarmCalendar のテスト (新規, Vitest)
│   │   ├── ProductCard.astro   # 成果品カード (新規)
│   │   ├── Button.astro        # 共通 UI プリミティブ (CTA ボタン)
│   │   ├── Card.astro          # 共通 UI プリミティブ (カード)
│   │   ├── Container.astro     # 共通 UI プリミティブ (コンテナ幅)
│   │   ├── SectionHeading.astro# 共通 UI プリミティブ (「三つの実」見出し)
│   │   ├── Posts.astro         # Content Collection からダイジェストカード一覧を描画 (PostCard のグリッド。ctaEvery で NewsCta を挿入)
│   │   ├── PostCard.astro       # 近況一覧のダイジェストカード (新規, 抜粋＋サムネイル → /news/[slug])
│   │   ├── postExcerpt.ts       # 記事本文から一覧用プレーンテキスト抜粋を作る純粋関数 (新規)
│   │   ├── postExcerpt.test.ts  # postExcerpt のテスト (Vitest)
│   │   ├── postDate.ts          # 記事日付を「YYYY年M月D日(曜)」へ整形する純粋関数 (新規)
│   │   ├── postDate.test.ts     # postDate のテスト (Vitest)
│   │   ├── postArchive.ts       # 記事を公開年でグループ化する純粋関数 (新規, /news/archive 用)
│   │   ├── postArchive.test.ts  # postArchive のテスト (Vitest)
│   │   ├── postSeason.ts        # 記事日付を季節 (春夏秋冬) に分類する純粋関数 (新規)
│   │   ├── postSeason.test.ts   # postSeason のテスト (Vitest)
│   │   ├── newsArchiveFilter.ts # 近況アーカイブの季節フィルタ DOM 操作ロジック (新規, クライアント側)
│   │   ├── newsArchiveFilter.test.ts # newsArchiveFilter のテスト (Vitest, jsdom)
│   │   ├── NewsCta.astro        # 「次は、あなたの番です」CTA (記事間 compact / 末尾 full で再利用)
│   │   ├── postCtaLayout.ts     # 記事間 CTA の挿入位置を決める純粋関数
│   │   ├── postCtaLayout.test.ts# postCtaLayout のテスト (Vitest)
│   │   ├── BlurImage.astro      # ブラー placeholder (LQIP/blur-up) 付き画像ラッパー (新規)
│   │   ├── blur-placeholder.ts  # ビルド時に元画像から極小ぼかし下絵 (base64) を生成 (新規, sharp。サーバー側のみ)
│   │   ├── blur-placeholder.test.ts # blur-placeholder のテスト (Vitest, sharp モック)
│   │   ├── image-fade-in.ts     # 写真のフェードイン制御 (新規, クライアント側。低速回線の遅延感をやわらげる)
│   │   ├── image-fade-in.test.ts # image-fade-in のテスト (Vitest, jsdom)
│   │   └── PdfViewer.tsx       # PDF.js Express ラッパー (React, client:only)
│   ├── content.config.ts       # Content Collection スキーマ (posts / crops / events)
│   ├── buildEnv.ts             # ビルド時変数を本番/プレビューで出し分ける純粋関数 (astro.config.mjs が利用)
│   ├── buildEnv.test.ts        # buildEnv のテスト (Vitest)
│   ├── content/
│   │   ├── posts/              # 記事 (Markdown) と添付画像
│   │   ├── crops/              # 農作業カレンダーの作物・作業データ (新規, YAML)
│   │   └── events/             # 地域イベントデータ (新規, YAML)
│   ├── assets/                 # Astro が処理する画像・PDF
│   │   ├── farm.jpg
│   │   ├── mounts.jpg
│   │   └── articles.pdf
│   ├── types/                  # 型定義の補完 (例: pdfjs-express-viewer.d.ts)
│   └── styles/global.css       # Tailwind の import と body スタイル
├── public/
│   ├── _headers                # Cloudflare Pages のヘッダー設定
│   └── .well-known/
│       └── apple-developer-merchantid-domain-association
├── wrangler.toml               # Cloudflare Pages 設定 (出力ディレクトリ)
└── .github/workflows/ci.yml    # 品質チェック CI + フォーク PR のみフルビルド検証 (デプロイは Cloudflare 側)
```

## サイト構成（情報設計）

> 設計の背景・ユーザー導線の考え方は [`README.md` の「サイト構成（情報設計とユーザー導線）」](./README.md) を参照。本節は実装者向けに **ルート・コンポーネント・データ構造・実装順序** を具体化したもの。

### 設計方針（ターゲットとゴール）

- **ターゲット（新規来訪者を主眼）**
  - 農作業・イベントに参加したいボランティア参加者（特にこれから参加する **20〜40 代**）… 最優先導線
  - 寄付・購入を検討する支援者（**富裕層・高齢層**）
  - ※ 既存の参加者・寄付者向けの深い情報発信は将来のマイページ（Clerk, Phase 5）に委ね、**公開サイトは「入口」に徹する**
- **ゴール優先順位**
  1. 継続的な（2 回以上）活動参加者を増やす ＝ **コミュニティの拡大（最優先）**
  2. 活動に賛同する気持ちでのショップ購入
  3. 継続寄付する会員数の増加
  - まずは金額よりコミュニティの大きさを優先する
- **情報設計の原則**: 新規来訪者を「**知る → 参加する**」へ最短で導く。各ページに次の一歩（CTA）を必ず置き、迷子を作らない。

### グローバルナビ（ジャーナリー導線）

団体組織図ではなく **来訪者のやりたいこと** で章立てする。ゴール優先順位の高い「参加する」を最も目立たせる。

| ナビ項目         | 内包ページ                          | 主ターゲット     |
| ---------------- | ----------------------------------- | ---------------- |
| 活動を知る       | 活動趣旨 / 始まり物語 / 近況        | 参加・支援の両方 |
| **参加する**(主) | はじめての方へ / 農作業カレンダー   | 新規ボランティア |
| 成果品           | 成果品紹介 →（外部）ショップ        | 購入支援者       |
| 支える           | 寄付 / 入会案内                     | 寄付・会員支援者 |
| （フッター）     | 定款 / 公告 / 特商法表記 / 法人概要 | 法令・信頼性     |

- かつての左下フローティング「法令」(`RouterMenu.tsx`、旧「目次」) は廃止し、**ヘッダーナビ (`SiteHeader.astro`) とフッター (`SiteFooter.astro`) へ収れん済み**（README ロードマップ Phase 2 / 実装ステップ 10）。ジャーナリー導線はヘッダーが担い、法令系の文書（定款 / 公告 / 特商法表記）と法人概要はフッターへ整理した。
- ヘッダーは常時「**参加する / 寄付**」の 2 CTA をボタン表示し、どのページからもゴール導線に届くようにする。

### ページ一覧（新構成）

> 区分: 現行=既存維持, 変更=既存を改修, 新規=新設。「現状のコンテンツは全て含める」方針のため既存ページは削除しない。

| パス              | コンポーネント         | 区分 | 主ターゲット     | 説明                                                                                       |
| ----------------- | ---------------------- | ---- | ---------------- | ------------------------------------------------------------------------------------------ |
| `/`               | `index.astro`          | 変更 | 全員             | ヒーロー＋3 導線カード＋今月の活動（カレンダー誘導）＋始まり物語 teaser＋近況ダイジェスト  |
| `/purpose`        | `purpose.astro`        | 現行 | 参加・支援       | 活動趣旨（ミッション・ビジョン）                                                           |
| `/story`          | `story.astro`          | 新規 | 参加・支援       | **活動の始まり物語**（初期エピソードで活動の性質への理解を助ける）                         |
| `/join`           | `join.astro`           | 新規 | 新規ボランティア | **はじめての方へ**（参加の流れ・FAQ・アクセス・持ち物・服装・activo 募集導線）             |
| `/calendar`       | `calendar.astro`       | 新規 | 参加者＋運営     | **農作業カレンダー**（作物 × 作業時期のガント＋地域イベント重畳）                          |
| `/products`       | `products.astro`       | 新規 | 購入支援者       | 成果品紹介（下栗芋・茶・蕎麦・大豆のストーリー）→ shop.tohyamago.org                       |
| `/support`        | `support.astro`        | 新規 | 寄付支援者       | 寄付案内（単発／継続）。Stripe 導線は Phase 4 で実装                                       |
| `/membership`     | `membership.astro`     | 現行 | 会員支援者       | 入会案内（権限・年会費・入会手続き）                                                       |
| `/news`           | `news.astro`           | 新規 | 全員             | **近況一覧**（全記事をダイジェストカードで表示。`Posts.astro` 全件）。トップは最新数件のみ |
| `/news/[slug]`    | `news/[slug].astro`    | 新規 | 全員             | 記事個別ページ（全文＋写真＋前後記事導線。共有・SEO 用）                                   |
| `/news/archive`   | `news/archive.astro`   | 新規 | 全員             | **近況アーカイブ**（公開年でまとめた索引／年表）                                           |
| `/articles`       | `articles.astro`       | 現行 | —                | 定款（PDF ビューワー、fullscreen）                                                         |
| `/public_notices` | `public_notices.astro` | 現行 | —                | 公告。**URL は法人登記に記載のため変更禁止**                                               |
| `/notation`       | `notation.astro`       | 現行 | —                | 特定商取引法に基づく表記                                                                   |

#### 近況 / 予定の扱い

- **近況一覧は `/news`（`news.astro`）に集約**し、`Posts.astro`（＝`PostCard` のグリッド）で全記事を描画する。各記事は本文を全文ではなく **ダイジェスト（抜粋＋サムネイル 1 枚）のカード**で見せ、概ね一定サイズに揃える。カードをタップすると **記事個別ページ `/news/[slug]`** で全文と全写真を読める。トップ（`index.astro`）は **最新数件のダイジェスト（`<Posts limit={3} />`）のみ**を載せ、「これまでの活動をもっと見る」CTA で `/news` へ誘導する。ヘッダーナビ「近況」も `/news` を指す。
  - 記事スキーマは `title`（必須）を持ち、一覧カード・前後記事の導線・個別ページ見出し・`<title>`／SNS 共有の見出しに使う。本文の抜粋（プレーンテキスト化＋字数切り詰め。純粋関数 `postExcerpt.ts`）はカードのリード文として `title` の下に併記する。日付整形は `postDate.ts` が担う。
- **記事個別ページ `/news/[slug].astro`**: `getCollection('posts')` を新しい順に並べ `getStaticPaths` で全件生成。本文・全写真・`sourceUrl` を表示し、前後（新しい／古い）記事への導線と `/news`・`/news/archive` への戻り導線、末尾 `NewsCta`（full）を置く。
- **近況アーカイブ `/news/archive.astro`**: ロードマップ Phase 2「年・季節・作物でのアーカイブ導線」「これまでの歩みを辿れる年表」に対応。**公開年** を切り口に章立てする。年でグループ化する純粋関数 `postArchive.ts`（`groupPostsByYear`）を使い、年へのジャンプナビ＋年ごとの索引リスト（日付＋`title` 1 行）で構成する。
  - **季節フィルタ**: 季節は日付から判定できるため（スキーマ拡張不要）、年別の索引に **春夏秋冬の絞り込み**を重ねる。季節判定は純粋関数 `postSeason.ts`（`getSeason`。境界は春 3/1–6/20・夏 6/21–9/15・秋 9/16–12/5・冬 12/6–翌 2 月末で年をまたぐ）。フィルタの DOM 操作（記事の表示切替・空の年セクション/年ナビの非表示・件数更新・`aria-pressed` 同期）は `newsArchiveFilter.ts`（`applySeasonFilter`）に分離し jsdom でテストする。JS 無効時は全件表示のままのプログレッシブエンハンスメント。
- 全記事一覧（130 件超）は縦に長く、末尾の「次は、あなたの番です」CTA に辿り着けない問題があったため、`<Posts ctaEvery={12} />` で **一定間隔（12 件ごと）に `NewsCta`（compact）を差し込み**、どこまで読んでも参加・支援への一歩に出会えるようにしている。挿入位置は純粋関数 `postCtaLayout.ts`（`ctaPositions`）が決定し、最終記事直後は末尾の本 CTA（`NewsCta` full）と重複しないよう除外する。
- トップ末尾の近況ダイジェストには `id="feed"` を残し、旧 `/#feed` ブックマークの着地点として後方互換を保つ（新規リンクは `/news` を使う）。
- かつての「近況 / 予定」タブ（旧 `HomeTabs.tsx`）は廃止。情報量の薄かった「予定」タブは **`/calendar`（農作業カレンダー）と、トップの「今月の活動」プレビュー（`homeTasks.ts`）へ発展的に統合**した。activo の募集 CTA は `/join` に集約している。

## 記事 (Content Collection)

- `src/content/posts/` に `<slug>.md` (Markdown 本文) を配置
- 添付画像は `src/content/posts/<slug>/<filename>` に置き、frontmatter の `images` で参照
- スキーマは `src/content.config.ts` で定義 (`title` / `date` / `tags` / `images` / `sourceUrl`)
  - `title`（必須）: 一覧・個別ページ・SEO/SNS 共有の見出し
  - `tags`（任意, 既定 `[]`）: 作物・作業・地名などのキーワード。SNS のハッシュタグ流用も想定し、個別ページ末尾に `#タグ` として表示する
- Markdown は `remark-breaks` で単一改行も `<br>` 化されるため、Facebook 風の改行スタイルがそのまま再現される

### 外部リンク

- ボランティア募集: `https://activo.jp/s/a/119414`
- 成果品販売: `https://shop.tohyamago.org`

## 新規コンテンツの仕様

### 活動の始まり物語 (`/story`)

- **目的**: 初期エピソード（2018 年の下栗応援サークル発足〜法人化までの経緯、AgriRecorder による「ゆるいつながり」づくり、お茶手摘みへの挑戦など）を物語として読ませ、活動の **性質・温度感** への理解を助ける。趣旨ページ（理念）が「なぜ」を語るのに対し、物語ページは「どう始まり・続いてきたか」を語る。
- **位置づけ**: `purpose`（理念）→ `story`（経緯）→ `join`（参加）という理解の階段を作る。
- **構成案**:
  1. 導入（一文のキャッチ＋下栗の里の写真）
  2. 年代別の節（2018〜2019 / 2020〜2022 / 2023〜2024 / 2025〜）。各節に当時の記事（`src/content/posts/`）の写真・引用を 1〜2 点添える。
  3. 「法人化（2024-10-01）」の節で、サークルから一般社団法人へ形を変えた意味を説明。
  4. 末尾に CTA（「あなたも畑へ → `/join`」「物語の続きは近況で →」）。
- **データソース**: 既存記事を活用。年表本文は `story.astro` に直接記述、または `src/content/posts/` から該当記事を slug 指定で引用するヘルパーを用意。記事 frontmatter（`title` / `date` / `tags` / `images` / `sourceUrl`）の後方互換は厳守。
- **README の「これまでの歩み」** と内容を重複させず、README は方針、`/story` は読み物として作り分ける。

### 農作業カレンダー (`/calendar`)

サイトの新しい目玉機能。**二つの役割**を同時に満たす。

1. **参加意欲の喚起（対 新規ボランティア）**: 「いつ・どの作物の・どんな作業に参加できるか」を一目で示し、「この時期に行ってみたい」を引き出す。各作業から `/join`・activo へ送客する。
2. **運営の確認用（対 管理者）**: 作付け・作業・地域行事の年間スケジュールを一望できる、編集しやすいデータ台帳。

#### 表示要件

- 横軸＝1〜12 月（ガントチャート風）。縦軸＝作物（行）。各作業を期間バーで表示。
- バーは色分け（作物ごと）。**ボランティア歓迎の作業は強調**（テラコッタ `accent` 等）し、参加対象が直感的に分かるようにする。
- **地域イベント**を別レーン（または月軸上のマーカー）として重畳表示。
- **当月をハイライト**（縦ライン or 当月列の強調）し、「今・近いうちに参加できる作業」へ視線を誘導。
- バーのクリック/タップで詳細（作業内容・ひとこと・参加 CTA）を展開。
- レスポンシブ: モバイルは横スクロール、または「月 → 作業」の縦リストにフォールバック。
- アクセシビリティ: 色だけに依存しない（ラベル・凡例・`aria`）。スクリーンリーダー向けに表形式の意味を保持。

#### データ構造（Content Collections）

作物の作業は **毎年ほぼ同時期に繰り返す** ため月（半月）粒度の循環データ、地域イベントは **特定日** を持つデータ、として分離する。管理者が 1 ファイルで更新できるよう YAML データコレクションとする（`content.config.ts` に追加）。

`src/content/crops/<id>.yaml`（作物 1 件＝1 ファイル）:

```yaml
name: 下栗芋
emoji: 🥔
color: '#a65f3b' # ガントバーの基調色
order: 1 # 表示順
tasks:
  - label: 植付
    start: 4.0 # 月.上下旬 (整数=上旬, .5=下旬)。例: 4.0=4月上旬, 4.5=4月下旬
    end: 4.5
    volunteer: true # ボランティア歓迎 → 強調＆CTA表示
    note: 種芋の植え付け。初参加歓迎。
  - label: 管理（除草・土寄せ）
    start: 5.0
    end: 8.5
    volunteer: true
  - label: 収穫（芋掘り）
    start: 9.0
    end: 10.5
    volunteer: true
```

`src/content/events/<id>.yaml`（地域イベント 1 件＝1 ファイル）:

```yaml
name: 霜月祭
start: 12.0 # 月.上下旬。複数日にまたがる行事は start/end で範囲指定
end: 12.5
category: 地域行事 # 地域行事 / 当会イベント / 販売 など
location: 遠山郷各地区
url: https://example.com # 任意
note: 国指定重要無形民俗文化財。
```

> **シードデータ（既存記事から推定。実装時に運営が確定）**: 下栗芋＝植付 4 月／管理 5〜8 月／収穫 9〜10 月、大豆＝種まき 5 月下旬〜6 月／収穫・脱穀 11〜12 月、蕎麦＝種まき 8 月／収穫・脱穀 10〜11 月、茶＝茶摘み（新茶）5 月／整枝 夏〜秋。地域行事は運営が随時追加。

`content.config.ts` への追加イメージ:

```ts
// 月.上下旬 (1.0〜12.5, 0.5 刻み)。CSS Grid の列計算に直結するためスキーマで厳密に検証する
const halfMonth = z
  .number()
  .min(1.0)
  .max(12.5)
  .refine((n) => n % 0.5 === 0, {
    message:
      '値は 1.0〜12.5 の 0.5 刻み（整数=上旬, .5=下旬）で指定してください',
  })

const crops = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/crops' }),
  schema: z.object({
    name: z.string(),
    emoji: z.string().optional(),
    color: z.string(),
    order: z.number().default(0),
    tasks: z.array(
      z.object({
        label: z.string(),
        start: halfMonth,
        end: halfMonth,
        volunteer: z.boolean().default(false),
        note: z.string().optional(),
      }),
    ),
  }),
})

const events = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/events' }),
  schema: z.object({
    name: z.string(),
    start: halfMonth,
    end: halfMonth,
    category: z.string().default('地域行事'),
    location: z.string().optional(),
    url: z.url().optional(),
    note: z.string().optional(),
  }),
})
```

#### コンポーネント設計

- `FarmCalendar.tsx`（React island, `client:load`）。当月ハイライト・バー展開などのインタラクションを担う。データは `calendar.astro`（Astro 側で `getCollection('crops'|'events')`）から props で受け渡す。
- レイアウトは **CSS Grid**（12 列＝月、半月粒度なら 24 列）。バーは `grid-column: start / end` でスパン。色は作物の `color`、ボランティア作業は枠線/塗りで強調。
- 凡例（作物色・ボランティア歓迎マーク・イベント種別）を別表示。
- テストは `FarmCalendar.test.tsx`（代表ケース: 当月ハイライト、ボランティアバーの強調クラス、イベント描画）。

### ナビゲーション再設計（`SiteHeader.astro`）

- 上記「グローバルナビ」を実装。ドロップダウン（活動を知る／参加する／支える）＋常時表示 CTA（参加する・寄付）。
- `BaseLayout.astro` に組み込み（`RouterMenu` からの移行は完了）。`currentPath` でアクティブ表示。
- a11y: キーボード操作・フォーカスリング・`aria-current`。モバイルはハンバーガーで全項目を展開する。

## 実装ステップ（段階的コーディング手順）

各ステップは独立リリース可能。**静的構成のまま**進め、決済（Stripe）・認証（Clerk）は README ロードマップ Phase 4/5 に従い後段でハイブリッド化する。

> **進捗メモ**: ステップ 1〜10 は実装済み（静的構成での骨格は一巡）。以降は各ページのコピー・データ拡充と、Phase 4/5（決済・認証）でのハイブリッド化が中心。本節は「何を・どの順で作るか」の設計意図として残す。

1. **ナビ基盤**: `SiteHeader.astro` を新設し `BaseLayout` に組込み（ジャーナリー導線＋常時 CTA）。旧 `RouterMenu` はステップ 10 で廃止。
2. **始まり物語**: `story.astro` を新設（既存記事の写真・引用を活用）。`purpose → story → join` の導線を張る。
3. **参加案内**: `join.astro` を新設（参加の流れ・FAQ・アクセス・持ち物、activo CTA を集約）。旧「予定」タブの activo 導線をここへ移設。
4. **農作業カレンダー（データ）**: `content.config.ts` に `crops` / `events` コレクションを追加し、`src/content/crops`・`src/content/events` にシードデータを投入。
5. **農作業カレンダー（UI）**: `FarmCalendar.tsx` ＋ `calendar.astro` を実装。トップ（`index.astro`）に「今月の活動」プレビュー（`homeTasks.ts`）を追加し、旧「予定」タブをカレンダーへ統合。
6. **成果品**: `products.astro` ＋ `ProductCard.astro` を新設（下栗芋・茶・蕎麦・大豆のストーリー → shop へ送客）。
7. **トップ刷新**: `index.astro` にヒーロー＋3 導線カード（`JourneyCards.astro`）＋近況/カレンダー/物語の各プレビューを配置。
8. **寄付**: `support.astro` を新設（当面は案内のみ）。Stripe 導線は Phase 4 で実装。
9. **記事個別ページ（任意）**: `news/[slug].astro` を追加し SEO/共有を改善。
10. **ナビ統合の仕上げ**: `RouterMenu` を廃止し、ヘッダー (`SiteHeader.astro`) とフッター (`SiteFooter.astro`) へ収れん。フッターに法人情報（定款・公告・特商法・法人概要）を整理。

> 各ステップ完了時に `npm run lint` / `format:check` / `typecheck` / `test` / `build` を通すこと。新規 React island には代表的な Vitest テストを添える。

## 環境変数

| 変数名                 | 用途                                                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PDFJS_EXPRESS_VIEWER` | PDF.js Express ビューワーライセンスキー                                                                                                                                                                        |
| `GA_MEASUREMENT_ID`    | Google Analytics 測定 ID（例: `G-XXXXXXXXXX`）。`BaseLayout.astro` が設定時のみ gtag.js を出力。未設定なら計測タグなし（ローカル開発・プレビュー）                                                             |
| `GOOGLE_MAPS_API_KEY`  | Maps JavaScript API のブラウザキー。`/access` のインタラクティブ地図（`AccessMap.tsx`）で使う。設定時のみ JS 地図を出し、未設定なら API キー不要の埋め込み iframe にフォールバック（ローカル開発・プレビュー） |

いずれも秘匿情報ではない（`GA_MEASUREMENT_ID` は公開される測定 ID、`PDFJS_EXPRESS_VIEWER` はドメイン固定のビューワーキー、`GOOGLE_MAPS_API_KEY` は HTTP リファラ制限で保護する公開のブラウザキー）ため、**シークレットではなく通常の「変数」として扱う**。`GOOGLE_MAPS_API_KEY` は Google Cloud 側で「HTTP リファラ（本番・プレビューのドメイン）」と「Maps JavaScript API」に利用を絞っておく。

- **デプロイ時（Cloudflare）**: 静的生成でビルド時に HTML へ焼き込むため、**Settings > Build > 「Build variables and secrets」**（＝ビルド変数。ランタイム用の Variables & Secrets ではない）に `<NAME>_PRODUCTION` / `<NAME>_PREVIEW` の形で登録し、ビルド時にブランチで出し分ける（上記「環境変数の本番 / プレビュー切り分け」参照）。プレビューに出したくない変数は `_PREVIEW` を未設定にする。
- **CI（GitHub Actions）**: `ci.yml` のビルド検証・E2E は値を必要としない（テストが GA/PDF ビューワーの値に依存しないため）。素の名前が未設定なら `import.meta.env.*` は undefined になるだけでビルドは成功する。必要になった場合のみ GitHub Actions の **Variables（`vars`）** に素の名前で登録する（`resolveBuildEnv` は素の名前を最優先する）。

> 今後追加する Stripe / Clerk のシークレットキーは秘匿情報のため扱いが異なる。ビルド変数には置かず（公開リポジトリの PR ビルドにも見えてしまう）、ランタイムのシークレットとして本番/プレビュー別々に設定し、CI で必要なものは GitHub Secrets に登録する。

## 開発コマンド

```bash
npm ci          # 依存インストール
npm run dev     # 開発サーバー (http://localhost:4321)
npm run build   # 静的ビルド (dist/)
npm run preview # ビルド成果物のローカル確認
```

## 品質チェック (Lint / Format / 型チェック / テスト)

ロードマップ Phase 0 の「Lint / Format / 型チェックの整備」に対応。CI (`ci.yml`) でも同じコマンドを実行する。

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
- **テスト (方針)**: リグレッションテストは可能な限りコードを広くカバーする。ブラウザ依存の不具合 (NG) を修正したときは、その再発防止として実ブラウザテストを追加する。
  - **単体/結合 (jsdom)**: Vitest + Testing Library。React アイランドや DOM ロジックの「動き」と「スタイリング」を `src/**/*.{test,spec}.{ts,tsx}` に配置。インライン `<script>` のロジックは `*.ts` モジュールへ分離してテスト可能にする (例: `SiteHeader.astro` の挙動は `siteHeaderNav.ts` に分離し `siteHeaderNav.test.ts` で検証)。
  - **E2E (実ブラウザ)**: Playwright (`playwright.config.ts` / `e2e/*.spec.ts`)。jsdom が扱えないレイアウト・重なり順 (z-index/stacking) など、描画を伴う回帰のみを対象とする。CI では `e2e` ジョブで `npx playwright install --with-deps chromium` 後に実行する。
  - **カバレッジ (Codecov)**: `vitest.config.ts` の `coverage` 設定で v8 プロバイダを使い `coverage/lcov.info` を生成する。CI (`ci.yml`) の `coverage` ジョブが `npm run test:coverage` を実行し、`codecov/codecov-action` で Codecov へ送信する。トークンは GitHub Secrets の `CODECOV_TOKEN` を参照（公開リポジトリではトークンなしでも動作するが、設定推奨）。Codecov のステータスは導入初期のため `codecov.yml` で非ブロッキング（情報提供）にしてある。

## ビルド時の補助処理

PDF.js Express ビューワーは `node_modules/@pdftron/pdfjs-express-viewer/public/` 配下に静的アセット (Web Worker 等) を持つ。`npm run build` の `postbuild` フックでこれらを `dist/` へコピーしているため、ローカル / GitHub Actions / Cloudflare Pages のいずれの環境でも自動で配置される。

## デザイン規則

- カラーテーマ: green / lime (山・自然を想起)
- 装飾モチーフ（▲ に限定しない方針。2026-06 更新）
  - **ロゴ (`SiteLogo.astro`) の「山＝▲」はブランドマークの核として維持**する。▲（山）はブランドマークの核に限定し、サイト全体を山モチーフで埋め尽くさない。
  - **見出し (`SectionHeading.astro`) は ▲ を廃止**し、**「三つの実」マーク**（深緑→陽光→コーラルの、上昇する 3 つの凹面ひし形。サイズ強弱・微回転で動きを出す）を使う。実り・広がり・育つコミュニティを表す差し色モチーフとして、ロゴの山 (▲) と役割を分ける。色は必ずデザイントークン（`fill-primary` / `fill-sunlight` / `fill-accent`）で指定し、ハードコード hex を使わない。
  - **バッジ（ラベルピル）の ▲ は廃止**する方針 → 下記「バッジ（ラベルピル）の方針」。
  - ▲ を残す箇所（ロゴ等）の描画は Tailwind の `before:` / `after:` 疑似要素で border-trick / `content` を利用。
- **バッジ（ラベルピル）の方針**（2026-06 決定。**記録のみ。置換は今後の修正時に段階的に適用**）
  - 団体名・小ラベルのピルは、ヒーロー (`index.astro`) で作成した **三角なしのベタピル**に寄せる。基準スタイル（標準サイズ）:
    `rounded-full bg-primary-deep px-4 py-1 font-serif text-sm tracking-wide text-white`（＋ `▲` は付けない）。
    - 暗い写真の上に重ねる場合は `ring-1 ring-white/25` と `[text-shadow:0_1px_3px_rgba(15,46,33,0.6)]` を足す。明るい地色の上ではベタのまま（白文字で AA を確保）。`backdrop-blur` はベタ背景には不要。
    - **コンパクトサイズも許容**する。カードのタイトル行末尾など、見出しに添える小さなステータスピル（例: `JourneyCards.astro` の「なかま募集中」）では、本文・見出しを圧迫しないよう縮めてよい。基準: `rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium tracking-wide text-white`（`font-serif` の代わりに `font-medium`、地色は文脈に合わせ `bg-primary-deep` か差し色の `bg-accent-strong` 等）。**三角なし・ベタ塗り・白文字・`rounded-full`** という核は標準サイズと共通で、サイズ（padding / font-size / weight）と地色だけを用途に合わせて変える。
  - 旧スタイル（`bg-sunlight-soft` 等の淡色ピル＋ `before:content-['▲']`、`text-primary-deep` 文字）は順次これへ置換する。
  - 置換対象（アイブロウのラベルピル）: `pages/news.astro` /
    `pages/story.astro` / `pages/products.astro` / `pages/join.astro` /
    `pages/news/archive.astro` / `components/ComingSoon.astro`。
  - ▲ をラベル/見出しの**前置記号**として使う箇所（`components/JourneyCards.astro` のカードラベル、`components/NewsCta.astro` の見出し、`components/SiteHeader.astro` モバイルのグループ見出し）はピルではないため本方針の主対象ではないが、▲ を外す方向で**併せて見直してよい**（要否は個別判断）。
  - **対象外**: `SiteLogo.astro` のブランドマーク、`ProductCard.astro` の作物色スウォッチ（▲ を色見本として使用）。`SectionHeading.astro` は ▲ を廃止し「三つの実」マークへ移行済み（上記「装飾モチーフ」参照）。
- フォントウェイト: light (`:root` に `font-weight: var(--font-weight-light)` を設定)
- レスポンシブ: モバイルファーストで設計
- ナビゲーション: グローバルナビ（ジャーナリー導線）は `SiteHeader.astro`、法令系文書（定款 / 公告 / 特商法表記）と法人概要は `SiteFooter.astro` に整理（旧フローティング `RouterMenu` は廃止）
- 画像（モバイル回線の体感速度）: `astro:assets` の `<Image>` を使い、`astro.config.mjs` の `image.layout='constrained'` ＋ `responsiveStyles` でレスポンシブ画像（`srcset`/`sizes`、出力は既定の webp）を**全画像で自動生成**する。画面・回線に応じた最小解像度が配信され、モバイルの転送量を抑える。グリッドやカラム内など表示幅が小さい画像には `sizes` を明示して候補選択を最適化する（例: PostCard サムネイルは `(min-width: 640px) 360px, 100vw`）。
  - ファーストビュー（LCP）の画像のみ `loading="eager"` ＋ `fetchpriority="high"`。それ以外は Astro 既定の `loading="lazy"` ＋ `decoding="async"`。`<Image>` は `width`/`height` を自動付与するためレイアウトシフト（CLS）も防げる。
  - 写真は **ブラー placeholder（LQIP / blur-up）** で表示し体感の「遅延感」を消す。`BlurImage.astro`（`<Image>` のラッパー）を使うと、ビルド時に `blur-placeholder.ts`（sharp）が元画像から極小（幅 ~20px）のぼかし下絵を base64 data URI 化してラッパー背景に即時表示し、本画像はその上にフェードインして覆う。低速回線でも白い空白やカクッとした差し込みが起きない（旧プログレッシブ JPEG/インターレースの現代的代替。webp は真のプログレッシブが効かないため下絵＋フェードで補う）。
    - `BlurImage` は形状（角丸・枠線・アスペクト・影）を `class`、画像の見え方（object-fit・彩度）を `imgClass` に分けて受け取る。角丸クリップには `overflow-hidden` を含むコンテナ（例: `Card`）かラッパー自身の `overflow-hidden` が要る。
    - フェードインは `data-fade-in` 属性を `image-fade-in.ts` が制御し、JS 無効時は `html.js` ゲートで通常表示にフォールバックする。LCP 画像は `fade={false}` で opacity アニメーションを避け、下絵の上へ即時表示する。
    - `blur-placeholder.ts` は Astro が画像メタデータに保持する元ファイルパス（`fsPath`）を sharp で読む。サーバー（ビルド / dev）側でのみ評価され、クライアントへは出力しない。

## コピー（文章）の方針

サイト全体で維持する、UI コピーのトーン指針。**見出し・CTA・カード・リード文・ナビ項目など、運営が書くサイトの「地の文」全般に適用する。**

- **「行動」にフォーカスし、「畑」という場所・モノを強調しすぎない。**「畑」「土」「耕す」に寄りすぎると、農作業そのものが目的の限定的な活動に見えてしまう。私たちの本質は **景観・暮らし・文化を守り継ぐ活動と、そこに集う人のつながり** にある。
  - 例: 「畑に参加する」→「**活動に参加する**」、「畑の一年」→「**活動の一年**」、「今、畑でできること」→「**今月の活動**」、「畑を続けてきた」→「**活動を続けてきた**」。
  - 「畑」「収穫」「お茶摘み」などの具体語は、活動内容を説明する文脈では引き続き使ってよい（×全面禁止）。あくまで**前面の見出し・CTA で過度に繰り返さない**のが趣旨。
- 来訪者の **行動（参加する・知る・支える・買う）** を主語に据え、各ページに「次の一歩」の CTA を置く（情報設計の原則と整合）。
- **「お気軽に」は使わない。** 「お気軽にお問い合わせください」「お気軽にご参加ください」のような気安さを促す表現は、具体的な意思のない問い合わせ・参加を増やしかねないため避ける。遠山郷という秘境に辿り着けるのは芯のある人だけ、という活動の性質に合わせ、参加・問い合わせ・相談へ誘う文では「お気軽に」を外して端的に書く（例: 「お気軽にお問い合わせください」→「**お問い合わせください**」、「お気軽にご相談ください」→「**ご相談ください**」）。
- **例外**: 既存の記事 (`src/content/posts/`) の本文、および読み物として書かれた始まり物語 (`/story`) の地の文は、書き手の表現をそのまま尊重し、この指針による機械的な置換は行わない。画像の `alt` も事実の描写を優先する。
