import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { showSnack } from 'lib/snackbarService';

type AuthContextValue = {
    session: Session | null;
    user: User | null;
    loading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                const { data } = await supabase.auth.getSession();
                if (!mounted) return;
                setSession(data?.session ?? null);
                setUser(data?.session?.user ?? null);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        init();

        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session ?? null);
            setUser(session?.user ?? null);
            // navigate on important transitions
            if (event === 'SIGNED_OUT') {
                router.replace('/login');
            }
            if (event === 'SIGNED_IN') {
                router.replace('/home');
            }
        });

        // deep link / magic link handling
        async function handleUrl(url?: string | null) {
            if (!url) return;
            try {
                // prefer supabase helper if available
                // @ts-ignore
                if (typeof supabase.auth.getSessionFromUrl === 'function') {
                    // some implementations accept an object with url, others read from current location
                    // try both common signatures
                    // @ts-ignore
                    const res = await supabase.auth.getSessionFromUrl({ url });
                    // if no error, session will be stored and onAuthStateChange will fire
                    if (res?.error) {
                        showSnack(res.error.message || 'Failed to handle auth link');
                    }
                    return;
                }

                // fallback: parse fragment/query for access_token & refresh_token
                const hashIdx = url.indexOf('#');
                const query = hashIdx >= 0 ? url.slice(hashIdx + 1) : (url.split('?')[1] ?? '');
                const params = new URLSearchParams(query);
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');
                if (access_token && refresh_token) {
                    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
                    if (error) showSnack(error.message);
                }
            } catch (e: any) {
                showSnack(e?.message ?? 'Failed to process auth link');
            }
        }

        // handle cold start link
        Linking.getInitialURL().then((u) => { handleUrl(u); }).catch(() => { /* ignore */ });

        // listen for links while app is running
        const subscription = Linking.addEventListener('url', (event) => {
            handleUrl(event.url);
        });

        return () => {
            mounted = false;
            sub?.subscription?.unsubscribe();
            try { subscription.remove(); } catch (e) { /* ignore */ }
        };
    }, []);

    return (
        <AuthContext.Provider value={{ session, user, loading }}>{children}</AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

export default AuthProvider;
