import { useEffect, useState } from 'react'
import { StyleSheet, View, FlatList, Text, useColorScheme } from 'react-native'
import { supabase } from '@/lib/supabase';
import { Colors } from 'constants/Colors';
import ThemedButton from 'Components/ThemedButton';

export default function Positions() {
    const [instruments, setInstruments] = useState<any>([])

    const colorScheme = useColorScheme();
    //@ts-ignore
    const theme = Colors[colorScheme] ?? Colors.light

    useEffect(() => {
        getInstruments()
    }, [])

    async function getInstruments() {
        const { data } = await supabase.from('positions').select()

        setInstruments(data)
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <FlatList
                data={instruments}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <Text style={[styles.item, { color: theme.text }]}>
                        {item.name}
                    </Text>
                )}
            />
            <ThemedButton title="Add Position" onPress={() => { console.log("") }} />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // backgroundColor: '#fff',
        paddingTop: 50,
        paddingBottom: 100,
        paddingHorizontal: 16,
    },
    item: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
})