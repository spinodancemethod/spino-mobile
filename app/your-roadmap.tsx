import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import GlobalMenu from 'Components/GlobalMenu'
import { ScrollView } from 'react-native'

const YourRoadmap = () => {
    return (
        <ThemedView style={{ flex: 1 }}>
            <GlobalMenu />
            <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
                <ThemedText variant="title" style={{ marginBottom: 12 }}>Your roadmap</ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12 }}>
                    This is your personalised learning roadmap. We'll add content and tools here to help you plan and track progress.
                </ThemedText>
            </ScrollView>
        </ThemedView>
    )
}

export default YourRoadmap
