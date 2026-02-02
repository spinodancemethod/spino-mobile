import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/useTheme';

interface Props {
    liked?: boolean;
    size?: number;
    onPress?: () => void;
}

const ThemedLike: React.FC<Props> = ({ liked = false, size = 20, onPress }) => {
    const { colors } = useTheme();

    // prefer theme warning for filled (red), fallback to hex
    const filledColor = colors.warning ?? '#EF4444';
    // a lighter outline color — try using warning with alpha fallback
    const outlineColor = colors.warning ? `${colors.warning}99` : '#FCA5A5'; // semi-transparent fallback

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Unfavorite' : 'Favorite'}
            testID={`like-button-${liked ? 'active' : 'idle'}`}
        >
            <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={size}
                color={liked ? filledColor : outlineColor}
            />
        </TouchableOpacity>
    );
};

export default ThemedLike;
