import './style.css'
import logo from './assets/mcscert-left-rev.png?inline'
import favicon from './assets/mcscert-stack-col.png?inline'
import { CalendarDate } from './domain/calendar-date.ts'
import { layoutOf } from './domain/layout.ts'
import { Report } from './domain/report.ts'
import { documentOf } from './io/add-file.ts'
import { openDraftStore } from './io/draft-store.ts'
import { paletteFrom } from './io/palette.ts'
import { save } from './io/save.ts'
import { writeReportDocument } from './io/write-report-document.ts'
import { mountWizard } from './ui/wizard.ts'

function today(): CalendarDate {
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

async function saveReport(report: Report): Promise<string> {
  const layout = layoutOf(report)
  const style = getComputedStyle(document.documentElement)
  const bytes = await writeReportDocument({
    layout,
    palette: paletteFrom((token) => style.getPropertyValue(token)),
    version: __VERSION__,
    writtenOn: today(),
  })
  save(bytes, layout.fileName, document)
  return layout.fileName
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
  discard: async () => {
    await drafts.discard()
    return new Report()
  },
  version: __VERSION__,
  logo,
  confirm: (question) => window.confirm(question),
  readFile: documentOf,
  saveReport,
})
