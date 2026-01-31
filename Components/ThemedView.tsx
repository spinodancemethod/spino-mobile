import React, { useMemo } from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../constants/useTheme';
import { createStyles } from '../constants/styles';

interface Props {
    children: React.ReactNode;
    style?: ViewStyle;
    padded?: boolean;
    variant?: 'default' | 'card';
}

const ThemedView: React.FC<Props> = ({
    children,
    style,
    padded = false,
    variant = 'default',
}) => {
    const colors = useTheme();

    // 🔑 Memoised stylesheet
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View
            style={[
                styles.container,
                padded && styles.padded,
                variant === 'card' && styles.card,
                style,
            ]}
        >
            {children}
        </View>
    );
};

export default ThemedView;
