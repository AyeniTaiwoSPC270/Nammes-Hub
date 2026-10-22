import { QueryClient } from '@tanstack/react-query'

// Query keys in this app are not user-scoped, so a cached owner-only answer survives sign-out and is
// handed straight to the next account that signs in on the same tab. The first identity resolution
// is ignored: the cache is empty then, and clearing would only throw away the initial public fetches.
export function identityChanged(previousUserId, nextUserId) {
  return previousUserId !== undefined && previousUserId !== nextUserId
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      networkMode: 'always',
    },
    mutations: {
      networkMode: 'always',
    },
  },
})
