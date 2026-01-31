import React, { useMemo } from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '../constants/useTheme';
import { createStyles } from '../constants/styles';
type Variant = 'title' | 'subheader' | 'large' | 'small';

interface Props {
    children: React.ReactNode;
    variant?: Variant;
    style?: TextStyle;
    numberOfLines?: number;
}

const ThemedText: React.FC<Props> = ({
    children,
    variant = 'large',
    style,
    numberOfLines,
}) => {
    const colors = useTheme();

    // 🔑 Memoised stylesheet
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <Text
            numberOfLines={numberOfLines}
            style={[
                styles.base,
                styles[variant],
                style,
            ]}
        >
            {children}
        </Text>
    );
};

export default ThemedText;
