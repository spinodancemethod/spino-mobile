import React, { useState } from 'react';
import { View, TextInput, ViewStyle, TextInputProps, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/useTheme';

interface Props extends TextInputProps {
    style?: ViewStyle;
}

const ThemedSearch: React.FC<Props> = ({ style, ...props }) => {
    const { colors } = useTheme();
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const isPasswordField = Boolean(props.secureTextEntry);
    const secureTextEntry = isPasswordField ? !isPasswordVisible : props.secureTextEntry;

    return (
        <View style={[{ width: '100%' }, style]}>
            <TextInput
                placeholderTextColor={colors.iconColor}
                style={{
                    backgroundColor: colors.uiBackground,
                    color: colors.text,
                    padding: 12,
                    // Reserve space for the eye toggle on password fields.
                    paddingRight: isPasswordField ? 44 : 12,
                    borderRadius: 10,
                }}
                {...props}
                secureTextEntry={secureTextEntry}
            />
            {isPasswordField ? (
                <TouchableOpacity
                    onPress={() => setIsPasswordVisible((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
                    style={{
                        position: 'absolute',
                        right: 12,
                        top: 0,
                        bottom: 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Ionicons
                        name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.iconColor}
                    />
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

export default ThemedSearch;
