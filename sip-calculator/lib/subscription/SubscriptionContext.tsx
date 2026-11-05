import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

export const PRO_ENTITLEMENT_ID = 'pro';

const ANDROID_API_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY;
/** RevenueCat Test Store keys (test_…) work on any platform; real Play keys (goog_…) only on Android. */
const IS_TEST_STORE_KEY = !!ANDROID_API_KEY?.startsWith('test_');

let configured = false;

/** Configures RevenueCat once per app process. Returns false where billing isn't available
 * (web, iOS with a Play key, or a missing API key), so the app keeps working with isPro = false. */
function configurePurchases(): boolean {
  if (configured) return true;
  const supported = Platform.OS === 'android' || (Platform.OS === 'ios' && IS_TEST_STORE_KEY);
  if (!supported || !ANDROID_API_KEY) {
    if (__DEV__) console.warn('[RevenueCat] Not configured: set EXPO_PUBLIC_RC_ANDROID_KEY (see .env.local).');
    return false;
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey: ANDROID_API_KEY });
  configured = true;
  return true;
}

const hasPro = (info: CustomerInfo) => info.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;

function showError(title: string, e: unknown) {
  if ((e as { userCancelled?: boolean | null })?.userCancelled) return;
  const message = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
  Alert.alert(title, message);
}

interface SubscriptionValue {
  isPro: boolean;
  loading: boolean;
  /** False when RevenueCat isn't configured on this platform/build. */
  available: boolean;
  offering: PurchasesOffering | null;
  packages: PurchasesPackage[];
  /** The one-time "Lifetime" package that unlocks Pro forever, or null if the offering has none. */
  lifetimePackage: PurchasesPackage | null;
  /** Resolves true when the purchase unlocked Pro. Cancellation resolves false without an alert. */
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  /** Resolves true when Pro is active after restoring. */
  restore: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [available] = useState(configurePurchases);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(available);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    if (!available) return;
    let active = true;
    const onUpdate = (info: CustomerInfo) => setIsPro(hasPro(info));
    Purchases.addCustomerInfoUpdateListener(onUpdate);

    (async () => {
      try {
        const [info, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
        if (!active) return;
        setIsPro(hasPro(info));
        setOffering(offerings.current);
      } catch (e) {
        if (__DEV__) console.warn('[RevenueCat] Initial load failed', e);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      Purchases.removeCustomerInfoUpdateListener(onUpdate);
    };
  }, [available]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      if (!available) return false;
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        const pro = hasPro(customerInfo);
        setIsPro(pro);
        return pro;
      } catch (e) {
        showError('Purchase failed', e);
        return false;
      }
    },
    [available]
  );

  const restore = useCallback(async () => {
    if (!available) return false;
    try {
      const info = await Purchases.restorePurchases();
      const pro = hasPro(info);
      setIsPro(pro);
      if (!pro) Alert.alert('Nothing to restore', 'No previous Pro purchase was found for this Google account.');
      return pro;
    } catch (e) {
      showError('Restore failed', e);
      return false;
    }
  }, [available]);

  const value = useMemo<SubscriptionValue>(
    () => ({
      isPro,
      loading,
      available,
      offering,
      packages: offering?.availablePackages ?? [],
      lifetimePackage:
        offering?.lifetime ??
        offering?.availablePackages.find((p) => p.packageType === PACKAGE_TYPE.LIFETIME) ??
        null,
      purchase,
      restore,
    }),
    [isPro, loading, available, offering, purchase, restore]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  return ctx;
}
