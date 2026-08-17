import React from 'react'
import { TextInput, TextInputProps, StyleProp, TextStyle } from 'react-native'
import { useTheme } from 'constants/useTheme'

type Props = TextInputProps & {
    style?: StyleProp<TextStyle>
}

export default function ThemedInput({ style, placeholderTextColor, ...props }: Props) {
    const { colors } = useTheme()

    return (
        <TextInput
            {...props}
            placeholderTextColor={placeholderTextColor ?? colors.placeholder}
            style={[
                {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderRadius: 6,
                    borderWidth: 1,
                    color: colors.text,
                    minHeight: 44,
                    paddingHorizontal: 10,
                },
                style,
            ]}
        />
    )
}
