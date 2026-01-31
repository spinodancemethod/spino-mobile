import { useEffect, useState } from 'react'
import { StyleSheet, FlatList, Text } from 'react-native'
import { supabase } from '@/lib/supabase';
import ThemedButton from 'Components/ThemedButton';
import ThemedView from 'Components/ThemedView';
import { useTheme } from 'constants/useTheme';

export default function Positions() {
    const [instruments, setInstruments] = useState<any>([])

    const { colors } = useTheme();

    useEffect(() => {
        getInstruments()
    }, [])

    async function getInstruments() {
        const { data } = await supabase.from('positions').select()

        setInstruments(data)
    }

    return (
        <ThemedView safe={true}>
            <FlatList
                data={instruments}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <Text style={[{ color: colors.text }]}>
                        {item.name}
                    </Text>
                )}
            />
            <ThemedButton title="Add Position" onPress={() => { console.log("") }} />
        </ThemedView>
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