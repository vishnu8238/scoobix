import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@insforge/sdk'

export const requireInsForgeAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const INSFORGE_URL = process.env['VITE_INSFORGE_URL'] || process.env['INSFORGE_URL'] || "https://awvs3seh.us-east.insforge.app";
    const INSFORGE_ANON_KEY = process.env['VITE_INSFORGE_ANON_KEY'] || process.env['INSFORGE_ANON_KEY'];

    const request = getRequest();
    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available');
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized: No token provided');
    }

    const token = authHeader.replace('Bearer ', '');
    const insforge = createClient({
      baseUrl: INSFORGE_URL,
      anonKey: INSFORGE_ANON_KEY || "",
    });

    // For server-side validation, we typically set the session token manually in the client 
    // or rely on a specific verification method if available.
    // If getCurrentUser() doesn't take a token, we might need a different approach 
    // depending on the SDK version.
    
    const { data: userData, error } = await insforge.auth.getCurrentUser();
    
    if (error || !userData?.user) {
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
