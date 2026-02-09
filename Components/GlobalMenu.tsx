import React from 'react';
import { View, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from 'constants/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles } from 'constants/styles';
import ThemedText from 'Components/ThemedText';
import { useRouter } from 'expo-router';

const GlobalMenu: React.FC = () => {
    const { mode, toggle } = useThemeContext();
    const styles = useStyles();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [open, setOpen] = React.useState(false);

    return (
        <>
            <View style={{ position: 'absolute', top: insets.top + 8, right: insets.right + 12 }}>
                <TouchableOpacity onPress={() => setOpen(true)} style={{ padding: 8 }}>
                    <Ionicons name={'menu'} size={24} color={styles.icon.color} />
                </TouchableOpacity>
            </View>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <TouchableWithoutFeedback onPress={() => setOpen(false)}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />
                </TouchableWithoutFeedback>
                <View style={{ position: 'absolute', top: insets.top + 56, right: 12, width: 220, backgroundColor: styles.card.backgroundColor, borderRadius: 12, padding: 8, elevation: 6 }}>
                    <TouchableOpacity onPress={() => { setOpen(false); router.push('/home'); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                        <Ionicons name={'home-outline'} size={18} color={styles.icon.color} />
                        <View style={{ width: 12 }} />
                        <ThemedText variant="subheader">Home</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => { setOpen(false); router.push('/your-roadmap'); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                        <Ionicons name={'map-outline'} size={18} color={styles.icon.color} />
                        <View style={{ width: 12 }} />
                        <ThemedText variant="subheader">Your roadmap</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => { toggle(); setOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                        <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={18} color={styles.icon.color} />
                        <View style={{ width: 12 }} />
                        <ThemedText variant="subheader">Toggle theme</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => { setOpen(false); router.push('/profile'); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                        <Ionicons name={'person-circle-outline'} size={18} color={styles.icon.color} />
                        <View style={{ width: 12 }} />
                        <ThemedText variant="subheader">Profile</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setOpen(false); router.push('/'); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                        <Ionicons name={'log-out-outline'} size={18} color={styles.icon.color} />
                        <View style={{ width: 12 }} />
                        <ThemedText variant="subheader">Sign out</ThemedText>
                    </TouchableOpacity>
                </View>
            </Modal>
        </>
    );
};

export default GlobalMenu;
