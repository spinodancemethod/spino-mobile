import { StyleSheet } from 'react-native';
import { ThemeColors } from './Colors';
import { useMemo } from 'react';
import { useTheme } from './useTheme';

export const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
        },
        padded: {
            padding: 16,
        },
        card: {
            backgroundColor: colors.card,
            padding: 20,
            borderRadius: 12,
            width: '100%',
        },
        buttonText: {
            color: colors.onPrimary,
            fontWeight: '600',
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
        base: {
            color: colors.text,
        },
        title: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.title,
        },

        subheader: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.title,
        },

        large: {
            fontSize: 16,
            fontWeight: '400',
        },

        small: {
            fontSize: 13,
            fontWeight: '400',
            opacity: 0.8,
        },
        icon: {
            color: colors.iconColorFocused,
            backgroundColor: colors.uiBackground,
        },
        filterContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            width: '100%',
            marginVertical: 8,
            alignItems: 'center',
            alignSelf: 'stretch',
        },
        filterButton: {
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 20,
            backgroundColor: colors.uiBackground,
            marginRight: 8,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: colors.border,
        },
        filterButtonActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        filterButtonText: {
            color: colors.text,
        },
        filterButtonTextActive: {
            color: colors.onPrimary,
        },
        inactiveIcon: {
            color: colors.iconColor,
            backgroundColor: colors.uiBackground,
        }
    });

export const useStyles = () => {
    const { colors } = useTheme();
    return useMemo(() => createStyles(colors), [colors]);
};
