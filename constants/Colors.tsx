export const Colors = {
    dark: {
        text: "#d4d4d4",
        title: "#fff",
        background: "#252231",
        navBackground: "#201e2b",
        iconColor: "#9591a5",
        iconColorFocused: "#fff",
        uiBackground: "#2f2b3d",
        primary: '#2563EB',
        onPrimary: '#FFFFFF',
        card: '#F3F4F6',
        warning: "#cc475a",
    },
    light: {
        text: "#625f72",
        title: "#201e2b",
        background: "#e0dfe8",
        navBackground: "#e8e7ef",
        iconColor: "#686477",
        iconColorFocused: "#201e2b",
        uiBackground: "#d6d5e1",
        primary: '#60A5FA',
        onPrimary: '#FFFFFF',
        card: '#111827',
        warning: "#cc475a",
    },
}

export type ThemeColors = typeof Colors.dark;