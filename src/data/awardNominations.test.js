import { describe, it, expect } from 'vitest'
import { groupNominationsByText } from './awardNominations'

describe('groupNominationsByText', () => {
  it('groups exact case/whitespace-insensitive matches and counts them', () => {
    const nominations = [
      { id: '1', nominee_name: 'Taiwo A.' },
      { id: '2', nominee_name: '  taiwo a.  ' },
      { id: '3', nominee_name: 'Chidi' },
    ]
    const groups = groupNominationsByText(nominations)
    expect(groups).toEqual([
      { displayName: 'Taiwo A.', count: 2, ids: ['1', '2'], photos: [] },
      { displayName: 'Chidi', count: 1, ids: ['3'], photos: [] },
    ])
  })
  it('sorts groups by count descending', () => {
    const nominations = [
      { id: '1', nominee_name: 'Bola' },
      { id: '2', nominee_name: 'Ada' },
      { id: '3', nominee_name: 'Ada' },
    ]
    const groups = groupNominationsByText(nominations)
    expect(groups[0].displayName).toBe('Ada')
    expect(groups[0].count).toBe(2)
  })
  it('returns an empty array for no nominations', () => {
    expect(groupNominationsByText([])).toEqual([])
  })
  it('collects distinct photo urls per group, in input order', () => {
    const nominations = [
      { id: '1', nominee_name: 'Ada', photo_url: 'https://x/a1.jpg' },
      { id: '2', nominee_name: 'ada', photo_url: 'https://x/a2.jpg' },
      { id: '3', nominee_name: 'Ada', photo_url: 'https://x/a1.jpg' },
      { id: '4', nominee_name: 'Bola', photo_url: null },
    ]
    const groups = groupNominationsByText(nominations)
    const ada = groups.find((g) => g.displayName === 'Ada')
    expect(ada.photos).toEqual(['https://x/a1.jpg', 'https://x/a2.jpg'])
    const bola = groups.find((g) => g.displayName === 'Bola')
    expect(bola.photos).toEqual([])
  })
})
