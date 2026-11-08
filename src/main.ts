import './style.css'
import logo from './assets/mcscert-left-rev.png?inline'
import favicon from './assets/mcscert-stack-col.png?inline'
import { CalendarDate } from './domain/calendar-date.ts'
import { layoutOf } from './domain/layout.ts'
import type { Report } from './domain/report.ts'
import { documentOf } from './io/add-file.ts'
import { canvasImageEncoder } from './io/canvas-image-encoder.ts'
import { documentLinks } from './io/document-links.ts'
import { DocumentsAsWritten } from './io/documents-as-written.ts'
import { openDraftStore } from './io/draft-store.ts'
import { paletteFrom } from './io/palette.ts'
import { save } from './io/save.ts'
import { writeReportDocument } from './io/write-report-document.ts'
import { mountWizard } from './ui/wizard.ts'

function today(): CalendarDate {
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

const style = getComputedStyle(document.documentElement)
const documentsAsWritten = new DocumentsAsWritten(
  canvasImageEncoder(document, style.getPropertyValue('--mac-white').trim()),
)

function written(report: Report): Promise<Uint8Array> {
  return writeReportDocument({
    layout: layoutOf(report),
    palette: paletteFrom((token) => style.getPropertyValue(token)),
    version: __VERSION__,
    writtenOn: today(),
    documents: documentsAsWritten,
  })
}

async function saveReport(report: Report): Promise<string> {
  const { fileName } = layoutOf(report)
  save(await written(report), fileName, document)
  return fileName
}

const icon = document.createElement('link')
icon.rel = 'icon'
icon.href = favicon
document.head.append(icon)

const root = document.getElementById('app')
if (root === null) {
  throw new TypeError('The page has no element to mount the wizard on')
}
const drafts = await openDraftStore()
mountWizard(root, {
  draft: await drafts.restore(),
  isDraftKept: drafts.isKept,
  keep: (report) => drafts.keep(report),
  discard: () => drafts.discard(),
  version: __VERSION__,
  logo,
  readFile: documentOf,
  saveReport,
  weighReport: (report) => documentsAsWritten.weightsOf(report, () => written(report)),
  links: documentLinks((added) => documentsAsWritten.contentShown(added)),
})
