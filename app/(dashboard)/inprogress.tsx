import Spacer from 'Components/Spacer'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { router } from 'expo-router'

const InProgress = () => {
    return (
        <ThemedView>

            <Spacer />
            <ThemedText>
                Your task
            </ThemedText>
            <ThemedText>
                HERE ARE YOUR chosen CLASSES
            </ThemedText>
            <Spacer />
            <ThemedText>
                There will be a maximum of 3 saved classes for free users.
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

export default InProgress