import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

type RevenueCatModule = typeof import('react-native-purchases');
type RevenueCatPaywallModule = typeof import('react-native-purchases-ui');

let purchasesModule: RevenueCatModule | null = null;
let revenueCatPaywallModule: RevenueCatPaywallModule | null = null;
let isConfigured = false;
let currentAppUserId: string | null = null;
let revenueCatIdentityQueue: Promise<void> = Promise.resolve();
const DEFAULT_PRO_ENTITLEMENT_IDENTIFIER = 'Spinodancemethod ltd Pro';
const REVENUECAT_IN_FLIGHT_BACKEND_CODE = 7638;

export type RevenueCatOfferingsSnapshot = {
    currentOffering: PurchasesOffering | null;
    allOfferingIdentifiers: string[];
    isConfigured: boolean;
    platform: string;
    apiKeyAvailable: boolean;
};

function getRevenueCatErrorDetails(error: unknown) {
    if (!error || typeof error !== 'object') {
        return null;
    }

    const typedError = error as {
        message?: unknown;
        code?: unknown;
        userInfo?: {
            readableErrorCode?: unknown;
            underlyingErrorMessage?: unknown;
            rc_code_name?: unknown;
            [key: string]: unknown;
        };
    };

    const details: string[] = [];

    if (typeof typedError.message === 'string' && typedError.message.trim()) {
        details.push(`message=${typedError.message}`);
    }

    if (typedError.code !== undefined && typedError.code !== null) {
        details.push(`code=${String(typedError.code)}`);
    }

    if (typedError.userInfo?.readableErrorCode) {
        details.push(`readableCode=${String(typedError.userInfo.readableErrorCode)}`);
    }

    if (typedError.userInfo?.rc_code_name) {
        details.push(`rcCode=${String(typedError.userInfo.rc_code_name)}`);
    }

    if (typeof typedError.userInfo?.underlyingErrorMessage === 'string' && typedError.userInfo.underlyingErrorMessage.trim()) {
        details.push(`underlying=${typedError.userInfo.underlyingErrorMessage}`);
    }

    return details.length ? details.join('; ') : null;
}

function runRevenueCatIdentityOperation<T>(operation: () => Promise<T>) {
    // RevenueCat identify/logIn/logOut operations must be serialized to avoid
    // 429 "another request in flight" responses when startup and auth events overlap.
    const run = revenueCatIdentityQueue
        .catch(() => undefined)
        .then(async () => {
            try {
                return await operation();
            } catch (error) {
                if (!isInFlightIdentityConflict(error)) {
                    throw error;
                }

                // RevenueCat occasionally returns a transient 429/7638 when two identify
                // operations overlap at SDK/native boundary. Retry once after a short delay.
                await wait(350);
                return operation();
            }
        });

    revenueCatIdentityQueue = run
        .then(() => undefined)
        .catch(() => undefined);

    return run;
}

function wait(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isInFlightIdentityConflict(error: unknown) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const typedError = error as {
        code?: unknown;
        message?: unknown;
        underlyingErrorMessage?: unknown;
        info?: {
            backendErrorCode?: unknown;
            [key: string]: unknown;
        };
    };

    const backendCode = Number(typedError.info?.backendErrorCode);
    if (backendCode === REVENUECAT_IN_FLIGHT_BACKEND_CODE) {
        return true;
    }

    const message = [typedError.message, typedError.underlyingErrorMessage]
        .filter((value) => typeof value === 'string')
        .join(' ')
        .toLowerCase();

    return message.includes('another request in flight') || message.includes('request: identify');
}

function isSupportedPlatform() {
    return Platform.OS === 'ios' || Platform.OS === 'android';
}

function isExpoGo() {
    return Constants.appOwnership === 'expo';
}

function isRevenueCatUiUnavailableRuntime() {
    // In Expo Go, Purchases UI runs in preview mode and cannot present native paywalls.
    return isExpoGo();
}

function getApiKey() {
    const testStoreApiKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY?.trim() ?? '';

    // Expo Go cannot access native stores. Use RevenueCat Test Store key when present.
    if (isExpoGo()) {
        return testStoreApiKey;
    }

    if (Platform.OS === 'ios') {
        return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
    }

    if (Platform.OS === 'android') {
        return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';
    }

    return '';
}

async function getPurchasesModule() {
    if (purchasesModule) {
        return purchasesModule;
    }

    purchasesModule = await import('react-native-purchases');
    return purchasesModule;
}

async function getRevenueCatPaywallModule() {
    if (revenueCatPaywallModule) {
        return revenueCatPaywallModule;
    }

    revenueCatPaywallModule = await import('react-native-purchases-ui');
    return revenueCatPaywallModule;
}

async function ensureRevenueCatConfigured() {
    if (!isSupportedPlatform()) {
        return null;
    }

    if (!isConfigured) {
        await initializeRevenueCat(currentAppUserId);
    }

    if (!isConfigured) {
        return null;
    }

    return getPurchasesModule();
}

export async function initializeRevenueCat(appUserId?: string | null) {
    if (!isSupportedPlatform()) {
        return;
    }

    await runRevenueCatIdentityOperation(async () => {
        const apiKey = getApiKey();
        if (!apiKey) {
            if (isExpoGo()) {
                // eslint-disable-next-line no-console
                console.warn('[billing] RevenueCat is disabled in Expo Go until EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY is set.');
                return;
            }

            // eslint-disable-next-line no-console
            console.warn('[billing] RevenueCat API key is missing for platform:', Platform.OS);
            return;
        }

        const purchases = await getPurchasesModule();

        if (!isConfigured) {
            try {
                // Use the Supabase user id as the RevenueCat appUserID so both systems
                // refer to the same customer identity across Android and iOS.
                purchases.default.configure({
                    apiKey,
                    appUserID: appUserId ?? undefined,
                });
            } catch (error: any) {
                // Expo Go with a non-Test-Store key throws at configure time.
                // Keep app startup resilient by treating this as non-fatal.
                // eslint-disable-next-line no-console
                console.warn('[billing] RevenueCat configure skipped:', error?.message ?? error);
                return;
            }

            isConfigured = true;
            currentAppUserId = appUserId ?? null;
            return;
        }

        if (!appUserId || appUserId === currentAppUserId) {
            return;
        }

        await purchases.default.logIn(appUserId);
        currentAppUserId = appUserId;
    });
}

export async function syncRevenueCatAppUser(appUserId: string | null | undefined) {
    if (!isSupportedPlatform()) {
        return;
    }

    await runRevenueCatIdentityOperation(async () => {
        if (!appUserId) {
            return;
        }

        if (!isConfigured) {
            const apiKey = getApiKey();
            if (!apiKey) {
                return;
            }

            const purchases = await getPurchasesModule();
            purchases.default.configure({
                apiKey,
                appUserID: appUserId,
            });
            isConfigured = true;
            currentAppUserId = appUserId;
            return;
        }

        if (appUserId === currentAppUserId) {
            return;
        }

        const purchases = await getPurchasesModule();
        await purchases.default.logIn(appUserId);
        currentAppUserId = appUserId;
    });
}

export async function clearRevenueCatAppUser() {
    if (!isSupportedPlatform() || !isConfigured) {
        return;
    }

    await runRevenueCatIdentityOperation(async () => {
        const purchases = await getPurchasesModule();
        await purchases.default.logOut();
        currentAppUserId = null;
    });
}

export async function getRevenueCatCurrentOffering(): Promise<PurchasesOffering | null> {
    const purchases = await ensureRevenueCatConfigured();
    if (!purchases) {
        return null;
    }

    const offerings = await purchases.default.getOfferings();
    return offerings.current ?? null;
}

export async function getRevenueCatOfferingsSnapshot(): Promise<RevenueCatOfferingsSnapshot> {
    const purchases = await ensureRevenueCatConfigured();
    if (!purchases) {
        return {
            currentOffering: null,
            allOfferingIdentifiers: [],
            isConfigured: false,
            platform: Platform.OS,
            apiKeyAvailable: Boolean(getApiKey().trim()),
        };
    }

    let offerings;
    try {
        offerings = await purchases.default.getOfferings();
    } catch (error) {
        const details = getRevenueCatErrorDetails(error);
        const message = details
            ? `RevenueCat offerings request failed: ${details}`
            : 'RevenueCat offerings request failed.';
        throw new Error(message);
    }

    // Include all known offering ids so empty-state UI can point to dashboard setup drift.
    const allOfferingIdentifiers = Object
        .values(offerings.all ?? {})
        .map((offering) => offering.identifier)
        .filter(Boolean);

    return {
        currentOffering: offerings.current ?? null,
        allOfferingIdentifiers,
        isConfigured: true,
        platform: Platform.OS,
        apiKeyAvailable: true,
    };
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo> {
    const purchases = await ensureRevenueCatConfigured();
    if (!purchases) {
        throw new Error('RevenueCat is not configured for this platform.');
    }

    return purchases.default.getCustomerInfo();
}

export function getRevenueCatRequiredEntitlementIdentifier() {
    const configuredEntitlementId = process.env.EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID?.trim();
    return configuredEntitlementId || DEFAULT_PRO_ENTITLEMENT_IDENTIFIER;
}

export function hasRevenueCatEntitlement(
    customerInfo: { entitlements?: { active?: Record<string, unknown> } },
    entitlementIdentifier = getRevenueCatRequiredEntitlementIdentifier(),
) {
    const activeEntitlements = customerInfo.entitlements?.active ?? {};
    return Boolean(activeEntitlements[entitlementIdentifier]);
}

export async function presentRevenueCatPaywall(offering?: PurchasesOffering | null) {
    if (!isSupportedPlatform()) {
        throw new Error('RevenueCat paywall is available on iOS and Android only.');
    }

    if (isRevenueCatUiUnavailableRuntime()) {
        throw new Error('RevenueCat paywall is unavailable in Expo Go. Use a development build to test purchases UI.');
    }

    const purchases = await ensureRevenueCatConfigured();
    if (!purchases) {
        throw new Error('RevenueCat is not configured for this platform.');
    }

    const revenueCatUI = await getRevenueCatPaywallModule();

    // Present the dashboard-managed paywall only when the Pro entitlement is missing.
    const result = await revenueCatUI.default.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: getRevenueCatRequiredEntitlementIdentifier(),
        offering: offering ?? undefined,
        displayCloseButton: true,
    });

    return result;
}

export async function presentRevenueCatCustomerCenter() {
    if (!isSupportedPlatform()) {
        throw new Error('Customer Center is available on iOS and Android only.');
    }

    if (isRevenueCatUiUnavailableRuntime()) {
        throw new Error('RevenueCat Customer Center is unavailable in Expo Go. Use a development build to test it.');
    }

    const purchases = await ensureRevenueCatConfigured();
    if (!purchases) {
        throw new Error('RevenueCat is not configured for this platform.');
    }

    const revenueCatUI = await getRevenueCatPaywallModule();
    return revenueCatUI.default.presentCustomerCenter();
}

export async function addRevenueCatCustomerInfoUpdateListener(listener: (customerInfo: CustomerInfo) => void) {
    const purchases = await ensureRevenueCatConfigured();
    if (!purchases) {
        throw new Error('RevenueCat is not configured for this platform.');
    }

    purchases.default.addCustomerInfoUpdateListener(listener);
    return () => {
        purchases.default.removeCustomerInfoUpdateListener(listener);
    };
}

export async function purchaseRevenueCatPackage(selectedPackage: PurchasesPackage): Promise<CustomerInfo> {
    const purchases = await ensureRevenueCatConfigured();
    if (!purchases) {
        throw new Error('RevenueCat is not configured for this platform.');
    }

    const result = await purchases.default.purchasePackage(selectedPackage);
    return result.customerInfo;
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo> {
    const purchases = await ensureRevenueCatConfigured();
    if (!purchases) {
        throw new Error('RevenueCat is not configured for this platform.');
    }

    return purchases.default.restorePurchases();
}
