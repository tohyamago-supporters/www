import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PdfViewer from './PdfViewer'

// バンドラの CommonJS 相互運用によって import() の結果の形が変わるため、
// どちらの形でもビューワーが起動することを確認する。
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  shape: 'nested' as 'flat' | 'nested' | 'broken',
}))

vi.mock('@pdftron/pdfjs-express-viewer', () => ({
  get default() {
    if (mocks.shape === 'flat') return mocks.create
    if (mocks.shape === 'nested') {
      return { __esModule: true, default: mocks.create }
    }
    return {}
  },
}))

describe('PdfViewer', () => {
  beforeEach(() => {
    mocks.create.mockReset()
    mocks.create.mockResolvedValue({})
    mocks.shape = 'nested'
  })

  it('module.exports が default に載る形でもビューワーを起動する', async () => {
    render(
      <PdfViewer src="/articles.pdf" filename="定款" licenseKey="key-123" />,
    )

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    const [options, element] = mocks.create.mock.calls[0]
    expect(options).toEqual({
      licenseKey: 'key-123',
      initialDoc: '/articles.pdf',
      filename: '定款',
    })
    expect(element).toBeInstanceOf(HTMLElement)
  })

  it('default が直接ビューワー関数の形でも起動する', async () => {
    mocks.shape = 'flat'
    render(<PdfViewer src="/articles.pdf" filename="定款" />)

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
  })

  it('ビューワーを解決できない場合は PDF のダウンロード導線を出す', async () => {
    mocks.shape = 'broken'
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<PdfViewer src="/articles.pdf" filename="定款" />)

    const link = await screen.findByRole('link', {
      name: /定款（PDF）をダウンロード/,
    })
    expect(link).toHaveAttribute('href', '/articles.pdf')
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('ビューワーの起動に失敗した場合もダウンロード導線を出す', async () => {
    mocks.create.mockRejectedValue(new Error('boom'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<PdfViewer src="/articles.pdf" filename="定款" />)

    expect(
      await screen.findByRole('link', { name: /定款（PDF）をダウンロード/ }),
    ).toBeInTheDocument()
  })
})
