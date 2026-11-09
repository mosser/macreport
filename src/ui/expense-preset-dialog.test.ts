// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { ExpensePresets } from '../domain/expense-preset.ts'
import { Report } from '../domain/report.ts'
import { expensesFromPreset } from './expense-preset-dialog.ts'

const presets = ExpensePresets.from({
  presets: [
    {
      name: 'First',
      offeredFor: 'otherReport',
      parameters: [{ id: 'title', label: 'Title', type: 'text' }],
      expenses: [{ description: 'First {title}' }, { description: 'Then {title}' }],
    },
    {
      name: 'Second',
      offeredFor: 'otherReport',
      parameters: [{ id: 'other', label: 'Other', type: 'text' }],
      expenses: [{ description: 'Second {other}' }],
    },
  ],
}).all

const dialog = () => document.querySelector('dialog.expense-preset')
const field = (name: string) =>
  dialog()?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)
const add = () => dialog()?.querySelector<HTMLButtonElement>('[data-answer="add"]')

function typeIn(name: string, value: string): void {
  const typed = field(name)
  if (typed === null || typed === undefined) throw new TypeError(`No field ${name}`)
  typed.value = value
  typed.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('the dialog of the expense presets', () => {
  it('gives nothing when no preset is offered', async () => {
    expect(await expensesFromPreset(document, [], new Report())).toEqual([])
    expect(dialog()).toBeNull()
  })

  it('starts on the first preset, in the order given', async () => {
    const answered = expensesFromPreset(document, presets, new Report())
    expect(
      [...(dialog()?.querySelectorAll('[name="preset"] option') ?? [])].map(
        (option) => option.textContent,
      ),
    ).toEqual(['First', 'Second'])
    expect(field('parameter-title')).not.toBeNull()
    ;(dialog() as HTMLDialogElement).close()
    expect(await answered).toEqual([])
  })

  it('empties the fields and ticks every expense again when another preset is chosen', async () => {
    const answered = expensesFromPreset(document, presets, new Report())
    typeIn('parameter-title', 'one')
    const box = dialog()?.querySelector<HTMLInputElement>('input[data-tick="0"]')
    if (box === null || box === undefined) throw new TypeError('No tick box')
    box.checked = false
    box.dispatchEvent(new Event('input', { bubbles: true }))
    typeIn('preset', '1')
    expect(field('parameter-title')).toBeNull()
    expect(field('parameter-other')?.value).toBe('')
    expect(add()?.disabled).toBe(true)
    typeIn('parameter-other', 'two')
    expect(dialog()?.querySelector<HTMLInputElement>('input[data-tick="0"]')?.checked).toBe(true)
    add()?.click()
    const added = await answered
    expect(added.map((expense) => expense.description)).toEqual(['Second two'])
  })

  it('closes on its answer, leaving nothing behind', async () => {
    const answered = expensesFromPreset(document, presets, new Report())
    dialog()?.querySelector<HTMLButtonElement>('[data-answer="cancel"]')?.click()
    expect(await answered).toEqual([])
    expect(dialog()).toBeNull()
  })
})
