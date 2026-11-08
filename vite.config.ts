import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vitest/config'
import { DocumentSizes } from './src/domain/document-sizes.ts'
import { PerDiemRates } from './src/domain/per-diem-rates.ts'

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

/**
 * Refuses to build unless `config/per-diems.json` holds a rate for each meal, domestic and
 * international (ADR 0010), rather than writing a page that would fail as it opens.
 */
function checkPerDiemRates(): Plugin {
  return {
    name: 'macreport:check-per-diem-rates',
    buildStart() {
      PerDiemRates.from(JSON.parse(readFileSync('./config/per-diems.json', 'utf8')))
    },
  }
}

/**
 * Refuses to build unless `config/document-sizes.json` holds its size, more than zero (ADR 0011), rather than writing a page that would fail as it opens.
 */
function checkDocumentSizes(): Plugin {
  return {
    name: 'macreport:check-document-sizes',
    buildStart() {
      DocumentSizes.from(JSON.parse(readFileSync('./config/document-sizes.json', 'utf8')))
    },
  }
}

export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(version) },
  plugins: [checkPerDiemRates(), checkDocumentSizes(), viteSingleFile(), nameAfterVersion()],
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
