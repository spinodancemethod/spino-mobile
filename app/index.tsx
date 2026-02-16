import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
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
            try {
                const { data } = await supabase.auth.getSession();
                const session = data?.session;
                if (!mounted) return;
                if (session?.user) {
                    // authenticated -> go to app home
                    router.replace('/home');
                } else {
                    // not authenticated -> show login
                    router.replace('/login');
                }
            } catch (e) {
                // on error, fallback to login
                router.replace('/login');
            } finally {
                if (mounted) setChecking(false);
            }
        }

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
