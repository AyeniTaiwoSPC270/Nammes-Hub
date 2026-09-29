import { lazy } from 'react'

// Retries a failed dynamic import a couple of times before giving up, so a
// momentary network drop doesn't send the user to the "couldn't load" screen.
export function lazyRetry(factory, retries = 2, delayMs = 800) {
  return lazy(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await factory()
      } catch (err) {
        if (attempt >= retries) throw err
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
      }
    }
  })
}
