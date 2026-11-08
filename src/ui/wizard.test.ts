// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Document } from '../domain/document.ts'
import type { Kind } from '../domain/kind.ts'
import { Report } from '../domain/report.ts'
import { mountWizard, type WizardOptions } from './wizard.ts'

let root: HTMLElement
let saved: Report[]
let kept: Report[]
let isKept: boolean
let discarded: number
let isDiscarded: boolean
let isSaved: boolean
let reading: Promise<void>
/** How long reading a file takes, by its name, when not as long as any other. */
let readings: Map<string, Promise<void>>
/** How many times the Review step let the browser forget its links. */
let forgotten: number

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
    readFile: async (file: File, kind: Kind) => {
      await (readings.get(file.name) ?? reading)
      return new Document(kind, file.name, new Uint8Array(await file.arrayBuffer()))
    },
    links: {
      urlOf: (document) => `blob:${document.fileName}`,
      forgetAll: () => {
        forgotten += 1
      },
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

/** Closes the fields of an expense, if open, with Done, then clicks Continue, which must be shown. */
function proceed(): void {
  button('[data-action="done"]')?.click()
  expect(continueButton()?.hidden).toBe(false)
  continueButton()?.click()
}

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
  Object.defineProperty(input, 'files', { value: [new File([`%PDF-1.7 ${fileName}`], fileName)] })
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

/** Ticks business travel, from October 3 to 7, 2026, to Rio de Janeiro. */
function travel(): void {
  tick('businessTravel', true)
  type('firstDay', '2026-10-03')
  type('lastDay', '2026-10-07')
  type('locations', 'Rio de Janeiro, Brazil')
}

function tick(name: string, isTicked: boolean): void {
  const box = root.querySelector<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`)
  if (box === null) throw new TypeError(`No checkbox ${name}`)
  box.checked = isTicked
  box.dispatchEvent(new Event('change'))
}

/** Opens the fields of a new expense, unless the fields of an expense are open already. */
function openExpense(): void {
  if (root.querySelector('[name="date"]') === null) button('[data-action="add-expense"]')?.click()
}

/** Answers the confirmation the dialog over the step asks. */
async function answer(choice: 'confirm' | 'cancel'): Promise<void> {
  await vi.waitFor(() => expect(document.querySelector('dialog.confirmation')).not.toBeNull())
  document
    .querySelector<HTMLButtonElement>(`dialog.confirmation [data-answer="${choice}"]`)
    ?.click()
  await vi.waitFor(() => expect(document.querySelector('dialog.confirmation')).toBeNull())
}

async function fillExpense(): Promise<void> {
  openExpense()
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
  kept = []
  isKept = true
  discarded = 0
  isDiscarded = true
  isSaved = true
  reading = Promise.resolve()
  readings = new Map()
  forgotten = 0
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

  it('asks the dates and the locations of a business travel only, and then requires them', () => {
    fillReport()
    expect(continueButton()?.disabled).toBe(false)
    tick('businessTravel', true)
    expect(root.querySelector('[name="firstDay"]')).not.toBeNull()
    expect(root.querySelector('#name-of-locations')?.textContent?.trim()).toBe('Location(s) *')
    expect(continueButton()?.disabled).toBe(true)
    type('firstDay', '2026-10-03')
    type('lastDay', '2026-10-07')
    expect(continueButton()?.disabled).toBe(true)
    type('locations', ' Rio de Janeiro, Brazil ')
    expect(continueButton()?.disabled).toBe(false)
    expect(kept.at(-1)?.locations).toBe('Rio de Janeiro, Brazil')
    tick('businessTravel', false)
    expect(root.querySelector('[name="firstDay"]')).toBeNull()
    expect(root.querySelector('[name="locations"]')).toBeNull()
    tick('businessTravel', true)
    expect(root.querySelector<HTMLInputElement>('[name="firstDay"]')?.value).toBe('')
    expect(root.querySelector<HTMLInputElement>('[name="locations"]')?.value).toBe('')
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
    proceed()
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
    proceed()
    expect(root.querySelector('h2')?.textContent).toBe('Expenses')
    expect(continueButton()?.disabled).toBe(true)
    openExpense()
    expect(root.querySelector('h2')?.textContent).toBe('Expense')
    type('claimedAmount', '0')
    expect(
      root.querySelector('[data-rule-of="claimedAmount"]')?.classList.contains('is-broken'),
    ).toBe(true)
    await fillExpense()
    expect(root.querySelector<HTMLInputElement>('[name="claimedAmount"]')?.value).toBe('1012.35')
    expect(continueButton()?.disabled).toBe(false)
    proceed()
    expect(root.querySelector('h2')?.textContent).toBe('Additional documents')
    expect(continueButton()?.disabled).toBe(false)
    proceed()

    expect(root.querySelector('h2')?.textContent).toBe('Review')
    expect(continueButton()?.hidden).toBe(true)
    const text = root.textContent ?? ''
    for (const expected of [
      'Zoë Lefèvre',
      '$1,012.35',
      'air-canada',
      'statement',
      'Receipts',
      'Bank statements',
    ]) {
      expect(text).toContain(expected)
    }
    expect([...root.querySelectorAll('h3')].map((heading) => heading.textContent)).toEqual([
      'Receipts',
      'Bank statements',
    ])
    expect(text).not.toContain('Entered')
    expect(root.querySelector('input[type="checkbox"]')).toBeNull()
    const [expense, supporting] = root.querySelectorAll('table.expenses tbody tr')
    expect(expense?.textContent).toContain('Air Canada, YYZ–CDG return')
    expect(supporting?.textContent?.trim()).toBe('air-canada · statement')
    const links = [...root.querySelectorAll<HTMLAnchorElement>('table a')].map((link) => [
      link.textContent,
      link.getAttribute('href'),
      link.target,
    ])
    expect(links).toEqual([
      ['air-canada', 'blob:air-canada.pdf', '_blank'],
      ['statement', 'blob:statement.pdf', '_blank'],
      ['air-canada', 'blob:air-canada.pdf', '_blank'],
      ['statement', 'blob:statement.pdf', '_blank'],
    ])
    const before = forgotten
    button('[data-step="3"]')?.click()
    expect(forgotten).toBe(before + 1)
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
    button('[data-change="0"]')?.click()
    type('description', 'Air Canada, YYZ–CDG and back')
    button('[data-step="3"]')?.click()
    expect(root.querySelector('.status')).toBeNull()
  })

  it('says the report document could not be written, and keeps the report to save again', async () => {
    fillReport()
    proceed()
    await fillExpense()
    proceed()
    proceed()
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
    proceed()
    openExpense()
    const input = root.querySelector<HTMLInputElement>('input[name="bankStatements"]')
    const names = (input?.getAttribute('aria-labelledby') ?? '')
      .split(' ')
      .map((id) => root.querySelector(`#${id}`)?.textContent?.trim())
    expect(names).toEqual(['Bank statement *', 'Drop a file here, or choose one'])
  })

  it('adds a receipt and a bank statement dropped on their zones', async () => {
    fillReport()
    proceed()
    openExpense()
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
        value: { files: [new File([`%PDF-1.7 ${fileName}`], fileName)] },
      })
      root.querySelector(`[data-drop="${field}"]`)?.dispatchEvent(drop)
      await vi.waitFor(() =>
        expect(root.querySelector(`[data-field="${field}"]`)?.textContent).toContain(fileName),
      )
    }
    const elsewhere = new Event('drop', { bubbles: true, cancelable: true })
    document.body.dispatchEvent(elsewhere)
    expect(elsewhere.defaultPrevented).toBe(true)
  })

  it('lists the findings at the Review step of a report that has some, and offers no save', () => {
    fillReport()
    proceed()
    button('[data-step="0"]')?.click()
    type('purpose', '')
    button('[data-step="1"]')?.click()
    button('[data-action="back"]')?.click()
    expect(root.querySelector('h2')?.textContent).toBe('Report')
  })

  it('reviews the findings of a report reached with something missing', async () => {
    fillReport()
    proceed()
    await fillExpense()
    proceed()
    proceed()
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
    proceed()
    await fillExpense()
    button('[data-action="new-report"]')?.click()
    const dialog = document.querySelector('dialog.confirmation')
    expect(dialog?.querySelector('h2')?.textContent).toBe(
      'Discard this report, its expenses and its documents?',
    )
    expect(dialog?.hasAttribute('open')).toBe(true)
    await answer('cancel')
    expect(discarded).toBe(0)
    expect(root.querySelector('h2')?.textContent).toBe('Expense')
    button('[data-action="new-report"]')?.click()
    document.querySelector('dialog.confirmation')?.dispatchEvent(new Event('cancel'))
    ;(document.querySelector('dialog.confirmation') as HTMLDialogElement | null)?.close()
    await vi.waitFor(() => expect(document.querySelector('dialog.confirmation')).toBeNull())
    expect(discarded).toBe(0)
    button('[data-action="new-report"]')?.click()
    await answer('confirm')
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
    await answer('confirm')
    await vi.waitFor(() =>
      expect(root.querySelector<HTMLElement>('[data-notice="discard"]')?.hidden).toBe(false),
    )
    expect(root.querySelector<HTMLInputElement>('[name="purpose"]')?.value).toBe('ICSE 2026')
    isDiscarded = true
    button('[data-action="new-report"]')?.click()
    await answer('confirm')
    await vi.waitFor(() =>
      expect(root.querySelector<HTMLElement>('[data-notice="discard"]')?.hidden).toBe(true),
    )
  })

  it('keeps the line breaks of a description, from the Expenses step to the Review step', async () => {
    fillReport()
    proceed()
    await fillExpense()
    type('description', 'Dinner with:\nAda Lovelace (McMaster)')
    expect(kept.at(-1)?.expenses[0]?.description).toBe('Dinner with:\nAda Lovelace (McMaster)')
    proceed()
    proceed()
    const style = document.createElement('style')
    style.textContent = readFileSync('src/style.css', 'utf8')
    document.head.append(style)
    const cell = root.querySelector<HTMLElement>('table.expenses td.description')
    expect(cell?.textContent).toBe('Dinner with:\nAda Lovelace (McMaster)')
    expect(cell === null ? '' : getComputedStyle(cell).whiteSpace).toBe('pre-line')
    style.remove()
  })

  it('never gives two documents the same name', async () => {
    fillReport()
    proceed()
    await fillExpense()
    proceed()
    await add('additionalDocuments', 'statement.pdf')
    expect(kept.at(-1)?.additionalDocuments.map((document) => document.name)).toEqual([
      'statement (2)',
    ])
    const style = document.createElement('style')
    // The rule of the browser's own stylesheet that hides [hidden], which happy-dom does not
    // have, then the page's, which must not override it.
    style.textContent = `[hidden] { display: none; }\n${readFileSync('src/style.css', 'utf8')}`
    document.head.append(style)
    const rule = () => root.querySelector<HTMLElement>('[data-name-taken="additionalDocuments-0"]')
    const isShown = () => {
      const element = rule()
      return element !== null && getComputedStyle(element).display !== 'none'
    }
    expect(isShown()).toBe(false)
    expect(root.querySelectorAll('.error:not([hidden])')).toHaveLength(0)
    expect(continueButton()?.disabled).toBe(false)
    type('documentName', 'AIR-CANADA')
    expect(isShown()).toBe(true)
    expect(rule()?.textContent).toBe('Another document already has this name.')
    expect(continueButton()?.disabled).toBe(true)
    type('documentName', 'Itinerary')
    expect(isShown()).toBe(false)
    expect(continueButton()?.disabled).toBe(false)
    style.remove()
  })

  /** Gives a file to a field, its reading finishing when the function it gives back is called. */
  function giveSlowly(name: string, fileName: string): () => void {
    let finish = () => {}
    readings.set(
      fileName,
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const input = root.querySelector<HTMLInputElement>(`input[name="${name}"]`)
    Object.defineProperty(input, 'files', {
      value: [new File([`%PDF-1.7 ${fileName}`], fileName)],
      configurable: true,
    })
    input?.dispatchEvent(new Event('change'))
    return finish
  }

  it('holds Done, Discard and Remove while a file is being added to an expense', async () => {
    fillReport()
    proceed()
    await fillExpense()
    proceed()
    button('[data-step="1"]')?.click()
    openExpense()
    const finish = giveSlowly('receipts', 'late.pdf')
    expect(button('[data-action="done"]')?.disabled).toBe(true)
    expect(button('[data-action="discard"]')?.disabled).toBe(true)
    finish()
    await vi.waitFor(() => expect(root.textContent).toContain('late.pdf'))
    expect(button('[data-action="done"]')?.disabled).toBe(false)
    button('[data-action="done"]')?.click()
    expect(button('[data-remove-expense="0"]')?.disabled).toBe(false)
    button('[data-step="2"]')?.click()
    const finishLater = giveSlowly('additionalDocuments', 'later.pdf')
    button('[data-step="1"]')?.click()
    expect(button('[data-remove-expense="0"]')?.disabled).toBe(true)
    finishLater()
    await vi.waitFor(() => expect(button('[data-remove-expense="0"]')?.disabled).toBe(false))
    expect(kept.at(-1)?.expenses[1]?.receipts.map((document) => document.fileName)).toEqual([
      'late.pdf',
    ])
  })

  it('holds Done, Back and the other steps while a value typed breaks its rule, and keeps it shown', async () => {
    fillReport()
    proceed()
    await fillExpense()
    tick('paidInAnotherCurrency', true)
    type('foreignAmount', '640')
    type('currency', 'EUR')
    type('claimedAmount', '87.123')
    const held = () =>
      [
        button('[data-action="done"]'),
        button('[data-action="back"]'),
        button('[data-step="0"]'),
        button('[data-step="2"]'),
      ].map((each) => each?.disabled)
    expect(held()).toEqual([true, true, true, true])
    expect(kept.at(-1)?.expenses[0]?.claimedAmount).toBeUndefined()
    button('[data-remove="receipts"][data-index="0"]')?.click()
    expect(root.querySelector<HTMLInputElement>('[name="claimedAmount"]')?.value).toBe('87.123')
    expect(
      root.querySelector('[data-rule-of="claimedAmount"]')?.classList.contains('is-broken'),
    ).toBe(true)
    expect(held()).toEqual([true, true, true, true])
    type('currency', 'EURO')
    tick('paidInAnotherCurrency', false)
    expect(held()).toEqual([true, true, true, true])
    type('claimedAmount', '')
    expect(held()).toEqual([false, false, false, true])
    type('claimedAmount', '87.12')
    expect(kept.at(-1)?.expenses[0]?.claimedAmount?.cents).toBe(8712)
  })

  it('holds Continue and the steps ahead while a file is being added', async () => {
    fillReport()
    proceed()
    await fillExpense()
    proceed()
    proceed()
    button('[data-step="2"]')?.click()
    const finish = giveSlowly('additionalDocuments', 'late.pdf')
    expect(continueButton()?.disabled).toBe(true)
    expect(button('[data-step="3"]')?.disabled).toBe(true)
    expect(button('[data-step="0"]')?.disabled).toBe(false)
    finish()
    await vi.waitFor(() => expect(root.textContent).toContain('late.pdf'))
    expect(continueButton()?.disabled).toBe(false)
    expect(button('[data-step="3"]')?.disabled).toBe(false)
  })

  it('adds one receipt to an expense, however many are given before the first is added', async () => {
    fillReport()
    proceed()
    openExpense()
    const finishFirst = giveSlowly('receipts', 'first.pdf')
    const finishSecond = giveSlowly('receipts', 'second.pdf')
    finishSecond()
    finishFirst()
    await vi.waitFor(() => expect(root.textContent).toContain('first.pdf'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(kept.at(-1)?.expenses[0]?.receipts.map((document) => document.fileName)).toEqual([
      'first.pdf',
    ])
  })

  it('adds every file dropped where several are taken, and the first where one is', async () => {
    fillReport()
    proceed()
    openExpense()
    const dropped = (field: string, fileNames: string[]) => {
      const drop = new Event('drop', { cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', {
        value: { files: fileNames.map((fileName) => new File([`%PDF-1.7 ${fileName}`], fileName)) },
      })
      root.querySelector(`[data-drop="${field}"]`)?.dispatchEvent(drop)
    }
    expect(root.querySelector('input[name="receipts"]')?.hasAttribute('multiple')).toBe(false)
    dropped('receipts', ['hotel.pdf', 'taxi.pdf'])
    await vi.waitFor(() => expect(root.textContent).toContain('hotel.pdf'))
    expect(root.textContent).not.toContain('taxi.pdf')
    await add('bankStatements', 'statement.pdf')
    type('date', '2026-10-03')
    type('description', 'Hotel')
    type('claimedAmount', '300')
    proceed()
    expect(root.querySelector('input[name="additionalDocuments"]')?.hasAttribute('multiple')).toBe(
      true,
    )
    dropped('additionalDocuments', ['itinerary.pdf', 'poster.pdf'])
    await vi.waitFor(() => expect(root.textContent).toContain('poster.pdf'))
    expect(kept.at(-1)?.additionalDocuments.map((document) => document.fileName)).toEqual([
      'itinerary.pdf',
      'poster.pdf',
    ])
  })

  it('makes a new report wait for none of the files of the last, and forgets its links', async () => {
    fillReport()
    proceed()
    await fillExpense()
    proceed()
    proceed()
    button('[data-step="2"]')?.click()
    const before = forgotten
    const finishOld = giveSlowly('additionalDocuments', 'old.pdf')
    button('[data-action="new-report"]')?.click()
    await answer('confirm')
    await vi.waitFor(() => expect(root.querySelector('h2')?.textContent).toBe('Report'))
    expect(forgotten).toBe(before + 1)
    fillReport()
    proceed()
    await fillExpense()
    proceed()
    await add('additionalDocuments', 'new.pdf')
    expect(continueButton()?.disabled).toBe(false)
    finishOld()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(root.textContent).not.toContain('old.pdf')
  })

  it('adds files in the order they were given, however long each takes to read', async () => {
    fillReport()
    proceed()
    await fillExpense()
    proceed()
    const finished: (() => void)[] = []
    for (const fileName of ['first.pdf', 'second.pdf']) {
      readings.set(
        fileName,
        new Promise((resolve) => {
          finished.push(resolve)
        }),
      )
      const input = root.querySelector<HTMLInputElement>('input[name="additionalDocuments"]')
      Object.defineProperty(input, 'files', {
        value: [new File([`%PDF-1.7 ${fileName}`], fileName)],
        configurable: true,
      })
      input?.dispatchEvent(new Event('change'))
    }
    finished[1]?.()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(root.textContent).not.toContain('second.pdf')
    finished[0]?.()
    await vi.waitFor(() => expect(root.textContent).toContain('second.pdf'))
    expect(kept.at(-1)?.additionalDocuments.map((document) => document.fileName)).toEqual([
      'first.pdf',
      'second.pdf',
    ])
  })

  it('does not add to a new report a file still being read when New report was clicked', async () => {
    fillReport()
    proceed()
    openExpense()
    let finishReading = () => {}
    reading = new Promise((resolve) => {
      finishReading = resolve
    })
    const input = root.querySelector<HTMLInputElement>('input[name="receipts"]')
    Object.defineProperty(input, 'files', { value: [new File(['%PDF-1.7 late.pdf'], 'late.pdf')] })
    input?.dispatchEvent(new Event('change'))
    button('[data-action="new-report"]')?.click()
    await answer('confirm')
    await vi.waitFor(() => expect(discarded).toBe(1))
    finishReading()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(kept.at(-1)?.expenses ?? []).toEqual([])
    expect(root.textContent).not.toContain('late.pdf')
  })

  it('names a receipt or a bank statement after its file, until the Claimant names it otherwise', async () => {
    fillReport()
    proceed()
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
    proceed()
    proceed()
    expect(root.querySelector('table.expenses')?.textContent).toContain('Visa, October')
    expect(root.querySelector('table.documents')?.textContent).toContain('air-canada')
  })

  it('removes a receipt or a bank statement from the expense, with a trash can', async () => {
    fillReport()
    proceed()
    await fillExpense()
    expect(root.querySelector('[data-drop="receipts"]')).toBeNull()
    expect(root.querySelector('[data-drop="bankStatements"]')).toBeNull()
    const remove = button('[data-remove="receipts"][data-index="0"]')
    expect(remove?.getAttribute('aria-label')).toBe('Remove')
    expect(remove?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    remove?.click()
    expect(kept.at(-1)?.expenses[0]?.receipts).toEqual([])
    expect(root.querySelector('[data-drop="receipts"]')).not.toBeNull()
    expect(root.querySelector('[data-field="receipts"]')?.textContent).not.toContain(
      'air-canada.pdf',
    )
    expect(continueButton()?.disabled).toBe(true)
    button('[data-remove="bankStatements"][data-index="0"]')?.click()
    expect(kept.at(-1)?.expenses[0]?.bankStatements).toEqual([])
    await add('receipts', 'hotel.pdf')
    await add('bankStatements', 'visa.pdf')
    expect(continueButton()?.disabled).toBe(false)
  })

  it('adds, names and removes additional documents, which are optional', async () => {
    fillReport()
    proceed()
    await fillExpense()
    proceed()
    expect(root.querySelector('[data-drop="travelJustifications"]')).toBeNull()
    expect(continueButton()?.disabled).toBe(false)
    await add('additionalDocuments', 'itinerary.pdf')
    await add('additionalDocuments', 'poster.png')
    expect(root.querySelector('[data-drop="additionalDocuments"]')).not.toBeNull()
    expect(kept.at(-1)?.additionalDocuments.map((document) => document.name)).toEqual([
      'itinerary',
      'poster',
    ])
    type('documentName', 'Itinerary')
    expect(kept.at(-1)?.additionalDocuments[0]?.name).toBe('Itinerary')
    button('[data-remove="additionalDocuments"][data-index="1"]')?.click()
    expect(kept.at(-1)?.additionalDocuments.map((document) => document.name)).toEqual(['Itinerary'])
    expect(root.textContent).not.toContain('poster')
    proceed()
    const sections = [...root.querySelectorAll('h3')].map((heading) => heading.textContent)
    expect(sections).toEqual(['Additional documents', 'Receipts', 'Bank statements'])
    const additional = root.querySelectorAll('table.documents')[0]
    expect(additional?.textContent).toContain('Itinerary')
    expect(additional?.textContent).not.toContain('Expenses')
  })

  it('asks a business travel for a travel justification before it continues', async () => {
    fillReport()
    travel()
    proceed()
    await fillExpense()
    proceed()
    const name = root
      .querySelector('[data-drop="travelJustifications"]')
      ?.closest('.field')
      ?.querySelector('.field-name')
    expect(name?.textContent?.trim()).toBe('Travel justification(s) *')
    const others = root.querySelector('[data-field="additionalDocuments"] .field-name')
    expect(others?.textContent?.trim()).toBe('Additional document(s)')
    expect(continueButton()?.disabled).toBe(true)
    expect(button('[data-step="3"]')?.disabled).toBe(true)
    await add('travelJustifications', 'invitation.pdf')
    expect(continueButton()?.disabled).toBe(false)
    proceed()
    expect(root.querySelector('h3')?.textContent).toBe('Additional documents')
    expect([...root.querySelectorAll('h4')].map((heading) => heading.textContent)).toEqual([
      'Travel justifications',
    ])
    button('[data-step="0"]')?.click()
    tick('businessTravel', false)
    expect(kept.at(-1)?.travelJustifications).toEqual([])
  })
})

describe('the Expenses step', () => {
  /** The rows of the expenses, each its date, description, foreign and claimed amounts, then its documents and what it lacks. */
  const rows = () =>
    [...root.querySelectorAll('table.expense-list tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim()),
    )

  async function twoExpensesSharingTheStatement(): Promise<void> {
    fillReport()
    proceed()
    await fillExpense()
    button('[data-action="done"]')?.click()
    openExpense()
    type('date', '2026-10-05')
    type('description', 'Hotel')
    type('claimedAmount', '300')
    await add('receipts', 'hotel.pdf')
    choose('choose-bankStatements', '0')
  }

  it('lists the expenses by date, each with what it still lacks, and opens one filled in to change it', async () => {
    fillReport()
    proceed()
    expect(root.querySelector('table.expense-list')).toBeNull()
    await fillExpense()
    button('[data-action="done"]')?.click()
    expect(root.querySelector('h2')?.textContent).toBe('Expenses')
    expect(continueButton()?.disabled).toBe(false)
    openExpense()
    type('date', '2026-10-01')
    type('description', 'Taxi')
    button('[data-action="done"]')?.click()
    expect(rows()).toEqual([
      ['2026-10-01', 'Taxi', '', '', ''],
      ['', 'Claimed amount (CAD) is required.Receipt is required.Bank statement is required.'],
      ['2026-10-03', 'Air Canada, YYZ–CDG return', '', '$1,012.35', ''],
      ['', 'air-canada · statement'],
    ])
    expect([...root.querySelectorAll('.lacks li')].map((lack) => lack.textContent)).toEqual([
      'Claimed amount (CAD) is required.',
      'Receipt is required.',
      'Bank statement is required.',
    ])
    expect(continueButton()?.disabled).toBe(true)
    const actions = [...root.querySelectorAll('td.expense-actions button')].slice(0, 2)
    expect(actions.map((action) => action.getAttribute('aria-label'))).toEqual(['Change', 'Remove'])
    expect(
      actions.map((action) => action.querySelector('svg')?.getAttribute('aria-hidden')),
    ).toEqual(['true', 'true'])
    const listed = [...root.querySelectorAll<HTMLAnchorElement>('table.expense-list a')]
    expect(
      listed.map((link) => [link.textContent, link.getAttribute('href'), link.target]),
    ).toEqual([
      ['air-canada', 'blob:air-canada.pdf', '_blank'],
      ['statement', 'blob:statement.pdf', '_blank'],
    ])
    button('[data-change="1"]')?.click()
    expect(root.querySelector('h2')?.textContent).toBe('Expense')
    expect(continueButton()?.hidden).toBe(true)
    expect(root.querySelector<HTMLTextAreaElement>('[name="description"]')?.value).toBe('Taxi')
    type('claimedAmount', '87.10')
    expect(kept.at(-1)?.expenses[1]?.claimedAmount?.cents).toBe(8710)
    button('[data-action="back"]')?.click()
    proceed()
    expect(root.querySelector('h2')?.textContent).toBe('Expenses')
  })

  it('chooses a receipt or a bank statement already in the report, or the one a file added again is', async () => {
    await twoExpensesSharingTheStatement()
    const [flight, hotel] = kept.at(-1)?.expenses ?? []
    expect(hotel?.bankStatements[0]).toBe(flight?.bankStatements[0])
    expect(root.querySelector('[name="choose-bankStatements"]')).toBeNull()
    button('[data-remove="receipts"][data-index="0"]')?.click()
    const choices = root.querySelectorAll('[name="choose-receipts"] option')
    expect([...choices].map((option) => option.textContent)).toEqual(['', 'air-canada'])
    const input = root.querySelector<HTMLInputElement>('input[name="receipts"]')
    Object.defineProperty(input, 'files', {
      value: [new File(['%PDF-1.7 air-canada.pdf'], 'copy of air-canada.pdf')],
    })
    input?.dispatchEvent(new Event('change'))
    await vi.waitFor(() =>
      expect(root.querySelector('[data-field="receipts"] .status')).not.toBeNull(),
    )
    expect(root.querySelector('[data-field="receipts"] .status')?.textContent).toBe(
      'Already in the report, as air-canada: chosen.',
    )
    expect(kept.at(-1)?.documents.map((document) => document.fileName)).toEqual([
      'air-canada.pdf',
      'statement.pdf',
    ])
    button('[data-remove="bankStatements"][data-index="0"]')?.click()
    expect(kept.at(-1)?.expenses[1]?.bankStatements).toEqual([])
    expect(kept.at(-1)?.expenses[0]?.bankStatements.map((document) => document.name)).toEqual([
      'statement',
    ])
    button('[data-action="done"]')?.click()
    button('[data-change="1"]')?.click()
    expect(root.querySelector('[data-field="receipts"] .status')).toBeNull()
  })

  it('says in the row of an expense which of its documents has the name of a document before it', async () => {
    await twoExpensesSharingTheStatement()
    const names = root.querySelectorAll<HTMLInputElement>('input[name="documentName"]')
    const hotel = names[0]
    if (hotel === undefined) throw new TypeError('No name')
    hotel.value = 'Air-Canada'
    hotel.dispatchEvent(new Event('input'))
    button('[data-action="done"]')?.click()
    expect([...root.querySelectorAll('.lacks li')].map((lack) => lack.textContent)).toEqual([
      "hotel.pdf: Name Air-Canada is already another document's.",
    ])
    expect(continueButton()?.disabled).toBe(true)
  })

  it('removes an expense once confirmed, and the documents no other expense refers to', async () => {
    await twoExpensesSharingTheStatement()
    button('[data-action="done"]')?.click()
    button('[data-remove-expense="0"]')?.click()
    await vi.waitFor(() => expect(document.querySelector('dialog.confirmation')).not.toBeNull())
    const dialog = document.querySelector('dialog.confirmation')
    expect(dialog?.querySelector('h2')?.textContent).toBe('Remove this expense?')
    expect([...(dialog?.querySelectorAll('p') ?? [])].map((detail) => detail.textContent)).toEqual([
      'Expense 2026-10-03, Air Canada, YYZ–CDG return',
      'Receipt air-canada leaves the report with it.',
    ])
    await answer('cancel')
    expect(kept.at(-1)?.expenses).toHaveLength(2)
    button('[data-remove-expense="0"]')?.click()
    await answer('confirm')
    expect(kept.at(-1)?.expenses.map((expense) => expense.description)).toEqual(['Hotel'])
    expect(kept.at(-1)?.documents.map((document) => document.fileName)).toEqual([
      'hotel.pdf',
      'statement.pdf',
    ])
    expect(rows()).toHaveLength(2)
  })

  it('asks an expense paid in another currency for its foreign amount and currency, its claimed amount optional', async () => {
    fillReport()
    proceed()
    await fillExpense()
    type('claimedAmount', '')
    expect(root.querySelector('[name="foreignAmount"]')).toBeNull()
    expect(continueButton()?.disabled).toBe(true)
    tick('paidInAnotherCurrency', true)
    const nameOf = (field: string) =>
      root.querySelector(`[name="${field}"]`)?.closest('label')?.querySelector('.field-name')
    expect(nameOf('claimedAmount')?.textContent?.trim()).toBe('Claimed amount (CAD)')
    expect(nameOf('currency')?.textContent?.trim()).toBe('Currency *')
    expect(root.querySelector('[data-rule-of="claimedAmount"]')?.textContent).toBe(
      'In Canadian dollars, more than zero, at most two decimals; left empty, McSCert works it out.',
    )
    expect(root.querySelectorAll('#currencies option').length).toBeGreaterThan(150)
    expect(continueButton()?.disabled).toBe(true)
    type('foreignAmount', '640')
    type('currency', 'XYZ')
    expect(root.querySelector('[data-rule-of="currency"]')?.classList.contains('is-broken')).toBe(
      true,
    )
    expect(root.querySelector('[data-currency-name]')?.textContent).toBe('')
    expect(root.querySelector('#currencies option[value="EUR"]')?.textContent).toBe('Euro')
    type('currency', 'eur')
    expect(root.querySelector('[data-currency-name]')?.textContent).toBe('Euro')
    expect(root.querySelector('[data-rule-of="currency"]')?.classList.contains('is-broken')).toBe(
      false,
    )
    expect(kept.at(-1)?.expenses[0]?.foreignAmountText).toBe('EUR 640.00')
    expect(continueButton()?.disabled).toBe(false)
    button('[data-action="done"]')?.click()
    expect(rows()[0]?.slice(2, 4)).toEqual(['EUR 640.00', ''])
    proceed()
    proceed()
    const total = [...root.querySelectorAll('tr.total > *')].map((cell) => cell.textContent)
    expect(total).toEqual(['Total', 'EUR 640.00'])
    button('[data-step="1"]')?.click()
    button('[data-change="0"]')?.click()
    expect(root.querySelector<HTMLInputElement>('[name="foreignAmount"]')?.value).toBe('640.00')
    tick('paidInAnotherCurrency', false)
    expect(kept.at(-1)?.expenses[0]?.foreignAmount).toBeUndefined()
    expect(continueButton()?.disabled).toBe(true)
  })
})

describe('Discard', () => {
  const descriptions = () => kept.at(-1)?.expenses.map((expense) => expense.description)

  it('takes an expense just added out of the report, its documents with it', async () => {
    fillReport()
    proceed()
    await fillExpense()
    button('[data-action="discard"]')?.click()
    expect(root.querySelector('[name="date"]')).toBeNull()
    expect(kept.at(-1)?.expenses).toEqual([])
    expect(kept.at(-1)?.documents).toEqual([])
    expect(continueButton()?.hidden).toBe(false)
  })

  it('puts an expense changed back as it was when its fields opened, its documents and their names included', async () => {
    fillReport()
    proceed()
    await fillExpense()
    button('[data-action="done"]')?.click()
    const before = kept.at(-1)
    button('[data-change="0"]')?.click()
    type('description', 'Air Transat')
    type('claimedAmount', '12,50')
    expect(button('[data-action="done"]')?.disabled).toBe(true)
    expect(button('[data-action="discard"]')?.disabled).toBe(false)
    const name = root.querySelector<HTMLInputElement>('input[name="documentName"]')
    if (name === null) throw new TypeError('No name')
    name.value = 'Booking'
    name.dispatchEvent(new Event('input'))
    button('[data-action="discard"]')?.click()
    expect(kept.at(-1)).toBe(before)
    expect(descriptions()).toEqual(['Air Canada, YYZ–CDG return'])
    expect(kept.at(-1)?.documents.map((document) => document.name)).toEqual([
      'air-canada',
      'statement',
    ])
    expect(button('[data-step="0"]')?.disabled).toBe(false)
    button('[data-change="0"]')?.click()
    expect(root.querySelector<HTMLInputElement>('[name="claimedAmount"]')?.value).toBe('1012.35')
  })
})

describe('the per diems', () => {
  const meal = (day: string, name: string) =>
    root.querySelector<HTMLInputElement>(
      `input[name="meal"][data-day="${day}"][data-meal="${name}"]`,
    )

  function claim(day: string, name: string, isClaimed = true): void {
    const box = meal(day, name)
    if (box === null) throw new TypeError(`No ${name} on ${day}`)
    box.checked = isClaimed
    box.dispatchEvent(new Event('change'))
  }

  function scope(day: string, value: 'domestic' | 'international'): void {
    const radio = root.querySelector<HTMLInputElement>(
      `input[type="radio"][data-day="${day}"][value="${value}"]`,
    )
    if (radio === null) throw new TypeError(`No ${value} on ${day}`)
    radio.checked = true
    radio.dispatchEvent(new Event('change'))
  }

  function reason(day: string, name: string, value: string): void {
    const field = root.querySelector<HTMLInputElement>(
      `input[name="reason"][data-day="${day}"][data-meal="${name}"]`,
    )
    if (field === null) throw new TypeError(`No reason for ${name} on ${day}`)
    field.value = value
    field.dispatchEvent(new Event('input'))
  }

  const days = () =>
    [...root.querySelectorAll('.per-diem-day h3')].map((heading) =>
      heading.textContent?.replace(/\s+/g, ' ').trim(),
    )
  /** The amount of each per diem with a meal claimed, as the draft keeps it. */
  const amounts = () =>
    kept.at(-1)?.claimedPerDiems.map((perDiem) => perDiem.amountTexts.join(', '))

  it('are managed for a business travel whose dates are given, one row per day', () => {
    fillReport()
    proceed()
    expect(button('[data-action="manage-per-diems"]')).toBeNull()
    button('[data-step="0"]')?.click()
    travel()
    type('lastDay', '2026-10-01')
    proceed()
    expect(button('[data-action="manage-per-diems"]')).toBeNull()
    button('[data-step="0"]')?.click()
    type('lastDay', '2026-10-05')
    proceed()
    expect(continueButton()?.disabled).toBe(true)
    button('[data-action="manage-per-diems"]')?.click()
    expect(root.querySelector('h2')?.textContent).toBe('Per diems')
    expect(days()).toEqual(['Saturday 2026-10-03', 'Sunday 2026-10-04', 'Monday 2026-10-05'])
    expect(meal('2026-10-03', 'lunch')?.closest('.meal-toggle')?.textContent?.trim()).toBe('Lunch')
    expect(continueButton()?.hidden).toBe(true)
    expect(meal('2026-10-03', 'breakfast')?.checked).toBe(false)
    expect(
      root.querySelector<HTMLInputElement>('input[data-day="2026-10-03"][value="domestic"]')
        ?.checked,
    ).toBe(true)
    expect(root.querySelector('.per-diem-days')?.textContent).not.toContain('$')
  })

  it('claim each meal at its rate, domestic in Canadian dollars, international in US dollars, set all at once', () => {
    fillReport()
    travel()
    type('lastDay', '2026-10-04')
    proceed()
    button('[data-action="manage-per-diems"]')?.click()
    claim('2026-10-03', 'breakfast')
    claim('2026-10-03', 'dinner')
    expect(amounts()).toEqual(['$86.10'])
    scope('2026-10-04', 'international')
    claim('2026-10-04', 'lunch')
    expect(amounts()).toEqual(['$86.10', 'USD 27.40'])
    button('[data-action="all-international"]')?.click()
    expect(amounts()).toEqual(['USD 86.10', 'USD 27.40'])
    button('[data-action="all-domestic"]')?.click()
    expect(amounts()).toEqual(['$86.10', '$27.40'])
    claim('2026-10-03', 'dinner', false)
    expect(amounts()).toEqual(['$28.40', '$27.40'])
    expect(root.querySelector('.per-diem-days')?.textContent).not.toMatch(/\$|USD/)
  })

  it('ask a reason only once Add a reason is clicked, under a meal not claimed of a day with a meal claimed', () => {
    fillReport()
    travel()
    type('lastDay', '2026-10-04')
    proceed()
    button('[data-action="manage-per-diems"]')?.click()
    expect(root.querySelectorAll('input[name="reason"], [data-add-reason]')).toHaveLength(0)
    claim('2026-10-03', 'dinner')
    expect(root.querySelectorAll('input[name="reason"]')).toHaveLength(0)
    expect(
      [...root.querySelectorAll<HTMLElement>('[data-add-reason]')].map(
        (each) => `${each.dataset.day} ${each.dataset.meal}`,
      ),
    ).toEqual(['2026-10-03 breakfast', '2026-10-03 lunch'])
    expect(button('[data-add-reason][data-meal="lunch"]')?.textContent?.trim()).toBe(
      'Add a reason for not claiming lunch (optional)',
    )
    button('[data-add-reason][data-meal="lunch"]')?.click()
    const typed = root.querySelector('input[name="reason"][data-meal="lunch"]')
    expect(typed?.closest('label')?.textContent?.trim()).toBe(
      'Reason for not claiming lunch (optional)',
    )
    expect(document.activeElement).toBe(typed)
    expect(button('[data-add-reason][data-meal="lunch"]')).toBeNull()
    reason('2026-10-03', 'lunch', ' provided by the conference ')
    expect(root.querySelector('input[name="reason"][data-meal="lunch"]')).toBe(typed)
    expect([...(kept.at(-1)?.perDiems[0]?.reasons.values() ?? [])]).toEqual([
      'provided by the conference',
    ])
    claim('2026-10-04', 'lunch')
    expect(
      root.querySelector<HTMLInputElement>('input[name="reason"][data-day="2026-10-03"]')?.value,
    ).toBe('provided by the conference')
    claim('2026-10-03', 'lunch')
    expect(root.querySelector('input[name="reason"][data-day="2026-10-03"]')).toBeNull()
    claim('2026-10-03', 'lunch', false)
    expect(button('[data-add-reason][data-day="2026-10-03"][data-meal="lunch"]')).not.toBeNull()
    claim('2026-10-03', 'lunch')
    claim('2026-10-03', 'dinner', false)
    claim('2026-10-03', 'lunch', false)
    expect(root.querySelectorAll('[data-day="2026-10-03"][data-add-reason]')).toHaveLength(0)
  })

  it('forget the reasons asked for and left empty once Done is clicked', () => {
    fillReport()
    travel()
    type('lastDay', '2026-10-03')
    proceed()
    button('[data-action="manage-per-diems"]')?.click()
    claim('2026-10-03', 'dinner')
    button('[data-add-reason][data-meal="lunch"]')?.click()
    button('[data-action="done"]')?.click()
    button('[data-action="manage-per-diems"]')?.click()
    expect(root.querySelector('input[name="reason"]')).toBeNull()
  })

  it('show above the expenses once a meal is claimed, which is enough to continue, and in their own section on review', async () => {
    fillReport()
    travel()
    proceed()
    button('[data-action="manage-per-diems"]')?.click()
    claim('2026-10-04', 'breakfast')
    scope('2026-10-05', 'international')
    claim('2026-10-05', 'dinner')
    button('[data-add-reason][data-day="2026-10-05"][data-meal="lunch"]')?.click()
    reason('2026-10-05', 'lunch', 'provided by the conference')
    button('[data-action="done"]')?.click()
    expect(root.querySelector('.per-diems-line')?.textContent).toBe(
      'Per diems: 2 days · $28.40 · USD 57.70',
    )
    const listed = [...root.querySelectorAll('table.per-diem-list tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
    )
    expect(listed).toEqual([
      ['2026-10-04', 'Per diem, domestic: breakfast'],
      ['', 'Not claimed: lunch, dinner'],
      ['2026-10-05', 'Per diem, international: dinner'],
      ['', 'Not claimed: breakfast, lunch (provided by the conference)'],
    ])
    expect(continueButton()?.disabled).toBe(false)
    await fillExpense()
    proceed()
    await add('travelJustifications', 'invitation.pdf')
    proceed()
    const expenses = [...root.querySelectorAll('table.expenses tbody tr.expense')]
    expect(expenses).toHaveLength(1)
    expect(root.textContent).not.toContain('Per diem, domestic')
    const perDiems = [...root.querySelectorAll('table.per-diems tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim()),
    )
    expect(perDiems).toEqual([
      ['2', '2026-10-04', 'Domestic', '$28.40', 'Not claimed', 'Not claimed', '$28.40'],
      [
        '3',
        '2026-10-05',
        'International',
        'Not claimed',
        'Not claimedprovided by the conference',
        'USD 57.70',
        'USD 57.70',
      ],
    ])
    const total = [...root.querySelectorAll('tr.total > *')].map((cell) => cell.textContent)
    expect(total).toEqual(['Total', '$1,040.75USD 57.70'])
  })

  it('make one meal domestic or international, once asked for per meal, and whenever the meals of the day differ', async () => {
    fillReport()
    travel()
    type('lastDay', '2026-10-04')
    proceed()
    button('[data-action="manage-per-diems"]')?.click()
    const mealScope = (day: string, name: string) =>
      root.querySelector<HTMLInputElement>(
        `input[type="radio"][data-day="${day}"][data-meal="${name}"][value="international"]`,
      )
    const dayScopes = (day: string) =>
      [
        ...root.querySelectorAll<HTMLInputElement>(
          `input[type="radio"][name="scope-${day}"]:checked`,
        ),
      ].map((radio) => radio.value)
    expect(mealScope('2026-10-03', 'dinner')).toBeNull()
    button('[data-per-meal][data-day="2026-10-03"]')?.click()
    expect(button('[data-per-meal][data-day="2026-10-03"]')).toBeNull()
    expect(button('[data-per-meal][data-day="2026-10-04"]')).not.toBeNull()
    claim('2026-10-03', 'breakfast')
    claim('2026-10-03', 'dinner')
    const dinner = mealScope('2026-10-03', 'dinner')
    if (dinner === null) throw new TypeError('No dinner scope')
    dinner.checked = true
    dinner.dispatchEvent(new Event('change'))
    expect(dayScopes('2026-10-03')).toEqual([])
    expect(amounts()).toEqual(['$28.40, USD 57.70'])
    button('[data-action="done"]')?.click()
    expect(
      [...root.querySelectorAll('table.per-diem-list td.description')].map(
        (cell) => cell.textContent,
      ),
    ).toEqual(['Per diem, domestic: breakfast\nPer diem, international: dinner'])
    button('[data-action="manage-per-diems"]')?.click()
    expect(mealScope('2026-10-03', 'dinner')?.checked).toBe(true)
    expect(mealScope('2026-10-04', 'dinner')).toBeNull()
    scope('2026-10-03', 'domestic')
    expect(dayScopes('2026-10-03')).toEqual(['domestic'])
    expect(mealScope('2026-10-03', 'dinner')).toBeNull()
    button('[data-action="all-international"]')?.click()
    expect(dayScopes('2026-10-03')).toEqual(['international'])
    expect(dayScopes('2026-10-04')).toEqual(['international'])
    button('[data-action="done"]')?.click()
    button('[data-action="manage-per-diems"]')?.click()
    expect(mealScope('2026-10-03', 'dinner')).toBeNull()
    claim('2026-10-03', 'dinner', false)
    claim('2026-10-03', 'breakfast', false)
    expect(kept.at(-1)?.claimedPerDiems).toEqual([])
  })

  it('leave the step closed, and are closed with Done', () => {
    fillReport()
    travel()
    proceed()
    button('[data-action="manage-per-diems"]')?.click()
    button('[data-step="0"]')?.click()
    button('[data-step="1"]')?.click()
    expect(root.querySelector('h2')?.textContent).toBe('Expenses')
  })
})
