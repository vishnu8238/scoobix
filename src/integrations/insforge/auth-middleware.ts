import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@insforge/sdk'

export const requireInsForgeAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const INSFORGE_URL = process.env['VITE_INSFORGE_URL'] || process.env['INSFORGE_URL'] || "https://awvs3seh.us-east.insforge.app";
    const INSFORGE_ANON_KEY = process.env['VITE_INSFORGE_ANON_KEY'] || process.env['INSFORGE_ANON_KEY'] || "sb_publishable_FIPSldMe55J2LJ_hczRqag_orYaOaTT";

    const request = getRequest();
    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available');
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[INSFORGE_AUTH_MW] No Bearer token found in headers');
      throw new Error('Unauthorized: No token provided');
    }

    const token = authHeader.replace('Bearer ', '');
    
    const insforge = createClient({
      baseUrl: INSFORGE_URL,
      anonKey: INSFORGE_ANON_KEY,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectOAuthCallback: false
      }
    });

    // Authoritative Token Injection
    (insforge.auth as any).tokenManager.setAccessToken(token);

    // Validate token by fetching the user
    const { data: userData, error } = await insforge.auth.getCurrentUser();
    
    if (error || !userData?.user) {
      console.error('[INSFORGE_AUTH_MW] Token validation failed:', error?.message || 'Invalid user data');
      throw new Error(`Unauthorized: Invalid token (${error?.message || 'Verification failed'})`);
    }

    return next({
      context: {
        insforge,
        userId: userData.user.id,
        user: userData.user,
      },
    });
  },
);
