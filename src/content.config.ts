import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      // 一覧カード・記事ページ・SEO/SNS 共有の見出しに使うタイトル (空文字・空白のみは不可)。
      title: z.string().trim().min(1),
      date: z.coerce.date(),
      // SNS でのハッシュタグ流用も想定したキーワード (例: 下栗芋 / 茶摘み / 遠山郷)。
      tags: z.array(z.string()).default([]),
      images: z.array(image()).default([]),
      sourceUrl: z.url().optional(),
    }),
})

// 月.旬 (1.0〜12.2)。各月 .0=上旬 / .1=中旬 / .2=下旬 の 3 分割。
// CSS Grid の列計算 (36 列) に直結するためスキーマで厳密に検証する。
const monthThird = z
  .number()
  .min(1.0)
  .max(12.2)
  .refine(
    (n) => {
      const third = Math.round((n - Math.floor(n)) * 10)
      return third === 0 || third === 1 || third === 2
    },
    {
      message:
        '値は 1.0〜12.2 で、各月 .0=上旬 / .1=中旬 / .2=下旬 を指定してください',
    },
  )

const crops = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/crops' }),
  schema: z.object({
    name: z.string(),
    emoji: z.string().optional(),
    color: z.string(),
    order: z.number().default(0),
    tasks: z.array(
      z
        .object({
          label: z.string(),
          start: monthThird,
          end: monthThird,
          // 作業強度の目安: light=軽め / medium=ふつう / hard=しっかり
          intensity: z.enum(['light', 'medium', 'hard']).default('medium'),
          note: z.string().optional(),
        })
        .refine((task) => task.start <= task.end, {
          message: 'start は end 以下の値を指定してください',
          path: ['end'],
        }),
    ),
  }),
})

const events = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/events' }),
  schema: z
    .object({
      name: z.string(),
      start: monthThird,
      end: monthThird,
      category: z.string().default('地域行事'),
      location: z.string().optional(),
      url: z.url().optional(),
      note: z.string().optional(),
    })
    .refine((event) => event.start <= event.end, {
      message: 'start は end 以下の値を指定してください',
      path: ['end'],
    }),
})

// 耕作地 (法人が農作業を行っている畑)。面積は実測・申告値が確定しているものだけ area に
// 記載し、未確定のものは省略する (ページ側は未記載の面積を出さない = 推計値を表に出さない)。
const fields = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/fields' }),
  schema: z.object({
    name: z.string(),
    location: z.string(),
    order: z.number().default(0),
    /** 耕作面積 (㎡)。未確定なら省略する。 */
    area: z.number().positive().optional(),
    /** crops コレクションの ID。名称・絵文字・色は crops を単一の情報源とする。 */
    crops: z.array(z.string()).default([]),
    note: z.string().optional(),
  }),
})

// 事業年度ごとの事業報告 (1 事業報告書 = 1 ファイル)。総会に提出した事業報告書・
// 附属明細書を情報源とし、/achievements はこの内容をそのまま報告の形で掲載する。
// 回数・延べ参加人数・販売点数は works / sales から数え、本文に数字を手打ちしない。
const reports = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/reports' }),
  schema: z
    .object({
      /** 年度名 (例: 令和7年度)。 */
      name: z.string(),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      /** 事業報告書の日付。 */
      reportedOn: z.coerce.date(),
      /** 概況 (段落ごとに 1 要素)。 */
      summary: z.array(z.string()).default([]),
      /** 実施状況の明細 (事業報告附属明細書の実施状況表)。 */
      works: z
        .array(
          z.object({
            date: z.coerce.date(),
            name: z.string(),
            place: z.string(),
            /** 参加人数。把握できているものだけ記載する。 */
            participants: z.number().int().positive().optional(),
            /** farmwork=遊休農地活用農作業 / hosted=当会が実施 / joined=地域行事へ参加 */
            kind: z.enum(['farmwork', 'hosted', 'joined']).default('farmwork'),
            note: z.string().optional(),
          }),
        )
        .default([]),
      /** 成果品販売状況 (平均単価は amount / units から算出する)。 */
      sales: z
        .array(
          z.object({
            item: z.string(),
            channel: z.string(),
            units: z.number().int().positive(),
            amount: z.number().nonnegative(),
            note: z.string().optional(),
          }),
        )
        .default([]),
    })
    .refine((report) => report.startDate <= report.endDate, {
      message: 'startDate は endDate 以下の日付を指定してください',
      path: ['endDate'],
    }),
})

export const collections = { posts, crops, events, fields, reports }
