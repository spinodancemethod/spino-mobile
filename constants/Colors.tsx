export const Colors = {
    dark: {
        text: '#DCD6FF',
        title: '#FFFFFF',
        background: '#0B0326',
        navBackground: '#120524',
        iconColor: '#C4B5FD',
        iconColorFocused: '#FFFFFF',
        uiBackground: '#1B0733',
        primary: '#8B5CF6',
        onPrimary: '#FFFFFF',
        card: '#1F1330',
        warning: '#FB7185',
        border: '#2F1B3A',
    },
    light: {
        text: '#2B0B3A',
        title: '#1F0A2B',
        background: '#F5F3FF',
        navBackground: '#EDE9FE',
        iconColor: '#6D28D9',
        iconColorFocused: '#4C1D95',
        uiBackground: '#F3E8FF',
        primary: '#7C3AED',
        onPrimary: '#FFFFFF',
        card: '#FFFFFF',
        warning: '#E11D48',
        border: '#DDD6FE',
    },
}

export type ThemeColors = typeof Colors.dark;