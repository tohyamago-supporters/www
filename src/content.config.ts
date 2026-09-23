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

export const collections = { posts, crops, events }
