import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

type RevenueCatModule = typeof import('react-native-purchases');
type RevenueCatPaywallModule = typeof import('react-native-purchases-ui');

let purchasesModule: RevenueCatModule | null = null;
let revenueCatPaywallModule: RevenueCatPaywallModule | null = null;
let isConfigured = false;
let currentAppUserId: string | null = null;
const DEFAULT_PRO_ENTITLEMENT_IDENTIFIER = 'Spinodancemethod ltd Pro';

function isSupportedPlatform() {
    return Platform.OS === 'ios' || Platform.OS === 'android';
}

function getApiKey() {
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

    const apiKey = getApiKey();
    if (!apiKey) {
        // eslint-disable-next-line no-console
        console.warn('[billing] RevenueCat API key is missing for platform:', Platform.OS);
        return;
    }

    const purchases = await getPurchasesModule();

    if (!isConfigured) {
        // Use the Supabase user id as the RevenueCat appUserID so both systems
        // refer to the same customer identity across Android and iOS.
        purchases.default.configure({
            apiKey,
            appUserID: appUserId ?? undefined,
        });

        isConfigured = true;
        currentAppUserId = appUserId ?? null;
        return;
    }

    if (!appUserId || appUserId === currentAppUserId) {
        return;
    }

    await purchases.default.logIn(appUserId);
    currentAppUserId = appUserId;
}

export async function syncRevenueCatAppUser(appUserId: string | null | undefined) {
    if (!isSupportedPlatform()) {
        return;
    }

    if (!appUserId) {
        return;
    }

    if (!isConfigured) {
        await initializeRevenueCat(appUserId);
        return;
    }

    if (appUserId === currentAppUserId) {
        return;
    }

    const purchases = await getPurchasesModule();
    await purchases.default.logIn(appUserId);
    currentAppUserId = appUserId;
}

export async function clearRevenueCatAppUser() {
    if (!isSupportedPlatform() || !isConfigured) {
        return;
    }

    const purchases = await getPurchasesModule();
    await purchases.default.logOut();
    currentAppUserId = null;
}

export async function getRevenueCatCurrentOffering(): Promise<PurchasesOffering | null> {
    const purchases = await ensureRevenueCatConfigured();
    if (!purchases) {
        return null;
    }

    const offerings = await purchases.default.getOfferings();
    return offerings.current ?? null;
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

    await ensureRevenueCatConfigured();
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

    await ensureRevenueCatConfigured();
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
