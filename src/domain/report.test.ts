import { describe, expect, it } from 'vitest'
import { Expense } from './expense.ts'
import { positions, Report } from './report.ts'

describe('Report', () => {
  it('starts empty', () => {
    const report = new Report()
    expect(report.claimantName).toBeUndefined()
    expect(report.expenses).toEqual([])
  })

  it('offers the five positions', () => {
    expect(positions).toEqual(['Faculty', 'Postdoctoral fellow', 'Student', 'Staff', 'Visitor'])
  })

  it('holds email addresses only', () => {
    expect(() => new Report({ email: 'not an email' })).toThrow(TypeError)
    expect(() => new Report({ supervisorEmail: 'nope' })).toThrow(TypeError)
    expect(() => new Report({ hostEmail: 'nope' })).toThrow(TypeError)
  })

  it('asks for a supervisor of a student or a postdoctoral fellow, and a host of a visitor', () => {
    expect(new Report({ position: 'Student' }).asksForSupervisor).toBe(true)
    expect(new Report({ position: 'Postdoctoral fellow' }).asksForSupervisor).toBe(true)
    expect(new Report({ position: 'Student' }).asksForHost).toBe(false)
    expect(new Report({ position: 'Visitor' }).asksForHost).toBe(true)
    expect(new Report({ position: 'Visitor' }).asksForSupervisor).toBe(false)
    for (const position of ['Faculty', 'Staff'] as const) {
      expect(new Report({ position }).asksForSupervisor).toBe(false)
      expect(new Report({ position }).asksForHost).toBe(false)
    }
  })

  it('takes the supervisor out when another position is chosen', () => {
    const student = new Report({ position: 'Student' }).afterChanging({
      supervisorName: 'Ada',
      supervisorEmail: 'ada@mcmaster.ca',
    })
    expect(student.afterChanging({ position: 'Student' }).supervisorName).toBe('Ada')
    expect(student.afterChanging({ purpose: 'ICSE' }).supervisorName).toBe('Ada')
    expect(student.afterChanging({ position: 'Postdoctoral fellow' }).supervisorName).toBe('Ada')
    const staff = student.afterChanging({ position: 'Staff' })
    expect(staff.supervisorName).toBeUndefined()
    expect(staff.supervisorEmail).toBeUndefined()
  })

  it('takes the host out when another position is chosen', () => {
    const visitor = new Report({ position: 'Visitor', hostName: 'Bo', hostEmail: 'bo@mcmaster.ca' })
    const student = visitor.afterChanging({ position: 'Student' })
    expect(student.hostName).toBeUndefined()
    expect(student.hostEmail).toBeUndefined()
  })

  it('adds and replaces an expense', () => {
    const expense = new Expense({ description: 'Taxi' })
    const report = new Report().afterAdding(expense)
    expect(report.expenses).toEqual([expense])
    const replacement = expense.afterChanging({ description: 'Train' })
    expect(report.afterReplacing(expense, replacement).expenses).toEqual([replacement])
  })
})
