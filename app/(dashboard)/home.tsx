import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import { ScrollView } from 'react-native'

const Home = () => {
    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <ThemedText variant="title" style={{ marginBottom: 12 }}>Welcome</ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12 }}>
                    Bachata can get complicated real fast. Simplifying the basics is the best way to build a solid foundation so you can focus more on movement QUALITY and less on remembering the moves.
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12 }}>
                    It's much easier to remember moves from positions. If you have 3 positions each with 3 variations you are able to perform 9 different combos. That is the idea.
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12 }}>
                    Pick a position, pick 3 variations, learn them, and master them on your social night out. After each night, add notes — what works, what doesn't — and repeat for new positions/variations.
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12 }}>
                    Soon, you will see your dancing transformed. You can focus more on connecting with your partner, and quality movements as your brain will be freed from memorizing routines.
                </ThemedText>
            </ScrollView>
        </ThemedView>
    )
}

export default Home
