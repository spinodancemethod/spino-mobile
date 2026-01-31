import React, { useMemo } from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '../constants/useTheme';
import { createStyles, useStyles } from '../constants/styles';
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
    const styles = useStyles();

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
