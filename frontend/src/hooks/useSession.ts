import { useQuery } from '@tanstack/react-query';
import { getSession, type Session } from '../api/auth';
import { setCsrfToken } from '../api/client';

export const SESSION_KEY = ['session'] as const;

// Single source of truth for auth state. Keeps the CSRF token in sync with the
// session so mutations can attach it.
export function useSession() {
  return useQuery<Session>({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const session = await getSession();
      setCsrfToken(session.csrf_token);
      return session;
    },
    staleTime: 5 * 60 * 1000,
    // Doubles as the presence heartbeat: this endpoint stamps sessions.last_used_at,
    // and a cache-served SPA otherwise stops talking to the server right after login,
    // freezing "last seen" at the login time. Paused while the tab is in the
    // background (refetchIntervalInBackground defaults to false), so it tracks
    // someone actually looking at the site rather than a forgotten open tab.
    refetchInterval: 5 * 60 * 1000,
  });
}
