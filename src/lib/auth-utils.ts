import { AuthState } from './auth-store';

export const isAuthResolving = (state: AuthState): boolean => {
  return (
    state === 'initializing' || 
    state === 'session_resolving' || 
    state === 'authorization_resolving' ||
    state === 'oauth_callback_in_progress'
  );
};
