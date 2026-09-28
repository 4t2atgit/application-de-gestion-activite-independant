import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { defaultThemeId, isKnownThemeId, themes } from './themes';
import { ThemeContext } from './themeContextValue';

const STORAGE_KEY = 'micro-entreprise-suivi:theme';

function readStoredThemeId(): string {
  if (typeof window === 'undefined') return defaultThemeId;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isKnownThemeId(stored) ? stored : defaultThemeId;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(() => readStoredThemeId());

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    window.localStorage.setItem(STORAGE_KEY, themeId);
  }, [themeId]);

  const setThemeId = useCallback((nextThemeId: string) => {
    setThemeIdState(isKnownThemeId(nextThemeId) ? nextThemeId : defaultThemeId);
  }, []);

  const value = useMemo(() => ({ themeId, setThemeId, availableThemes: themes }), [themeId, setThemeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
