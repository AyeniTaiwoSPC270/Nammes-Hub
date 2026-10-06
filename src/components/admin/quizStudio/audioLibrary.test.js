import { describe, it, expect } from 'vitest'
import { filesFromAChange } from './AudioLibrary'

// Choosing a file in the browser and clearing the input is where an import silently does nothing.
//
// A file input's `files` is a live FileList, not a copy: setting the input's value to '' empties it. So a handler that
// holds a reference to `e.target.files` and clears the input before it reads the reference gets an empty list, and the
// import loop runs zero times with no error anywhere. That is exactly what an admin sees when Import does nothing.

describe('reading the files out of a change event', () => {
  // A live FileList, like the browser's: clearing the input empties the very same object a caller is holding.
  const liveInput = (files) => {
    const list = [...files]
    return {
      target: {
        files: list,
        value: 'C:\\fakepath\\chosen',
        // Assigning value is what clears a real input, and what empties its FileList.
        set reset(v) { if (v === '') list.length = 0 },
      },
    }
  }

  it('gives the files that were chosen, not the empty list the input ends up holding', () => {
    const event = liveInput([{ name: 'Air Horn.mp3', type: 'audio/mpeg', size: 40000 }])

    // The bug, spelled out: take the reference, clear the input, then read.
    const reference = event.target.files
    event.target.reset = ''
    expect(reference, 'clearing the input empties the live list').toHaveLength(0)

    // The fix: copy before clearing.
    const second = liveInput([{ name: 'Cheer.wav', type: 'audio/wav', size: 20000 }])
    const copied = filesFromAChange(second)
    second.target.reset = ''
    expect(copied, 'the copy survives the input being cleared').toHaveLength(1)
    expect(copied[0].name).toBe('Cheer.wav')
  })
  it('copies the list, so the array handed over is not the one the browser empties', () => {
    const event = liveInput([{ name: 'Setlist.ogg', type: 'audio/ogg', size: 900000 }])
    const copied = filesFromAChange(event)
    expect(Array.isArray(copied)).toBe(true)
    expect(copied).not.toBe(event.target.files)
    expect(copied).toHaveLength(1)
    expect(copied[0].name).toBe('Setlist.ogg')
  })
  it('copies each file, so a cleared input cannot empty what is about to be imported', () => {
    const event = liveInput([{ name: 'A.mp3' }, { name: 'B.mp3' }])
    const copied = filesFromAChange(event)
    event.target.reset = ''
    expect(copied).toHaveLength(2)
  })
  it('copes with a change event that carries no files at all', () => {
    expect(filesFromAChange({ target: {} })).toEqual([])
    expect(filesFromAChange({ target: { files: null } })).toEqual([])
    expect(filesFromAChange(undefined)).toEqual([])
  })
})