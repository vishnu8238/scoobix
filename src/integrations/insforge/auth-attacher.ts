import { createMiddleware } from '@tanstack/react-start'
import { getAccessToken } from '@/lib/insforge'

export const attachInsForgeAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    // Authoritative token resolution for EVERY server function call
    let token = await getAccessToken();
    
    // Await hydration if token is missing
    if (!token) {
      const { ensureAuthHydrated } = await import('@/lib/insforge');
      await ensureAuthHydrated();
      token = await getAccessToken();
    }
    
    console.log('[INSFORGE_AUTH_ATTACH] Propagation Check: Token Present =', !!token);
    
    // Explicitly set the Authorization header which requireInsForgeAuth expects
    return next({
      headers: token ? { 
        Authorization: `Bearer ${token}` 
      } : {},
    })
  },
)
