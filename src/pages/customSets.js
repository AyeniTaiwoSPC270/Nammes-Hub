// The quizzes a person made on this device, kept in the browser so they can find them again and delete them early.
// (The secret that allows deleting is only stored here; nobody else has it.)

const KEY = 'nammes-my-sets'
const MAX = 10

export function loadMySets() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(list) ? list.filter((s) => s && typeof s.code === 'string') : []
  } catch {
    return []
  }
}

export function saveMySet(set) {
  try {
    const rest = loadMySets().filter((s) => s.code !== set.code)
    localStorage.setItem(KEY, JSON.stringify([set, ...rest].slice(0, MAX)))
  } catch {
    // private mode: the quiz still works, it just is not listed here
  }
}

export function forgetMySet(code) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadMySets().filter((s) => s.code !== code)))
  } catch {
    // ignore
  }
}

export function mySetByCode(code) {
  return loadMySets().find((s) => s.code === code) ?? null
}
