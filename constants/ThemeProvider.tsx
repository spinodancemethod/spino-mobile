import React, { createContext, useContext, useMemo, useState } from 'react';
import { Colors } from './Colors';

/*
  ThemeProvider

  - Provides a simple theme toggle for development purposes.
  - Exposes `mode`, `colors`, and `toggle()` via context.
  - Components use `useTheme()` which will read from this provider when present.

  Notes:
  - The provider currently uses an in-memory state for the theme. To persist the
    selection across app restarts, persist `mode` to AsyncStorage and initialize
    from storage when the provider mounts.
*/
type Mode = 'light' | 'dark';

interface ThemeContextValue {
    mode: Mode;
    colors: typeof Colors.dark;
    toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<Mode>('dark');
    const toggle = () => setMode((m) => (m === 'dark' ? 'light' : 'dark'));
    const colors = mode === 'dark' ? Colors.dark : Colors.light;

    const value = useMemo(() => ({ mode, colors, toggle }), [mode]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useThemeContext() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useThemeContext must be used within ThemeProvider');
    return ctx;
}
