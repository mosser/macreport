// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Document } from '../domain/document.ts'
import type { Kind } from '../domain/kind.ts'
import type { Report } from '../domain/report.ts'
import { mountWizard, type WizardOptions } from './wizard.ts'

let root: HTMLElement
let saved: Report[]
let confirmation: boolean

function options(): WizardOptions {
  return {
    version: '0.1.0',
    logo: 'logo.png',
    confirm: () => confirmation,
    readFile: async (file: File, kind: Kind) =>
      new Document(kind, file.name, new Uint8Array(await file.arrayBuffer())),
    saveReport: async (report: Report) => {
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
  type('event', 'ICSE 2026')
  type('firstDay', '2026-10-03')
  type('lastDay', '2026-10-07')
  type('account', '20-123-456')
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
  mountWizard(root, options())
})

describe('the wizard', () => {
  it('opens on the Report step, with the notice that no draft is kept, and the version', () => {
    expect(root.querySelector('h2')?.textContent).toBe('Report')
    expect(root.textContent).toContain('closing the page will lose the report')
    expect(root.querySelector('footer')?.textContent).toContain('v0.1.0')
    expect(button('[data-action="back"]')?.hidden).toBe(true)
    expect(continueButton()?.disabled).toBe(true)
    expect(button('[data-step="1"]')?.disabled).toBe(true)
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
    type('lastDay', '2026-10-01')
    expect(root.querySelector('[data-rule-of="lastDay"]')?.classList.contains('is-broken')).toBe(
      true,
    )
  })

  it('asks a student for their supervisor, and takes them out when another position is chosen', () => {
    fillReport()
    choose('position', 'Student')
    expect(root.querySelector('[name="supervisorName"]')).not.toBeNull()
    expect(continueButton()?.disabled).toBe(true)
    type('supervisorName', 'Ada Lovelace')
    type('supervisorEmail', 'ada@mcmaster.ca')
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

    expect(root.querySelector('h2')?.textContent).toBe('Review')
    expect(continueButton()?.hidden).toBe(true)
    const text = root.textContent ?? ''
    for (const expected of ['Zoë Lefèvre', '$1,012.35', 'R1, S1', 'Receipts', 'Bank statements']) {
      expect(text).toContain(expected)
    }
    button('[data-action="save"]')?.click()
    await vi.waitFor(() => expect(root.querySelector('.status')).not.toBeNull())
    expect(saved).toHaveLength(1)
    expect(root.querySelector('.status')?.textContent).toContain(
      'expense-report-2026-10-03-zoe-lefevre.pdf',
    )
    expect(button('[data-action="save"]')).not.toBeNull()
  })

  it('lists the findings at the Review step of a report that has some, and offers no save', () => {
    fillReport()
    continueButton()?.click()
    button('[data-step="0"]')?.click()
    type('event', '')
    button('[data-step="1"]')?.click()
    button('[data-action="back"]')?.click()
    expect(root.querySelector('h2')?.textContent).toBe('Report')
  })

  it('reviews the findings of a report reached with something missing', async () => {
    fillReport()
    continueButton()?.click()
    await fillExpense()
    continueButton()?.click()
    button('[data-step="0"]')?.click()
    type('account', '')
    button('[data-step="2"]')?.click()
    expect(root.querySelectorAll('.findings li')).toHaveLength(1)
    expect(root.querySelector('.findings')?.textContent).toContain('Account: Required, free text.')
    expect(button('[data-action="save"]')).toBeNull()
  })

  it('starts a new report once the Claimant confirms', () => {
    fillReport()
    confirmation = false
    button('[data-action="new-report"]')?.click()
    expect(root.querySelector<HTMLInputElement>('[name="claimantName"]')?.value).toBe('Zoë Lefèvre')
    confirmation = true
    button('[data-action="new-report"]')?.click()
    expect(root.querySelector<HTMLInputElement>('[name="claimantName"]')?.value).toBe('')
  })
})
