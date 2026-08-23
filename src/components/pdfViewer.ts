/**
 * PDF.js Express ビューワー本体 (WebViewer 関数) をモジュールから取り出す。
 *
 * このパッケージは UMD (CommonJS) 形式で配布され、`module.exports` は
 * `{ __esModule: true, default: WebViewer }` という形を取る。
 * `import()` の結果がどうなるかはバンドラの CommonJS 相互運用の実装に依存し、
 *  - `{ default: WebViewer }`（`__esModule` を尊重する相互運用）
 *  - `{ default: { __esModule: true, default: WebViewer } }`（Node 互換の相互運用。
 *    `module.exports` をそのまま default に載せるため一段深くなる）
 * のどちらにもなり得る。実際、依存更新でこの形が変わり定款ページの
 * ビューワーが `e is not a function` で起動しなくなった。
 *
 * どちらの形でも動くよう、関数に行き当たるまで `default` を辿る。
 */

export interface PdfViewerOptions {
  licenseKey?: string
  initialDoc?: string
  filename?: string
}

export type PdfViewerFactory = (
  options: PdfViewerOptions,
  element: HTMLElement,
) => Promise<unknown>

/** `default` を辿る深さの上限 (循環参照で無限ループしないための保険)。 */
const MAX_DEFAULT_DEPTH = 5

function hasDefault(value: unknown): value is { default: unknown } {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'default' in value
  )
}

/**
 * モジュール名前空間からビューワー関数を解決する。
 * 見つからない場合は `null` を返す (呼び出し側でフォールバック表示に使う)。
 */
export function resolvePdfViewer(module: unknown): PdfViewerFactory | null {
  let candidate: unknown = module
  for (let depth = 0; depth <= MAX_DEFAULT_DEPTH; depth += 1) {
    if (typeof candidate === 'function') return candidate as PdfViewerFactory
    if (!hasDefault(candidate)) break
    candidate = candidate.default
  }
  return null
}
