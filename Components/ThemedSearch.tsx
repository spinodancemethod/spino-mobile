import React from 'react';
import { View, TextInput, ViewStyle, TextInputProps } from 'react-native';
import { useTheme } from '../constants/useTheme';
import { useStyles } from '../constants/styles';

interface Props extends TextInputProps {
    style?: ViewStyle;
}

const ThemedSearch: React.FC<Props> = ({ style, ...props }) => {
    const { colors } = useTheme();
    const styles = useStyles();

    return (
        <View style={[{ width: '100%' }, style]}>
            <TextInput
                placeholderTextColor={colors.iconColor}
                style={{
                    backgroundColor: colors.uiBackground,
                    color: colors.text,
                    padding: 12,
                    borderRadius: 10,
                }}
                {...props}
            />
        </View>
    );
};

export default ThemedSearch;
