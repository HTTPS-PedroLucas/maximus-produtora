import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clientStyle as buildClientStyle, THEME_SURFACE } from '../lib/colors';

const ThemeContext = createContext(null);

export const THEME_KEY = 'maximus_theme';
const THEMES = ['dark', 'light'];

function readStoredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  return THEMES.includes(stored) ? stored : 'dark';
}

/**
 * Tema da interface. O escuro é o padrão da Máximus; o claro serve para
 * ambientes com muita luz, apresentações e impressão.
 * A escolha fica salva no navegador de cada pessoa.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f2f7' : '#08070b');
  }, [theme]);

  const setTheme = useCallback((value) => {
    setThemeState(THEMES.includes(value) ? value : 'dark');
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({ theme, isLight: theme === 'light', setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext) || { theme: 'dark', isLight: false, setTheme: () => {}, toggleTheme: () => {} };
}

/**
 * Devolve o `clientStyle` já ajustado ao tema atual: as cores dos clientes
 * são calculadas contra a superfície certa para manter o contraste.
 */
export function useClientStyle() {
  const { theme } = useTheme();
  return useCallback((hex) => buildClientStyle(hex, THEME_SURFACE[theme] || THEME_SURFACE.dark), [theme]);
}
