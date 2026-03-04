import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { Linking, AppState } from 'react-native';
import { showSnack } from 'lib/snackbarService';

type AuthContextValue = {
    session: Session | null;
    user: User | null;
    loading: boolean;
    processingLink?: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [processingLink, setProcessingLink] = useState(false);

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
            setProcessingLink(true);
            // small delay to ensure overlay is visible for very fast responses
            const start = Date.now();
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
            } finally {
                const elapsed = Date.now() - start;
                const min = 600;
                if (elapsed < min) await new Promise((r) => setTimeout(r, min - elapsed));
                setProcessingLink(false);
            }
        }

        // handle cold start link
        Linking.getInitialURL().then((u) => { handleUrl(u); }).catch(() => { /* ignore */ });

        // listen for links while app is running
        const subscription = Linking.addEventListener('url', (event) => {
            handleUrl(event.url);
        });

        // re-check session when app comes to foreground (helps catch refresh failures)
        const appStateHandler = (next: string) => {
            if (next === 'active') {
                // revalidate session
                supabase.auth.getSession().then(({ data }) => {
                    setSession(data?.session ?? null);
                    setUser(data?.session?.user ?? null);
                    if (!data?.session) {
                        // if session went away, snack and let onAuthStateChange/router flow handle redirect
                        showSnack('Session expired, please sign in again');
                    }
                }).catch(() => { /* ignore */ });
            }
        };

        const appStateSub = AppState.addEventListener('change', appStateHandler);

        return () => {
            mounted = false;
            sub?.subscription?.unsubscribe();
            try { subscription.remove(); } catch (e) { /* ignore */ }
            try { appStateSub.remove(); } catch (e) { /* ignore */ }
        };
    }, []);

    return (
        <AuthContext.Provider value={{ session, user, loading, processingLink }}>
            {children}
            {processingLink ? (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 16, borderRadius: 8 }}>
                        <span style={{ color: '#fff', fontWeight: '700' }}>Signing you in…</span>
                    </div>
                </div>
            ) : null}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

export default AuthProvider;

export async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            showSnack(error.message || 'Error signing out');
            return { error };
        }
        showSnack('Signed out successfully');
        return { error: null };
    } catch (e: any) {
        showSnack(e?.message ?? 'Error signing out');
        return { error: e };
    }
}

export async function signIn(email: string, password: string) {
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            showSnack(error.message || 'Login failed');
            return { error };
        }
        showSnack('Logged in');
        return { error: null };
    } catch (e: any) {
        showSnack(e?.message ?? 'Login failed');
        return { error: e };
    }
}

export async function signUp(email: string, password: string) {
    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
            showSnack(error.message || 'Signup failed');
            return { error };
        }
        showSnack('Signup successful. Check your email to confirm.');
        return { error: null, data };
    } catch (e: any) {
        showSnack(e?.message ?? 'Signup failed');
        return { error: e };
    }
}
