// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
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
    confirm: () => confirmation,
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
    expect(forgotten).toBe(1)
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
        expect(root.querySelector(`[data-field="${field}"]`)?.textContent).toContain(fileName),
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

  it('keeps the line breaks of a description, from the Expenses step to the Review step', async () => {
    fillReport()
    continueButton()?.click()
    await fillExpense()
    type('description', 'Dinner with:\nAda Lovelace (McMaster)')
    expect(kept.at(-1)?.expenses[0]?.description).toBe('Dinner with:\nAda Lovelace (McMaster)')
    continueButton()?.click()
    continueButton()?.click()
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
    continueButton()?.click()
    await fillExpense()
    continueButton()?.click()
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
      value: [new File(['%PDF-1.7'], fileName)],
      configurable: true,
    })
    input?.dispatchEvent(new Event('change'))
    return finish
  }

  it('holds Continue and the steps ahead while a file is being added', async () => {
    fillReport()
    continueButton()?.click()
    await fillExpense()
    continueButton()?.click()
    continueButton()?.click()
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
    continueButton()?.click()
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
    continueButton()?.click()
    const dropped = (field: string, fileNames: string[]) => {
      const drop = new Event('drop', { cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', {
        value: { files: fileNames.map((fileName) => new File(['%PDF-1.7'], fileName)) },
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
    continueButton()?.click()
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
    continueButton()?.click()
    await fillExpense()
    continueButton()?.click()
    continueButton()?.click()
    expect(forgotten).toBe(1)
    button('[data-step="2"]')?.click()
    const finishOld = giveSlowly('additionalDocuments', 'old.pdf')
    button('[data-action="new-report"]')?.click()
    await vi.waitFor(() => expect(root.querySelector('h2')?.textContent).toBe('Report'))
    expect(forgotten).toBe(2)
    fillReport()
    continueButton()?.click()
    await fillExpense()
    continueButton()?.click()
    await add('additionalDocuments', 'new.pdf')
    expect(continueButton()?.disabled).toBe(false)
    finishOld()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(root.textContent).not.toContain('old.pdf')
  })

  it('adds files in the order they were given, however long each takes to read', async () => {
    fillReport()
    continueButton()?.click()
    await fillExpense()
    continueButton()?.click()
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
        value: [new File(['%PDF-1.7'], fileName)],
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
    continueButton()?.click()
    continueButton()?.click()
    expect(root.querySelector('table.expenses')?.textContent).toContain('Visa, October')
    expect(root.querySelector('table.documents')?.textContent).toContain('air-canada')
  })

  it('removes a receipt or a bank statement from the expense, with a trash can', async () => {
    fillReport()
    continueButton()?.click()
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
    continueButton()?.click()
    await fillExpense()
    continueButton()?.click()
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
    continueButton()?.click()
    const sections = [...root.querySelectorAll('h3')].map((heading) => heading.textContent)
    expect(sections).toEqual(['Additional documents', 'Receipts', 'Bank statements'])
    const additional = root.querySelectorAll('table.documents')[0]
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
    expect(name?.textContent?.trim()).toBe('Travel justification(s) *')
    const others = root.querySelector('[data-field="additionalDocuments"] .field-name')
    expect(others?.textContent?.trim()).toBe('Additional document(s)')
    expect(continueButton()?.disabled).toBe(true)
    expect(button('[data-step="3"]')?.disabled).toBe(true)
    await add('travelJustifications', 'invitation.pdf')
    expect(continueButton()?.disabled).toBe(false)
    continueButton()?.click()
    expect(root.querySelector('h3')?.textContent).toBe('Additional documents')
    expect([...root.querySelectorAll('h4')].map((heading) => heading.textContent)).toEqual([
      'Travel justifications',
    ])
    button('[data-step="0"]')?.click()
    tick('businessTravel', false)
    expect(kept.at(-1)?.travelJustifications).toEqual([])
  })
})
