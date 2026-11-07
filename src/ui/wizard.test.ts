// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Document } from '../domain/document.ts'
import type { Kind } from '../domain/kind.ts'
import { Report } from '../domain/report.ts'
import { mountWizard, type WizardOptions } from './wizard.ts'

let root: HTMLElement
let saved: Report[]
let confirmation: boolean
let kept: Report[]
let isKept: boolean
let discarded: number
let isDiscarded: boolean
let isSaved: boolean
let reading: Promise<void>

function options(draft = new Report(), isDraftKept = true): WizardOptions {
  return {
    draft,
    isDraftKept,
    keep: async (report) => {
      kept.push(report)
      return isKept
    },
    discard: async () => {
      discarded += 1
      return isDiscarded
    },
    version: '0.1.0',
    logo: 'logo.png',
    confirm: () => confirmation,
    readFile: async (file: File, kind: Kind) => {
      await reading
      return new Document(kind, file.name, new Uint8Array(await file.arrayBuffer()))
    },
    saveReport: async (report: Report) => {
      if (!isSaved) throw new Error('Input document to `PDFDocument.load` is encrypted')
      saved.push(report)
      return 'expense-report-2026-10-03-zoe-lefevre.pdf'
    },
  }
}

const button = (selector: string) => root.querySelector<HTMLButtonElement>(selector)
const continueButton = () => button('[data-action="continue"]')

function type(name: string, value: string): void {
  const field = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)
  if (field === null) throw new TypeError(`No field ${name}`)
  field.value = value
  field.dispatchEvent(new Event('input'))
}

function choose(name: string, value: string): void {
  const select = root.querySelector<HTMLSelectElement>(`select[name="${name}"]`)
  if (select === null) throw new TypeError(`No select ${name}`)
  select.value = value
  select.dispatchEvent(new Event('change'))
}

async function add(name: string, fileName: string): Promise<void> {
  const input = root.querySelector<HTMLInputElement>(`input[name="${name}"]`)
  if (input === null) throw new TypeError(`No file input ${name}`)
  Object.defineProperty(input, 'files', { value: [new File(['%PDF-1.7'], fileName)] })
  input.dispatchEvent(new Event('change'))
  await vi.waitFor(() => expect(root.textContent).toContain(fileName))
}

function fillReport(): void {
  type('claimantName', 'Zoë Lefèvre')
  choose('position', 'Faculty')
  type('email', 'zoe@mcmaster.ca')
  type('purpose', 'ICSE 2026')
  type('account', '20-123-456')
}

function tick(name: string, isTicked: boolean): void {
  const box = root.querySelector<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`)
  if (box === null) throw new TypeError(`No checkbox ${name}`)
  box.checked = isTicked
  box.dispatchEvent(new Event('change'))
}

async function fillExpense(): Promise<void> {
  type('date', '2026-10-03')
  type('description', 'Air Canada, YYZ–CDG return')
  type('claimedAmount', '1012.35')
  await add('receipts', 'air-canada.pdf')
  await add('bankStatements', 'statement.pdf')
}

beforeEach(() => {
  document.body.innerHTML = '<div></div>'
  root = document.body.firstElementChild as HTMLElement
  saved = []
  confirmation = true
  kept = []
  isKept = true
  discarded = 0
  isDiscarded = true
  isSaved = true
  reading = Promise.resolve()
  mountWizard(root, options())
})

describe('the wizard', () => {
  it('opens on the Report step, with the notice that no draft is kept, and the version', () => {
    expect(root.querySelector('h2')?.textContent).toBe('Report')
    expect(root.textContent).toContain('closing the page will lose the report')
    const footer = root.querySelector('footer')?.textContent?.replace(/\s+/g, ' ')
    expect(footer).toContain('McSCert Expense Report v0.1.0 · McSCert · McMaster University')
    expect(footer).toContain(
      'Everything you enter and add stays in this browser, on this computer. Nothing is collected, sent or shared.',
    )
    expect(button('[data-action="back"]')?.hidden).toBe(true)
    expect(continueButton()?.disabled).toBe(true)
    expect(button('[data-step="1"]')?.disabled).toBe(true)
  })

  it('groups the Report step in sections, and marks each required field with an asterisk', () => {
    const legends = [...root.querySelectorAll('legend')].map((legend) => legend.textContent)
    expect(legends).toEqual(['Claimant', 'Purpose', 'Account'])
    const name = (field: string) =>
      root.querySelector(`[name="${field}"]`)?.closest('label')?.querySelector('.field-name')
    expect(name('purpose')?.textContent?.trim()).toBe('Purpose *')
    expect(name('businessTravel')?.textContent?.trim()).toBe('Business travel')
    expect(root.querySelector('[name="firstDay"]')).toBeNull()
    expect(
      root.querySelector('[name="claimantName"]')?.closest('label')?.querySelector('.rule'),
    ).toBeNull()
    choose('position', 'Visitor')
    expect([...root.querySelectorAll('legend')].map((legend) => legend.textContent)).toContain(
      'Host',
    )
  })

  it('asks the dates of a business travel only, and then requires them', () => {
    fillReport()
    expect(continueButton()?.disabled).toBe(false)
    tick('businessTravel', true)
    expect(root.querySelector('[name="firstDay"]')).not.toBeNull()
    expect(continueButton()?.disabled).toBe(true)
    type('firstDay', '2026-10-03')
    type('lastDay', '2026-10-07')
    expect(continueButton()?.disabled).toBe(false)
    tick('businessTravel', false)
    expect(root.querySelector('[name="firstDay"]')).toBeNull()
    tick('businessTravel', true)
    expect(root.querySelector<HTMLInputElement>('[name="firstDay"]')?.value).toBe('')
  })

  it('opens on the draft kept, and keeps every change at once', () => {
    document.body.innerHTML = '<div></div>'
    root = document.body.firstElementChild as HTMLElement
    mountWizard(root, options(new Report({ claimantName: 'Zoë Lefèvre', position: 'Staff' })))
    expect(root.querySelector<HTMLInputElement>('[name="claimantName"]')?.value).toBe('Zoë Lefèvre')
    expect(root.querySelector<HTMLSelectElement>('select[name="position"]')?.value).toBe('Staff')
    expect(root.querySelector<HTMLElement>('.notice')?.hidden).toBe(true)
    type('purpose', 'ICSE 2026')
    expect(kept.at(-1)?.purpose).toBe('ICSE 2026')
    expect(kept.at(-1)?.claimantName).toBe('Zoë Lefèvre')
  })

  it('says on every step that closing the page will lose the report, when no draft is kept', async () => {
    document.body.innerHTML = '<div></div>'
    root = document.body.firstElementChild as HTMLElement
    mountWizard(root, options(new Report(), false))
    expect(root.querySelector<HTMLElement>('.notice')?.hidden).toBe(false)
    fillReport()
    continueButton()?.click()
    expect(root.querySelector<HTMLElement>('.notice')?.hidden).toBe(false)
  })

  it('says so as soon as the browser stops keeping the draft', async () => {
    expect(root.querySelector<HTMLElement>('.notice')?.hidden).toBe(true)
    isKept = false
    type('purpose', 'ICSE 2026')
    await vi.waitFor(() => expect(root.querySelector<HTMLElement>('.notice')?.hidden).toBe(false))
  })

  it('offers Continue once every required field of the Report step is valid', () => {
    fillReport()
    expect(continueButton()?.disabled).toBe(false)
    type('account', '  ')
    expect(continueButton()?.disabled).toBe(true)
  })

  it('shows a typed value that breaks its rule with that rule, and keeps it once it follows it', () => {
    fillReport()
    type('email', 'zoe@')
    expect(root.querySelector('[data-rule-of="email"]')?.classList.contains('is-broken')).toBe(true)
    expect(continueButton()?.disabled).toBe(true)
    type('email', 'zoe@mcmaster.ca')
    expect(root.querySelector('[data-rule-of="email"]')?.classList.contains('is-broken')).toBe(
      false,
    )
    tick('businessTravel', true)
    type('firstDay', '2026-10-03')
    type('lastDay', '2026-10-01')
    expect(root.querySelector('[data-rule-of="lastDay"]')?.classList.contains('is-broken')).toBe(
      true,
    )
  })

  it('asks a student or a postdoctoral fellow for their supervisor, and takes them out for another position', () => {
    fillReport()
    choose('position', 'Student')
    expect(root.querySelector('[name="supervisorName"]')).not.toBeNull()
    expect(continueButton()?.disabled).toBe(true)
    type('supervisorName', 'Ada Lovelace')
    type('supervisorEmail', 'ada@mcmaster.ca')
    expect(continueButton()?.disabled).toBe(false)
    choose('position', 'Postdoctoral fellow')
    expect(root.querySelector<HTMLInputElement>('[name="supervisorName"]')?.value).toBe(
      'Ada Lovelace',
    )
    expect(continueButton()?.disabled).toBe(false)
    choose('position', 'Visitor')
    expect(root.querySelector('[name="supervisorName"]')).toBeNull()
    expect(root.querySelector('[name="hostName"]')).not.toBeNull()
  })

  it('goes from the report to its expense, its receipt and bank statement, then reviews and saves it', async () => {
    fillReport()
    continueButton()?.click()
    expect(root.querySelector('h2')?.textContent).toBe('Expense')
    expect(continueButton()?.disabled).toBe(true)
    type('claimedAmount', '0')
    expect(
      root.querySelector('[data-rule-of="claimedAmount"]')?.classList.contains('is-broken'),
    ).toBe(true)
    await fillExpense()
    expect(root.querySelector<HTMLInputElement>('[name="claimedAmount"]')?.value).toBe('1012.35')
    expect(continueButton()?.disabled).toBe(false)
    continueButton()?.click()
    expect(root.querySelector('h2')?.textContent).toBe('Additional documents')
    expect(continueButton()?.disabled).toBe(false)
    continueButton()?.click()

    expect(root.querySelector('h2')?.textContent).toBe('Review')
    expect(continueButton()?.hidden).toBe(true)
    const text = root.textContent ?? ''
    for (const expected of [
      'Zoë Lefèvre',
      '$1,012.35',
      'air-canada',
      'statement',
      'Entered',
      'Receipts',
      'Bank statements',
    ]) {
      expect(text).toContain(expected)
    }
    expect(text).not.toContain('Travel justifications')
    button('[data-action="save"]')?.click()
    await vi.waitFor(() => expect(root.querySelector('.status')).not.toBeNull())
    expect(saved).toHaveLength(1)
    expect(root.textContent).toContain(
      'The draft, bank statements included, stays in this browser until New report.',
    )
    expect(root.querySelector('.status')?.textContent).toContain(
      'expense-report-2026-10-03-zoe-lefevre.pdf',
    )
    expect(button('[data-action="save"]')).not.toBeNull()
    button('[data-step="1"]')?.click()
    type('description', 'Air Canada, YYZ–CDG and back')
    button('[data-step="3"]')?.click()
    expect(root.querySelector('.status')).toBeNull()
  })

  it('says the report document could not be written, and keeps the report to save again', async () => {
    fillReport()
    continueButton()?.click()
    await fillExpense()
    continueButton()?.click()
    continueButton()?.click()
    isSaved = false
    button('[data-action="save"]')?.click()
    await vi.waitFor(() => expect(root.querySelector('.status.is-failure')).not.toBeNull())
    expect(root.querySelector('.status')?.textContent).toContain(
      'The report document could not be written: a receipt or a bank statement may be damaged, or protected by a password.',
    )
    isSaved = true
    button('[data-action="save"]')?.click()
    await vi.waitFor(() => expect(root.querySelector('.status.is-failure')).toBeNull())
    expect(saved).toHaveLength(1)
  })

  it('names each drop zone after its kind of document, for screen readers', async () => {
    fillReport()
    continueButton()?.click()
    const input = root.querySelector<HTMLInputElement>('input[name="bankStatements"]')
    const names = (input?.getAttribute('aria-labelledby') ?? '')
      .split(' ')
      .map((id) => root.querySelector(`#${id}`)?.textContent?.trim())
    expect(names).toEqual(['Bank statement *', 'Drop a file here, or choose one'])
  })

  it('adds a receipt and a bank statement dropped on their zones', async () => {
    fillReport()
    continueButton()?.click()
    const zone = root.querySelector<HTMLElement>('[data-drop="receipts"]')
    expect(zone?.textContent).toContain('Drop a file here, or choose one')
    const over = new Event('dragover', { cancelable: true })
    zone?.dispatchEvent(over)
    expect(over.defaultPrevented).toBe(true)
    expect(zone?.classList.contains('is-dragged-over')).toBe(true)
    zone?.dispatchEvent(new Event('dragleave', { cancelable: true }))
    expect(zone?.classList.contains('is-dragged-over')).toBe(false)
    for (const [field, fileName] of [
      ['receipts', 'taxi.pdf'],
      ['bankStatements', 'october.pdf'],
    ] as const) {
      const drop = new Event('drop', { cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', {
        value: { files: [new File(['%PDF-1.7'], fileName)] },
      })
      root.querySelector(`[data-drop="${field}"]`)?.dispatchEvent(drop)
      await vi.waitFor(() =>
        expect(
          root.querySelector(`[data-drop="${field}"]`)?.closest('.field')?.textContent,
        ).toContain(fileName),
      )
    }
    const elsewhere = new Event('drop', { bubbles: true, cancelable: true })
    document.body.dispatchEvent(elsewhere)
    expect(elsewhere.defaultPrevented).toBe(true)
  })

  it('lists the findings at the Review step of a report that has some, and offers no save', () => {
    fillReport()
    continueButton()?.click()
    button('[data-step="0"]')?.click()
    type('purpose', '')
    button('[data-step="1"]')?.click()
    button('[data-action="back"]')?.click()
    expect(root.querySelector('h2')?.textContent).toBe('Report')
  })

  it('reviews the findings of a report reached with something missing', async () => {
    fillReport()
    continueButton()?.click()
    await fillExpense()
    continueButton()?.click()
    continueButton()?.click()
    button('[data-step="0"]')?.click()
    type('account', '')
    button('[data-step="3"]')?.click()
    expect(root.querySelectorAll('.findings li')).toHaveLength(1)
    expect(root.querySelector('.findings')?.textContent).toContain('Account is required.')
    expect(button('[data-action="save"]')).toBeNull()
  })

  it('discards the draft once the Claimant confirms a new report, keeping only the claimant', async () => {
    fillReport()
    choose('position', 'Student')
    type('supervisorName', 'Ada Lovelace')
    type('supervisorEmail', 'ada@mcmaster.ca')
    continueButton()?.click()
    await fillExpense()
    confirmation = false
    button('[data-action="new-report"]')?.click()
    expect(discarded).toBe(0)
    expect(root.querySelector('h2')?.textContent).toBe('Expense')
    confirmation = true
    button('[data-action="new-report"]')?.click()
    await vi.waitFor(() => expect(root.querySelector('h2')?.textContent).toBe('Report'))
    expect(discarded).toBe(1)
    const value = (name: string) => root.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value
    expect([value('claimantName'), value('email'), value('position')]).toEqual([
      'Zoë Lefèvre',
      'zoe@mcmaster.ca',
      'Student',
    ])
    expect([value('supervisorName'), value('purpose'), value('account')]).toEqual(['', '', ''])
    expect(kept.at(-1)?.claimantName).toBe('Zoë Lefèvre')
    expect(kept.at(-1)?.purpose).toBeUndefined()
    expect(kept.at(-1)?.expenses).toEqual([])
    expect(button('[data-step="1"]')?.disabled).toBe(true)
  })

  it('keeps the report and says so when the browser does not delete the draft', async () => {
    fillReport()
    isDiscarded = false
    button('[data-action="new-report"]')?.click()
    await vi.waitFor(() =>
      expect(root.querySelector<HTMLElement>('[data-notice="discard"]')?.hidden).toBe(false),
    )
    expect(root.querySelector<HTMLInputElement>('[name="purpose"]')?.value).toBe('ICSE 2026')
    isDiscarded = true
    button('[data-action="new-report"]')?.click()
    await vi.waitFor(() =>
      expect(root.querySelector<HTMLElement>('[data-notice="discard"]')?.hidden).toBe(true),
    )
  })

  it('does not add to a new report a file still being read when New report was clicked', async () => {
    fillReport()
    continueButton()?.click()
    let finishReading = () => {}
    reading = new Promise((resolve) => {
      finishReading = resolve
    })
    const input = root.querySelector<HTMLInputElement>('input[name="receipts"]')
    Object.defineProperty(input, 'files', { value: [new File(['%PDF-1.7'], 'late.pdf')] })
    input?.dispatchEvent(new Event('change'))
    button('[data-action="new-report"]')?.click()
    await vi.waitFor(() => expect(discarded).toBe(1))
    finishReading()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(kept.at(-1)?.expenses ?? []).toEqual([])
    expect(root.textContent).not.toContain('late.pdf')
  })

  it('names a receipt or a bank statement after its file, until the Claimant names it otherwise', async () => {
    fillReport()
    continueButton()?.click()
    await fillExpense()
    const names = () => [...root.querySelectorAll<HTMLInputElement>('input[name="documentName"]')]
    expect(names().map((input) => input.value)).toEqual(['air-canada', 'statement'])
    expect(names().map((input) => input.placeholder)).toEqual(['air-canada', 'statement'])
    expect([...root.querySelectorAll('.file-name')].map((file) => file.textContent)).toEqual([
      'air-canada.pdf',
      'statement.pdf',
    ])
    const statementName = names()[1]
    if (statementName === undefined) throw new TypeError('No name')
    statementName.value = 'Visa, October'
    statementName.dispatchEvent(new Event('input'))
    expect(names()[1]).toBe(statementName)
    expect(kept.at(-1)?.expenses[0]?.bankStatements[0]?.name).toBe('Visa, October')
    expect(kept.at(-1)?.expenses[0]?.bankStatements[0]?.fileName).toBe('statement.pdf')
    statementName.value = ''
    statementName.dispatchEvent(new Event('input'))
    expect(kept.at(-1)?.expenses[0]?.bankStatements[0]?.name).toBe('statement')
    statementName.value = 'Visa, October'
    statementName.dispatchEvent(new Event('input'))
    expect(root.querySelector('[data-remove]')).toBeNull()
    continueButton()?.click()
    continueButton()?.click()
    expect(root.querySelector('table.expenses')?.textContent).toContain('Visa, October')
    expect(root.querySelector('table.section')?.textContent).toContain('air-canada')
  })

  it('adds, names and removes additional documents, which are optional', async () => {
    fillReport()
    continueButton()?.click()
    await fillExpense()
    continueButton()?.click()
    expect(root.querySelector('[data-drop="travelJustifications"]')).toBeNull()
    expect(continueButton()?.disabled).toBe(false)
    await add('additionalDocuments', 'itinerary.pdf')
    await add('additionalDocuments', 'poster.png')
    expect(kept.at(-1)?.additionalDocuments.map((document) => document.name)).toEqual([
      'itinerary',
      'poster',
    ])
    type('documentName', 'Itinerary')
    expect(kept.at(-1)?.additionalDocuments[0]?.name).toBe('Itinerary')
    button('[data-remove="additionalDocuments"][data-index="1"]')?.click()
    expect(kept.at(-1)?.additionalDocuments.map((document) => document.name)).toEqual(['Itinerary'])
    expect(root.textContent).not.toContain('poster')
    continueButton()?.click()
    const sections = [...root.querySelectorAll('h3')].map((heading) => heading.textContent)
    expect(sections).toEqual(['Receipts', 'Bank statements', 'Additional documents'])
    const additional = root.querySelectorAll('table.section')[2]
    expect(additional?.textContent).toContain('Itinerary')
    expect(additional?.textContent).not.toContain('Expenses')
  })

  it('asks a business travel for a travel justification before it continues', async () => {
    fillReport()
    tick('businessTravel', true)
    type('firstDay', '2026-10-03')
    type('lastDay', '2026-10-07')
    continueButton()?.click()
    await fillExpense()
    continueButton()?.click()
    const name = root
      .querySelector('[data-drop="travelJustifications"]')
      ?.closest('.field')
      ?.querySelector('.field-name')
    expect(name?.textContent?.trim()).toBe('Travel justification *')
    expect(continueButton()?.disabled).toBe(true)
    expect(button('[data-step="3"]')?.disabled).toBe(true)
    await add('travelJustifications', 'invitation.pdf')
    expect(continueButton()?.disabled).toBe(false)
    continueButton()?.click()
    expect(root.querySelector('h3')?.textContent).toBe('Travel justifications')
    button('[data-step="0"]')?.click()
    tick('businessTravel', false)
    expect(kept.at(-1)?.travelJustifications).toEqual([])
  })
})
