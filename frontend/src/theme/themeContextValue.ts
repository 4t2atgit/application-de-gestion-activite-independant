import { createContext } from 'react';
import { themes } from './themes';

export interface ThemeContextValue {
  themeId: string;
  setThemeId: (themeId: string) => void;
  availableThemes: typeof themes;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
