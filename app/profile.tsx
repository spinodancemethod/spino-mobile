import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import ThemedButton from 'Components/ThemedButton'
import { View } from 'react-native'

const Profile = () => {
    // dummy data
    const user = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        subscription: 'Free',
        deckCount: 2,
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ padding: 16 }}>
                <ThemedText variant="title">{user.name}</ThemedText>
                <ThemedText variant="subheader" style={{ marginTop: 8 }}>{user.email}</ThemedText>

                <View style={{ marginTop: 16 }}>
                    <ThemedText variant="subheader">Subscription</ThemedText>
                    <ThemedText style={{ marginTop: 6 }}>{user.subscription}</ThemedText>
                </View>

                <View style={{ marginTop: 16 }}>
                    <ThemedText variant="subheader">Deck</ThemedText>
                    <ThemedText style={{ marginTop: 6 }}>{user.deckCount} saved classes</ThemedText>
                </View>

                <View style={{ marginTop: 24 }}>
                    <ThemedButton title="Edit Profile" onPress={() => { }} />
                </View>
            </View>
        </ThemedView>
    )
}

export default Profile
