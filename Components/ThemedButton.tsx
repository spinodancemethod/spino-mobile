import React, { useMemo } from 'react';
import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { useTheme } from '../constants/useTheme';
import { createStyles } from '../constants/styles';

type Variant = 'primary' | 'warning' | 'ghost';

interface Props {
    title: string;
    onPress?: () => void;
    variant?: Variant;
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

const ThemedButton: React.FC<Props> = ({
    title,
    onPress,
    variant = 'primary',
    disabled = false,
    loading = false,
    style,
    textStyle,
}) => {
    const colors = useTheme();

    // 🔑 Memoised stylesheet
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            disabled={disabled || loading}
            style={[
                styles.button,
                variant === 'warning' && styles.buttonWarning,
                variant === 'ghost' && styles.buttonGhost,
                disabled && styles.buttonDisabled,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator
                    color={variant === 'ghost' ? colors.text : '#FFFFFF'}
                />
            ) : (
                <Text
                    style={[
                        styles.buttonText,
                        variant === 'ghost' && styles.buttonTextGhost,
                        textStyle,
                    ]}
                >
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};

export default ThemedButton;
