// 本番 / プレビューのビルド時環境変数を出し分ける純粋関数。
//
// このサイトは単一の Cloudflare Worker (tohyamago) でビルドする。本番ブランチと
// プレビュー (PR / 非本番ブランチ) のビルドが同じ Worker のビルド変数を共有するため、
// ビルド時にブランチを見て値を選び分ける。Cloudflare Workers Builds はビルド時に
// ブランチ名を WORKERS_CI_BRANCH として注入する (本番でも設定される)。
//
// 運用: Worker の Settings > Build「Build variables and secrets」に、出し分けたい
// 変数を `<NAME>_PRODUCTION` / `<NAME>_PREVIEW` の 2 つで登録する。本番ブランチの
// ビルドでは `_PRODUCTION`、それ以外では `_PREVIEW` を採用する。プレビューに値を
// 出したくない変数は `_PREVIEW` を未設定にすれば、その変数は注入されない。
// 素の名前 (例: GA_MEASUREMENT_ID) が既にあればそれを最優先する (CI のビルド検証や
// 手動上書き用。ローカル開発では .env などで素の名前を使えば従来どおり動く)。

// 本番ビルドとみなすブランチ
export const PRODUCTION_BRANCH = 'main'

// 本番 / プレビューで出し分けるビルド時変数名
export const BUILD_ENV_KEYS = [
  'GA_MEASUREMENT_ID',
  'PDFJS_EXPRESS_VIEWER',
  // Maps JavaScript API のブラウザキー (公開キー。HTTP リファラ制限で保護する)。
  // /access のインタラクティブ地図で使う。未設定ならキーレス埋め込みにフォールバック。
  'GOOGLE_MAPS_API_KEY',
] as const

/**
 * ブランチ名が本番ブランチ (PRODUCTION_BRANCH) かどうかを判定する。
 * 未設定 (ローカル開発など) やそれ以外のブランチはプレビュー扱い (false)。
 */
export function isProductionBranch(branch: string | undefined): boolean {
  return branch === PRODUCTION_BRANCH
}

/**
 * env (通常は process.env) から、ブランチに応じた最終的な値を解決して返す。
 * 本番ブランチなら各キーの `_PRODUCTION`、それ以外は `_PREVIEW` を採用し、素の名前が
 * あればそれを最優先する。戻り値は「素の名前 → 確定値」のマップで、値が無いキーは
 * 含めない (undefined を process.env に代入すると "undefined" 文字列になる事故を防ぐ)。
 *
 * @param env 参照する環境変数 (WORKERS_CI_BRANCH と各キーの値を含む)
 * @param keys 出し分け対象の変数名。既定は BUILD_ENV_KEYS
 * @returns 解決済みの「素の名前 → 値」マップ
 */
export function resolveBuildEnv(
  env: Record<string, string | undefined>,
  keys: readonly string[] = BUILD_ENV_KEYS,
): Record<string, string> {
  const suffix = isProductionBranch(env.WORKERS_CI_BRANCH)
    ? 'PRODUCTION'
    : 'PREVIEW'
  const resolved: Record<string, string> = {}
  for (const key of keys) {
    const value = env[key] ?? env[`${key}_${suffix}`]
    if (value) resolved[key] = value
  }
  return resolved
}
