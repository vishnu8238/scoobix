import { createMiddleware } from '@tanstack/react-start'
import { insforge, getAccessToken } from '@/lib/insforge'

export const attachInsForgeAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const token = await getAccessToken();
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
