import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import astro from 'eslint-plugin-astro'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  {
    // ビルド成果物や自動生成物は対象外
    ignores: ['dist/', '.astro/', '.wrangler/', 'node_modules/'],
  },

  // TypeScript / JavaScript 全般
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // React アイランド (.tsx / .jsx) — ルート直下の設定ファイルには適用しない
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: { version: '19.2' },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },

  // Astro コンポーネント
  ...astro.configs.recommended,

  {
    // 日本語コンテンツでは全角スペース (U+3000) を意図的に使うため許可する
    rules: {
      'no-irregular-whitespace': 'off',
    },
  },

  {
    // ルート直下の設定ファイル (astro/eslint/vitest 等) は Node 環境で実行される
    files: ['*.{js,mjs,ts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Prettier と競合する整形系ルールを無効化 (必ず最後)
  prettier,
)
