import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from 'lib/queryClient';
import { ThemeProvider } from 'constants/ThemeProvider';
import AppContent from './AppContent';

const RootLayout = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <AppContent />
            </ThemeProvider>
        </QueryClientProvider>
    )
}

export default RootLayout