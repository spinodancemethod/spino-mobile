import React from 'react';
import { View, StyleSheet } from 'react-native';
import ThemedView from './ThemedView';
import ThemedText from './ThemedText';
import ThemedButton from './ThemedButton';
import { reportAppError } from 'lib/observability';

type Props = {
    children: React.ReactNode;
};

type State = {
    hasError: boolean;
    error?: Error;
};

/**
 * Error boundary for catching unhandled React errors and showing recovery UI.
 * Prevents app from crashing to native error screen; allows user to retry.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Log to observability service
        void reportAppError({
            context: 'error_boundary',
            error,
            metadata: { componentStack: info.componentStack },
        });
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            return (
                <ThemedView style={styles.container}>
                    <View style={styles.content}>
                        <ThemedText variant="title" style={styles.title}>
                            Something went wrong
                        </ThemedText>
                        <ThemedText style={styles.message}>
                            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
                        </ThemedText>
                        <ThemedButton
                            title="Try again"
                            onPress={this.handleReset}
                            style={styles.button}
                        />
                    </View>
                </ThemedView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    content: {
        alignItems: 'center',
        gap: 16,
    },
    title: {
        fontWeight: '700',
        marginBottom: 8,
    },
    message: {
        textAlign: 'center',
        marginBottom: 8,
    },
    button: {
        marginTop: 16,
    },
});
