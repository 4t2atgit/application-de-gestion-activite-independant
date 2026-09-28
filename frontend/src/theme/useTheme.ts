import { useContext } from 'react';
import { ThemeContext } from './themeContextValue';

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme doit être utilisé au sein d’un ThemeProvider.');
  }
  return context;
}
