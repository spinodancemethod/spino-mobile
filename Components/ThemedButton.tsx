import React from 'react';
import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { useTheme } from '../constants/useTheme';
import { useStyles } from '../constants/styles';

type Variant = 'primary' | 'warning' | 'ghost';

interface Props {
    title: string;
    onPress?: () => void;
    variant?: Variant;
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    leftIcon?: React.ReactNode;
}

const ThemedButton: React.FC<Props> = ({
    title,
    onPress,
    variant = 'primary',
    disabled = false,
    loading = false,
    style,
    textStyle,
    leftIcon,
}) => {
    const { colors } = useTheme();
    const styles = useStyles();

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
                    color={variant === 'ghost' ? colors.text : colors.onPrimary}
                />
            ) : (
                <>
                    {leftIcon ? <React.Fragment>{leftIcon}</React.Fragment> : null}
                    <Text
                        style={[
                            styles.buttonText,
                            variant === 'ghost' && styles.buttonTextGhost,
                            textStyle,
                        ]}
                    >
                        {title}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
};

export default ThemedButton;
