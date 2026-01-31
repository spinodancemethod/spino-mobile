import { StyleSheet } from 'react-native';
import { ThemeColors } from './Colors';

export const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
        },
        card: {
            backgroundColor: colors.card,
            padding: 20,
            borderRadius: 12,
            width: '100%',
        },
        title: {
            color: colors.text,
            fontSize: 22,
            fontWeight: 600,
            marginBottom: 12,
        },
        buttonText: {
            color: '#FFFFFF',
            fontWeight: 600,
        },
        button: {
            backgroundColor: colors.primary,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 120,
        },

        buttonWarning: {
            backgroundColor: colors.warning,
        },

        buttonGhost: {
            backgroundColor: 'transparent',
        },

        buttonDisabled: {
            opacity: 0.6,
        },

        buttonTextGhost: {
            color: colors.text,
        },
    });
