import { useEffect, useState } from 'react'
import { StyleSheet, FlatList, Text } from 'react-native'
import { usePositions } from 'lib/hooks/usePositions';
import ThemedButton from 'Components/ThemedButton';
import ThemedView from 'Components/ThemedView';
import { useTheme } from 'constants/useTheme';

export default function Positions() {
    const { data: instruments = [], isLoading } = usePositions(undefined);
    const { colors } = useTheme();

       return (
           <ThemedView safe={true}>
               <FlatList
                   data={instruments}
                   keyExtractor={(item: any) => item.id.toString()}
                   renderItem={({ item }: { item: any }) => (
                    <Text style={[{ color: colors.text, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                        {item.name}
                    </Text>
                )}
            />
            <ThemedButton title="Add Position" onPress={() => { console.log("") }} />
        </ThemedView>
    )
}
