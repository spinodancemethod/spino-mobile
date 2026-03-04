import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';

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

        return () => {
            mounted = false;
            sub?.subscription?.unsubscribe();
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
