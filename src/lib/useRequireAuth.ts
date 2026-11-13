import { useCallback } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../auth';
import { useStore } from '../store';

export const LOGIN_FIRST = 'Please log in or create an account first.';

/** Wrap a button handler: signed in -> runs; signed out -> "log in first" notice and the login page, never a dead tap. */
export function useRequireAuth() {
  const { user } = useAuth();
  const { toast } = useStore();
  return useCallback(
    <A extends unknown[]>(fn: (...a: A) => void) =>
      (...a: A) => {
        if (user) return fn(...a);
        toast(LOGIN_FIRST);
        router.push({ pathname: '/signin', params: { mode: 'in' } });
      },
    [user, toast],
  );
}
