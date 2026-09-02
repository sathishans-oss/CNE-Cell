import React, { createContext, useContext, useState, useEffect } from 'react';
import { PortalTheme } from '../types';

interface ThemeContextType {
  theme: PortalTheme;
  setTheme: (theme: PortalTheme) => void;
  resetTheme: () => void;
  isSaved: boolean;
  saveCurrentTheme: () => void;
}

const THEME_STORAGE_KEY = 'aiims_cne_portal_theme_v1';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<PortalTheme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as PortalTheme | null;
    if (saved && ['emerald', 'navy', 'bento', 'nordic'].includes(saved)) {
      return saved;
    }
    return 'emerald';
  });

  const [isSaved, setIsSaved] = useState<boolean>(() => {
    return !!localStorage.getItem(THEME_STORAGE_KEY);
  });

  const setTheme = (newTheme: PortalTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    setIsSaved(true);
  };

  const resetTheme = () => {
    setThemeState('emerald');
    localStorage.setItem(THEME_STORAGE_KEY, 'emerald');
    setIsSaved(true);
  };

  const saveCurrentTheme = () => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    setIsSaved(true);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resetTheme, isSaved, saveCurrentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const usePortalTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('usePortalTheme must be used within a ThemeProvider');
  }
  return context;
};
