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
      throw new Error('Unauthorized: No token provided');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create a per-request client and bind the token.
    // The InsForge SDK uses HttpClient internally which manages the userToken.
    // Calling setAuthToken on the HttpClient instance (via client.auth.tokenManager or directly if accessible)
    // ensures this request's context is authenticated.
    const insforge = createClient({
      baseUrl: INSFORGE_URL,
      anonKey: INSFORGE_ANON_KEY,
    });

    // Bind the token to this request-specific client
    (insforge.auth as any).tokenManager.setAccessToken(token);

    const { data: userData, error } = await insforge.auth.getCurrentUser();
    
    if (error || !userData?.user) {
      console.error('[INSFORGE_AUTH_MW] Token validation failed:', error?.message);
      throw new Error('Unauthorized: Invalid token');
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
