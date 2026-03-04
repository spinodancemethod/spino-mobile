import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { subscribe } from 'lib/snackbarService';
import { useTheme } from 'constants/useTheme';

const Snackbar: React.FC = () => {
    const { colors } = useTheme();
    const [snack, setSnack] = useState<any | null>(null);
    // start off-screen above
    const translateY = React.useRef(new Animated.Value(-120)).current;

    useEffect(() => subscribe((s) => setSnack(s)), []);

    useEffect(() => {
        if (snack) {
            // settle the snack a bit lower so it's clearly inside the safe area
            Animated.spring(translateY, { toValue: 48, useNativeDriver: true }).start();
            const t = setTimeout(() => {
                Animated.timing(translateY, { toValue: -120, duration: 240, useNativeDriver: true }).start(() => setSnack(null));
            }, snack.duration || 4000);
            return () => clearTimeout(t);
        }
    }, [snack]);

    if (!snack) return null;

    return (
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, transform: [{ translateY }], zIndex: 9999 }} pointerEvents="box-none">
            <SafeAreaView style={{ paddingHorizontal: 12 }}>
                <View style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 6 }}>
                    <Text style={{ color: colors.onPrimary, flex: 1 }}>{snack.message}</Text>
                    {snack.actionTitle ? (
                        <TouchableOpacity onPress={() => { snack.onAction && snack.onAction(); setSnack(null); }} style={{ paddingHorizontal: 12 }}>
                            <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>{snack.actionTitle}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </SafeAreaView>
        </Animated.View>
    );
};

export default Snackbar;
