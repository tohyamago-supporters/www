/**
 * 活動趣旨ページ (`/purpose`) の「活動の記録」を、公開済みの活動記録 (posts) から
 * ビルド時に集計する純粋関数。
 *
 * Google for Nonprofits をはじめ、外部から活動実態を確認したい読み手に対しては
 * 「何年から / 何件の記録があるか」を数字で示せることが重要になる。
 * ただし数字を手書きすると記事の追加に追従せず古びるため、
 * Content Collection を単一の情報源として算出する。
 */

/** 集計に必要な最小限の記事形 (Content Collection のエントリを想定)。 */
export interface SummarizablePost {
  data: {
    date: Date
    images?: unknown[]
  }
}

/** 活動記録の集計結果。記録が 1 件も無い場合は year 系が null になる。 */
export interface ActivitySummary {
  /** 公開している活動記録の件数 */
  postCount: number
  /** 活動記録に掲載している写真の枚数 */
  photoCount: number
  /** 最初の活動記録の年 (記録が無ければ null) */
  firstYear: number | null
  /** 最新の活動記録の年 (記録が無ければ null) */
  latestYear: number | null
  /** 最初の記録の年から現在までの年数 (両端を含む。記録が無ければ 0) */
  yearSpan: number
}

/**
 * 活動記録を集計する。
 *
 * 年は UTC 基準で取り出す (記事の date は ISO 8601 (Z) 保存のため、
 * ビルド環境のタイムゾーンで結果が揺れないようにする。`postArchive.ts` と同方針)。
 *
 * `yearSpan` は「2018年から◯年間」という表現に使うため、最初の記録の年から
 * `asOf` の年までを両端込みで数える。記事が未来日付の場合に年数が縮まないよう、
 * 最新記事の年と `asOf` の年の大きい方を終端に採る。
 *
 * @param posts 活動記録の配列 (並び順は問わない)
 * @param asOf 起点となる現在時刻 (既定は実行時の現在。テスト用に差し替え可能)
 */
export function summarizeActivity(
  posts: readonly SummarizablePost[],
  asOf: Date = new Date(),
): ActivitySummary {
  if (posts.length === 0) {
    return {
      postCount: 0,
      photoCount: 0,
      firstYear: null,
      latestYear: null,
      yearSpan: 0,
    }
  }

  let firstYear = Infinity
  let latestYear = -Infinity
  let photoCount = 0

  for (const post of posts) {
    const year = post.data.date.getUTCFullYear()
    if (year < firstYear) firstYear = year
    if (year > latestYear) latestYear = year
    photoCount += post.data.images?.length ?? 0
  }

  const endYear = Math.max(latestYear, asOf.getUTCFullYear())

  return {
    postCount: posts.length,
    photoCount,
    firstYear,
    latestYear,
    yearSpan: endYear - firstYear + 1,
  }
}
