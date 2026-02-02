import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/useTheme';

interface Props {
    starred?: boolean;
    size?: number;
    onPress?: () => void;
}

const ThemedStar: React.FC<Props> = ({ starred = false, size = 20, onPress }) => {
    const { colors } = useTheme();
    const filledColor = colors.primary ?? '#F59E0B';
    const outlineColor = colors.primary ? `${colors.primary}99` : '#FDE68A';

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={starred ? 'Remove from deck' : 'Add to deck'}
            testID={`deck-button-${starred ? 'active' : 'idle'}`}
        >
            <Ionicons
                name={starred ? 'star' : 'star-outline'}
                size={size}
                color={starred ? filledColor : outlineColor}
            />
        </TouchableOpacity>
    );
};

export default ThemedStar;
