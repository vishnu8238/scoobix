import { createMiddleware } from '@tanstack/react-start'
import { insforge } from '@/lib/insforge'

/**
 * Attaches the InsForge auth token to server functions.
 * Replaces the legacy Supabase auth attacher.
 */
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const { data } = await insforge.auth.getSession()
    const token = data.session?.access_token
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
