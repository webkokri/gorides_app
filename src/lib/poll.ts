import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { isCoolingDown } from './api';

/**
 * Runs `fn` now and then every `ms`, but only while the screen is focused and the app is in the foreground,
 * and never while the server has asked us to back off (after a 429). `fn` must be stable (useCallback).
 */
export function usePolling(fn: () => void | Promise<unknown>, ms: number) {
  useFocusEffect(
    useCallback(() => {
      const tick = () => {
        if (AppState.currentState === 'active' && !isCoolingDown()) fn();
      };
      const first = setTimeout(tick, 0);
      const t = setInterval(tick, ms);
      return () => {
        clearTimeout(first);
        clearInterval(t);
      };
    }, [fn, ms]),
  );
}
