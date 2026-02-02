import { useColorScheme } from 'react-native';
import { Colors, ThemeColors } from './Colors';
import { useMemo } from 'react';
import { useThemeContext } from './ThemeProvider';

export function useTheme(): { mode: 'light' | 'dark'; colors: ThemeColors } {
    try {
        const ctx = useThemeContext();
        return { mode: ctx.mode, colors: ctx.colors };
    } catch (e) {
        // If ThemeProvider is not present (for example in tests or other environments),
        // gracefully fall back to the system color scheme so components still render
        // with reasonable colors.
        const scheme = useColorScheme() ?? 'light';
        const mode = scheme === 'dark' ? 'dark' : 'light';
        const colors = mode === 'dark' ? Colors.dark : Colors.light;
        return useMemo(() => ({ mode, colors }), [mode]);
    }
}
