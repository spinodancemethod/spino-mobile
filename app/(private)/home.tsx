import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import ThemedButton from 'Components/ThemedButton'
import { ScrollView, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from 'constants/useTheme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSubscriptionStatus } from 'lib/hooks/useSubscriptionStatus'
import { useEffect, useMemo } from 'react'
import { useAuth } from 'lib/auth'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateBillingQueries } from 'lib/hooks/useBilling'

const Home = () => {
    const { colors } = useTheme()
    const insets = useSafeAreaInsets()
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const params = useLocalSearchParams<{ refreshSubscription?: string | string[] }>()
    const shouldRefreshAfterPurchase = useMemo(() => {
        const value = params.refreshSubscription
        if (Array.isArray(value)) {
            return value.includes('1')
        }
        return value === '1'
    }, [params.refreshSubscription])
    const subscriptionStatus = useSubscriptionStatus()
    const hasActiveSubscription = subscriptionStatus.isActiveSubscription
    const isCheckingSubscription = subscriptionStatus.isLoading

    useEffect(() => {
        if (!shouldRefreshAfterPurchase || !user?.id) {
            return
        }

        const refreshQueries = () => {
            void invalidateBillingQueries(queryClient, user.id)
        }

        // Kick once immediately, then briefly poll while webhook-driven DB updates settle.
        refreshQueries()
        const interval = setInterval(refreshQueries, 2500)
        const timeout = setTimeout(() => {
            clearInterval(interval)
            router.replace('/home')
        }, 30000)

        return () => {
            clearInterval(interval)
            clearTimeout(timeout)
        }
    }, [queryClient, shouldRefreshAfterPurchase, user?.id])

    useEffect(() => {
        if (!shouldRefreshAfterPurchase || !hasActiveSubscription) {
            return
        }

        // Drop the query flag once access flips to active.
        router.replace('/home')
    }, [hasActiveSubscription, shouldRefreshAfterPurchase])

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, width: '100%' }}>
                {/* Hero block */}
                <View style={{ backgroundColor: colors.primary, padding: 24, borderRadius: 14, marginTop: insets.top + 12, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 }}>
                    <ThemedText variant="title" style={{ marginBottom: 12, color: colors.onPrimary, fontSize: 36, fontWeight: '800', letterSpacing: 0.2, lineHeight: 44 }}>
                        Your dance workspace
                    </ThemedText>

                    <ThemedText variant="subheader" style={{ marginBottom: 6, color: colors.onPrimary, fontSize: 18, fontWeight: '600', lineHeight: 26 }}>
                        Keep your class videos, movement ideas, and practice notes organized in one place.
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
                            Your workspace is ready
                        </ThemedText>
                        <ThemedButton
                            title="Go to your Workspace"
                            onPress={() => router.push('/(private)/(dashboard)/your-roadmaps')}
                            style={{ width: '100%', marginTop: 4 }}
                        />
                    </View>
                )}

                {!isCheckingSubscription && !hasActiveSubscription && (
                    <>
                        <View
                            style={{
                                backgroundColor: colors.card,
                                borderRadius: 14,
                                padding: 16,
                                marginBottom: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                        >
                            {/* Keep purchase CTA visible for users who have not activated a subscription. */}
                            <ThemedText variant="subheader" style={{ marginBottom: 10, fontSize: 18, lineHeight: 26, fontWeight: '700', textAlign: 'center' }}>
                                Organize your dance learnings
                            </ThemedText>
                            <ThemedButton
                                title="Subscribe"
                                onPress={() => router.push('/subscribe')}
                                style={{ width: '100%', marginTop: 4 }}
                            />
                        </View>

                        {/* Keep workspace quick-link outside the subscribe card container. */}
                        <ThemedButton
                            title="Open your Workspace"
                            leftIcon={<Ionicons name="compass" size={16} color={colors.onPrimary} style={{ marginRight: 8 }} />}
                            onPress={() => router.push('/(private)/(dashboard)/your-roadmaps')}
                            style={{ width: '86%', alignSelf: 'center', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 }}
                        />
                    </>
                )}

                {/* Supporting copy — larger, increased line-height for readability */}
                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    Turn class recordings into useful references. Save the moments worth revisiting and group them into roadmaps you can actually use.
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    Break routines into timestamped segments, add your own notes, and keep related movements together by roadmap or category.
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    Open a reference when you need it, review a short section, and mark the pieces you want to revisit at your next practice or social.
                </ThemedText>

                <View style={{ backgroundColor: colors.primary, padding: 24, borderRadius: 14, marginTop: insets.top + 12, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 }}>
                    <ThemedText variant="subheader" style={{ marginBottom: 6, color: colors.onPrimary, fontSize: 18, fontWeight: '600', lineHeight: 26 }}>
                        Built for the way dancers collect ideas
                    </ThemedText>
                </View>

                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    Class recordings are useful when you can find the exact moment you want to practice.
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    Keep movements as flexible references instead of being tied to one long routine.
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    Build your own structure around the skills, combinations, and ideas you are working on now.
                </ThemedText>

                <ThemedText variant="subheader" style={{ marginBottom: 12, fontSize: 18, lineHeight: 26 }}>
                    Small, searchable segments make your archive easier to use when you are dancing, practicing, or planning what to work on next.
                </ThemedText>
            </ScrollView>
        </ThemedView>
    )
}

export default Home
