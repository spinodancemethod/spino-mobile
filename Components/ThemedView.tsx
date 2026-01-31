import React, { useMemo } from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../constants/useTheme';
import { createStyles, useStyles } from '../constants/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
    children: React.ReactNode;
    style?: ViewStyle;
    padded?: boolean;
    variant?: 'default' | 'card';
    safe?: boolean;
    props?: any
}

const ThemedView: React.FC<Props> = ({
    children,
    style,
    padded = false,
    variant = 'default',
    safe = false,
    ...props
}) => {
    const styles = useStyles();

    if (!safe) return (
        <View
            style={[
                styles.container,
                padded && styles.padded,
                variant === 'card' && styles.card,
                style,
            ]}
            {...props}
        >
            {children}
        </View>
    )

    const insets = useSafeAreaInsets()

    return (
        <View
            style={[
                styles.container,
                padded && styles.padded,
                {
                    backgroundColor: styles.container.backgroundColor,
                    paddingTop: insets.top,
                    paddingBottom: insets.bottom
                },
                variant === 'card' && styles.card,
                style,
            ]}
        >
            {children}
        </View>
    );
};

export default ThemedView;
