import { useColorScheme } from 'react-native';
import { Colors, ThemeColors } from './Colors';

export function useTheme(): ThemeColors {
    const scheme = useColorScheme();
    return scheme === 'dark' ? Colors.dark : Colors.light;
}
