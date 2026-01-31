import Spacer from 'Components/Spacer'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { router } from 'expo-router/build/exports'

const Library = () => {
    return (
        <ThemedView>

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