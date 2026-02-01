import React from 'react';
import { TouchableOpacity, ViewStyle, StyleSheet } from 'react-native';
import ThemedText from './ThemedText';
import { useTheme } from '../constants/useTheme';

type Size = 'small' | 'medium' | 'large';

interface Props {
    children: React.ReactNode;
    color?: string; // can be a theme token (e.g. 'primary') or any color string
    textColor?: string;
    size?: Size;
    onPress?: () => void;
    style?: ViewStyle;
}

const SIZE_MAP: Record<Size, { paddingV: number; paddingH: number; fontVariant: 'small' | 'large' | 'subheader'; borderRadius: number }> = {
    small: { paddingV: 4, paddingH: 8, fontVariant: 'small', borderRadius: 12 },
    medium: { paddingV: 6, paddingH: 10, fontVariant: 'large', borderRadius: 14 },
    large: { paddingV: 8, paddingH: 12, fontVariant: 'subheader', borderRadius: 16 },
};

function isThemeToken(key: string, colors: Record<string, string>) {
    return Object.prototype.hasOwnProperty.call(colors, key);
}

function hexLuminance(hex: string) {
    // compute relative luminance approximation for deciding text color
    try {
        const c = hex.replace('#', '');
        const bigint = parseInt(c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        // standard formula
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return lum / 255;
    } catch (e) {
        return 0.5;
    }
}

const ThemedPill: React.FC<Props> = ({ children, color, textColor, size = 'medium', onPress, style }) => {
    const { colors } = useTheme();

    let backgroundColor = colors.uiBackground;
    if (color) {
        if (isThemeToken(color, colors as any)) {
            // @ts-ignore - dynamic access
            backgroundColor = (colors as any)[color];
        } else {
            backgroundColor = color;
        }
    }

    let resolvedTextColor = textColor ?? colors.text;
    if (!textColor) {
        // choose contrast color based on luminance if color looks like hex
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(backgroundColor)) {
            const lum = hexLuminance(backgroundColor);
            resolvedTextColor = lum > 0.6 ? '#000000' : '#FFFFFF';
        } else {
            // fallback to onPrimary when using theme primary or dark backgrounds
            resolvedTextColor = colors.onPrimary ?? colors.text;
        }
    }

    const sizeCfg = SIZE_MAP[size];

    return (
        <TouchableOpacity
            activeOpacity={onPress ? 0.8 : 1}
            onPress={onPress}
            style={[
                styles.pill,
                {
                    backgroundColor,
                    paddingVertical: sizeCfg.paddingV,
                    paddingHorizontal: sizeCfg.paddingH,
                    borderRadius: sizeCfg.borderRadius,
                },
                style,
            ]}
        >
            <ThemedText variant={sizeCfg.fontVariant as any} style={{ color: resolvedTextColor }}>{children}</ThemedText>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    pill: {
        alignSelf: 'flex-start',
    },
});

export default ThemedPill;
