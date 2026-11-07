import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { claimantMemory } from './draft-store.ts'

const zoe = { claimantName: 'Zoë Lefèvre', position: 'Student', email: 'zoe@mcmaster.ca' } as const

describe('claimantMemory', () => {
  it('remembers nothing at first', async () => {
    expect(await claimantMemory(new IDBFactory()).recall()).toEqual({})
  })

  it('remembers the claimant from one report to the next', async () => {
    const factory = new IDBFactory()
    await claimantMemory(factory).remember(zoe)
    expect(await claimantMemory(factory).recall()).toEqual(zoe)
  })

  it('forgets a field left empty', async () => {
    const factory = new IDBFactory()
    const memory = claimantMemory(factory)
    await memory.remember(zoe)
    await memory.remember({ ...zoe, email: undefined })
    expect(await memory.recall()).toEqual({ ...zoe, email: undefined })
  })

  it('keeps only what follows the rules of each field', async () => {
    const factory = new IDBFactory()
    await new Promise<void>((resolve) => {
      const request = factory.open('macreport', 1)
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('claimant')
        store.put({ claimantName: '  ', position: 'Dean', email: 'not an email' }, 'claimant')
      }
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
    })
    expect(await claimantMemory(factory).recall()).toEqual({
      claimantName: undefined,
      position: undefined,
      email: undefined,
    })
  })

  it('works without the browser keeping anything, or when it refuses', async () => {
    const none = claimantMemory(undefined)
    await none.remember(zoe)
    expect(await none.recall()).toEqual({})
    const refusing = {
      open: () => {
        throw new Error('The browser refuses')
      },
    } as unknown as IDBFactory
    await claimantMemory(refusing).remember(zoe)
    expect(await claimantMemory(refusing).recall()).toEqual({})
  })

  it("uses the browser's own storage when given none", async () => {
    expect(await claimantMemory().recall()).toEqual({})
  })
})
