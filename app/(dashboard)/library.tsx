import Spacer from 'Components/Spacer'
import ThemedSearch from 'Components/ThemedSearch'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { router } from 'expo-router/build/exports'
import { useEffect, useState } from 'react'
import ThemedFilter from 'Components/ThemedFilter'
import { usePositions } from '@/lib/hooks/usePositions'

const Library = () => {
    const { data: positions = [], isLoading } = usePositions(undefined);
    const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        if (selected) {
            console.log("Selected position:", selected);
            console.log("Trigger network request to retrieve videos");
        }
    }, [selected]);

    return (
        <ThemedView>
            <ThemedFilter selected={selected} setSelected={setSelected} items={positions} />
            <ThemedSearch placeholder="Search library..." />
            <Spacer />
            <ThemedText>
                Library
            </ThemedText>
            <ThemedButton
                title="Home"
                onPress={() => {
                    router.push('/');
                }}
                style={{ width: "100%" }}
            />
        </ThemedView>
    )
}

export default Library