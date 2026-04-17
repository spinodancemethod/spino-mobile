import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
// fonts are preloaded in app/_layout.tsx
import ThemedButton from 'Components/ThemedButton';
import { router } from 'expo-router';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import { supabase } from 'lib/supabase';

export default function RootIndex() {
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function check() {
            // font preloading is handled in app/_layout.tsx
            try {
                console.log('[auth-debug] RootIndex check() starting');
                const { data } = await supabase.auth.getSession();
                const session = data?.session;
                console.log('[auth-debug] RootIndex getSession completed, has session:', !!session);
                if (!mounted) return;
                if (session?.user) {
                    // authenticated -> go to app home
                    console.log('[auth-debug] RootIndex routing to /home');
                    router.replace('/home');
                } else {
                    // not authenticated -> show login
                    console.log('[auth-debug] RootIndex routing to /login');
                    router.replace('/login');
                }
            } catch (e) {
                console.error('[auth-debug] RootIndex check() error:', e);
                // on error, fallback to login
                router.replace('/login');
            } finally {
                if (mounted) setChecking(false);
            }
        }

        console.log('[auth-debug] RootIndex mounted');
        check();
        return () => { mounted = false; };
    }, []);

    // brief splash while we decide
    return (
        <ThemedView padded safe>
            <ThemedText variant="title">Welcome</ThemedText>
            <ThemedText variant="small">Checking authentication...</ThemedText>
            <ActivityIndicator style={{ marginTop: 20 }} />
        </ThemedView>
    );
}
