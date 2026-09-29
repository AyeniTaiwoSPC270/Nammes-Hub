import { describe, it, expect } from 'vitest'
import { safeFileName, ownFolderPath } from './uploadPath'

describe('safeFileName', () => {
  it('replaces spaces with dashes', () => {
    expect(safeFileName('my photo.png')).toBe('my-photo.png')
  })
  it('strips path separators and other unsafe characters', () => {
    expect(safeFileName('../../etc/passwd.png')).toBe('..-..-etc-passwd.png')
    expect(safeFileName('a/b\\c?.jpg')).toBe('a-b-c-.jpg')
  })
  it('keeps letters, digits, dots, dashes and underscores', () => {
    expect(safeFileName('Photo_01-final.JPG')).toBe('Photo_01-final.JPG')
  })
  it('falls back to a generic name when nothing safe is left', () => {
    expect(safeFileName('???')).toBe('file')
    expect(safeFileName('')).toBe('file')
  })
})

describe('ownFolderPath', () => {
  it('puts the file inside the user folder with a timestamp prefix', () => {
    expect(ownFolderPath('user-1', 'my photo.png', 1700000000000)).toBe('user-1/1700000000000-my-photo.png')
  })
  it('never lets a crafted file name escape the user folder', () => {
    const path = ownFolderPath('user-1', '../other-user/x.png', 5)
    expect(path.startsWith('user-1/5-')).toBe(true)
    expect(path.split('/')).toHaveLength(2)
  })
})
