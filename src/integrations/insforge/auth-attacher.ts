import { createMiddleware } from '@tanstack/react-start'
import { getAccessToken } from '@/lib/insforge'

export const attachInsForgeAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    // Attempt to get the current valid session token
    const token = await getAccessToken();
    console.log('[INSFORGE_AUTH_ATTACH] Attaching token to server function call:', !!token);
    
    return next({
      headers: token ? { 
        Authorization: `Bearer ${token}` 
      } : {},
    })
  },
)
