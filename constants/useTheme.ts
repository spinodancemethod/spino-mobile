import { useColorScheme } from 'react-native';
import { Colors, ThemeColors } from './Colors';
import { useMemo } from 'react';

export function useTheme(): { mode: 'light' | 'dark'; colors: ThemeColors } {
    const scheme = useColorScheme() ?? 'light';
    const mode = scheme === 'dark' ? 'dark' : 'light';
    const colors = mode === 'dark' ? Colors.dark : Colors.light;
    return useMemo(() => ({ mode, colors }), [mode]);
}
