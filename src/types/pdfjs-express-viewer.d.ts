// @pdftron/pdfjs-express-viewer は型定義を同梱していないため最小限の宣言を補う。
//
// 注意: このパッケージは UMD (CommonJS) 配布で、`module.exports` は
// `{ __esModule: true, default: WebViewer }` という形を取る。バンドラの
// CommonJS 相互運用の実装によって `import()` の結果は default が一段深くなる
// ことがあるため、実際にビューワー本体を取り出すときは
// `~/components/pdfViewer` の `resolvePdfViewer` を通すこと
// (直接 `default` を呼ぶと `... is not a function` で起動に失敗し得る)。
declare module '@pdftron/pdfjs-express-viewer' {
  import type { PdfViewerFactory } from '~/components/pdfViewer'

  const PdfjsExpressViewer: PdfViewerFactory

  export default PdfjsExpressViewer
}
