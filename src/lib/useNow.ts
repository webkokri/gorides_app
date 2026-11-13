import { useEffect, useState } from 'react';

/** The current time, refreshed every `ms` (default 30s), so time-window UI flips on its own without a reload. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
