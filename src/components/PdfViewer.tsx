import { useRef, useEffect, useState } from 'react'
import { resolvePdfViewer } from './pdfViewer'

interface Props {
  src: string
  filename: string
  licenseKey?: string
}

export default function PdfViewer({ src, filename, licenseKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    let destroyed = false
    setFailed(false)
    import('@pdftron/pdfjs-express-viewer')
      .then((module) => {
        if (destroyed) return
        // バンドラの CommonJS 相互運用の違いを吸収してビューワー本体を取り出す。
        const createViewer = resolvePdfViewer(module)
        if (!createViewer) {
          throw new TypeError(
            'PDF.js Express ビューワーの読み込みに失敗しました。',
          )
        }
        return createViewer({ licenseKey, initialDoc: src, filename }, el)
      })
      .catch((error: unknown) => {
        if (destroyed) return
        console.error('PDF ビューワーを起動できませんでした', error)
        setFailed(true)
      })
    return () => {
      destroyed = true
      el.innerHTML = ''
    }
  }, [src, filename, licenseKey])

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-body">
          お使いの環境では PDF を表示できませんでした。
        </p>
        <a
          className="bg-primary-deep rounded-full px-6 py-3 font-medium text-white"
          href={src}
          download={`${filename}.pdf`}
        >
          {filename}（PDF）をダウンロード
        </a>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full" />
}
