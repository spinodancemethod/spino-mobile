import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { useStyles } from '../constants/styles';
type Variant = 'title' | 'subheader' | 'large' | 'small';

interface Props {
    children: React.ReactNode;
    variant?: Variant;
    style?: StyleProp<TextStyle>;
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
