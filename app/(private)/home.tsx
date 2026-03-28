import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import ThemedButton from 'Components/ThemedButton'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useTheme } from 'constants/useTheme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSubscriptionStatus } from 'lib/hooks/useSubscriptionStatus'

const Home = () => {
    const { colors } = useTheme()
    const insets = useSafeAreaInsets()
    const subscriptionStatus = useSubscriptionStatus()
    const hasActiveSubscription = subscriptionStatus.isActiveSubscription
    const isCheckingSubscription = subscriptionStatus.isLoading

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, width: '100%' }}>
                {/* Hero block */}
                <View style={{ backgroundColor: colors.primary, padding: 24, borderRadius: 14, marginTop: insets.top + 12, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 }}>
                    <ThemedText variant="title" style={{ marginBottom: 12, color: colors.onPrimary, fontSize: 36, fontWeight: '800', letterSpacing: 0.2, lineHeight: 44 }}>
                        Welcome
                    </ThemedText>

                    <ThemedText variant="subheader" style={{ marginBottom: 6, color: colors.onPrimary, fontSize: 18, fontWeight: '600', lineHeight: 26 }}>
                        Bachata can get complicated real fast. Simplifying the basics is the best way to build a solid foundation so you can focus more on movement QUALITY and less on remembering the moves.
                    </ThemedText>
                </View>
                {/* Keep subscription status and CTA grouped in one card so the state is visually clear. */}
                {isCheckingSubscription && (
                    <View
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <ThemedText variant="subheader" style={{ marginBottom: 10, fontSize: 18, lineHeight: 26, fontWeight: '700', textAlign: 'center' }}>
                            Checking your subscription...
                        </ThemedText>
                    </View>
                )}

                {hasActiveSubscription && (
                    <View
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <ThemedText variant="subheader" style={{ marginBottom: 10, fontSize: 18, lineHeight: 26, fontWeight: '700', textAlign: 'center' }}>
                            You are Subscribed!
                        </ThemedText>
                        <ThemedButton
                            title="Go to your Workspace"
                            onPress={() => router.push('/your-roadmap')}
                            style={{ width: '100%', marginTop: 4 }}
                        />
                    </View>
                )}

                {!isCheckingSubscription && !hasActiveSubscription && (
                    <View
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        {/* Keep purchase CTA visible for users who have not activated a subscription. */}
                        <ThemedText variant="subheader" style={{ marginBottom: 10, fontSize: 18, lineHeight: 26, fontWeight: '700', textAlign: 'center' }}>
                            Unlock your full roadmap
                        </ThemedText>
                        <ThemedButton
                            title="Subscribe"
                            onPress={() => router.push('/subscribe')}
                            style={{ width: '100%', marginTop: 4 }}
                        />
                    </View>
                )}

                {/* Supporting copy — larger, increased line-height for readability */}
                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    It's much easier to remember moves from positions. If you have 3 positions each with 3 variations you are able to perform 9 different combos. That is the idea.
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    Pick a position, pick 3 variations, learn them, and master them on your social night out. After each night, add notes — what works, what doesn't — and repeat for new positions/variations.
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    Soon, you will see your dancing transformed. You can focus more on connecting with your partner, and quality movements as your brain will be freed from memorizing routines.
                </ThemedText>

                <View style={{ backgroundColor: colors.primary, padding: 24, borderRadius: 14, marginTop: insets.top + 12, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 }}>
                    <ThemedText variant="subheader" style={{ marginBottom: 6, color: colors.onPrimary, fontSize: 18, fontWeight: '600', lineHeight: 26 }}>
                        Why this conventional approach to learning is flawed.
                    </ThemedText>
                </View>

                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    How many classes have you been to and recorded videos only to find it near impossible to remember when you need to?
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    How many times do you start a routine learnt in class, only to then find it doesnt go with the music but you feel the only way out is to complete the sequence?
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    How many times are classes randomly created with no progression or structure, leaving you with no clear path to improvement?
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    When leaders stand infront of followers, the ability to ACCESS our archives of classes reduces dramatically. In these states, the most effective approach is to have small bite sized chunks which we can recall with ease.
                </ThemedText>
            </ScrollView>
        </ThemedView>
    )
}

export default Home
