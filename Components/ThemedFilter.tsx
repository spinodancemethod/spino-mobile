import React, { useState } from 'react';
import { View, TouchableOpacity, Text, ScrollView, ActivityIndicator } from 'react-native';
import Modal from 'react-native-modal';
import { useStyles } from '../constants/styles';
import { useTheme } from '../constants/useTheme';

interface Props {
    selected: { id: string; name: string } | null;
    setSelected: (position: { id: string; name: string } | null) => void;
    items?: { id: string; name: string }[]; // optional: if not provided the component will fetch positions instead
    placeholder?: string;
}

const ThemedFilter: React.FC<Props> = ({ selected, setSelected, items, placeholder = 'Select an Item' }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    const [open, setOpen] = useState(false);
    const loading = false;

    function toggle(cat: { id: string; name: string }) {
        setSelected(cat);
    }

    return (
        <View style={styles.filterContainer}>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                style={[styles.filterButton, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
            >
                <Text style={[styles.filterButtonText, !selected && { opacity: 0.6 }]}>{selected?.name ?? placeholder}</Text>
            </TouchableOpacity>

            <Modal isVisible={open} onBackdropPress={() => setOpen(false)} backdropOpacity={0.85} style={{ justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ width: '90%', maxHeight: '70%', borderRadius: 16, overflow: 'hidden', backgroundColor: colors.card }}>
                    <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ padding: 12 }}>
                        {loading ? (
                            <View style={[styles.filterButton, { padding: 16, justifyContent: 'center', alignItems: 'center' }]}>
                                <ActivityIndicator color={colors.primary} />
                            </View>
                        ) : ((items ?? []).length === 0 ? (
                            <View style={[styles.filterButton, { padding: 16 }]}>
                                <Text style={styles.small}>No positions</Text>
                            </View>
                        ) : (
                            (items ?? []).map((c) => {
                                const active = selected?.id === c.id;
                                return (
                                    <TouchableOpacity
                                        key={c.id}
                                        onPress={() => { toggle(c); setOpen(false); }}
                                        style={[styles.filterButton, active && styles.filterButtonActive, { marginBottom: 6 }]}
                                    >
                                        <Text style={[styles.filterButtonText, active && styles.filterButtonTextActive]}>{c.name}</Text>
                                    </TouchableOpacity>
                                );
                            })
                        ))}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};

export default ThemedFilter;
