import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vitest/config'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }

/** Names the single page after the version it was built from (ADR 0001). */
function nameAfterVersion(): Plugin {
  return {
    name: 'macreport:name-after-version',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const page = bundle['index.html']
      if (page !== undefined) {
        page.fileName = `macreport-v${version}.html`
      }
    },
  }
}

export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(version) },
  plugins: [viteSingleFile(), nameAfterVersion()],
  build: { assetsInlineLimit: Number.MAX_SAFE_INTEGER },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts'],
      reporter: ['text', 'lcov'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
