import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

/**
 * Entitlement identifier from RevenueCat → Product catalog → Entitlements. It is NOT "pro": the
 * RevenueCat setup wizard created it as `com_sipcalculator_app_pro` (confirmed from device logs).
 */
export const PRO_ENTITLEMENT_ID = 'com_sipcalculator_app_pro';

// EXPO_PUBLIC_* vars are inlined at bundle time, so each must be referenced literally.
const API_KEY = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;
const KEY_ENV_NAME = Platform.OS === 'ios' ? 'EXPO_PUBLIC_RC_IOS_KEY' : 'EXPO_PUBLIC_RC_ANDROID_KEY';
/** RevenueCat Test Store keys (test_…) work on any platform; store keys (goog_… / appl_…) only on their platform. */
export const IS_TEST_STORE_KEY = !!API_KEY?.startsWith('test_');
/** Only a real store key for this platform is accepted. Placeholders (appl_XXXX, REPLACE_WITH_…) and
 * Test Store keys are rejected, so they can never reach a release build. */
const EXPECTED_PREFIX = Platform.OS === 'ios' ? 'appl_' : 'goog_';
function keyProblem(key: string | undefined): string | null {
  if (!key) return 'not set';
  if (key.startsWith('test_')) return 'is a Test Store key (test_…), which must not be used';
  if (!key.startsWith(EXPECTED_PREFIX) || /XXXX|REPLACE/i.test(key)) return 'is still a placeholder';
  return null;
}

/** Last known Pro status, so Pro users don't see locked UI while the launch check runs. */
const PRO_CACHE_KEY = 'jarup.isPro';
const writeProCache = (pro: boolean) =>
  AsyncStorage.setItem(PRO_CACHE_KEY, pro ? '1' : '0').catch((e) => console.warn('[RC] cache write failed', e));
/** What the debug screen reports. In release builds the SDK keeps its default level. */
export const RC_LOG_LEVEL_LABEL = __DEV__ ? 'DEBUG' : 'default (INFO)';

const TAG = '[RC]';

/**
 * One clear line saying whether the user is Pro and why. Logged in every build (it shows up in
 * `adb logcat` under ReactNativeJS for release installs too) and contains no personal data beyond
 * RevenueCat's random anonymous id.
 */
function logProStatus(source: string, info: CustomerInfo | null, pro: boolean) {
  const active = info ? Object.keys(info.entitlements.active) : [];
  console.log(
    `${TAG} User is ${pro ? 'PRO ✅' : 'FREE ❌'} (${source})` +
      ` | entitlements=${active.length ? active.join(',') : 'none'}` +
      ` | products=${info?.allPurchasedProductIdentifiers.join(',') || 'none'}` +
      ` | user=${info?.originalAppUserId ?? 'unknown'}`
  );
}

// Kept on globalThis so a Fast Refresh re-evaluating this module can't configure the SDK twice.
const rcGlobal = globalThis as { __rcConfigured?: boolean; __rcLaunchRestoreDone?: boolean };

/**
 * Configures RevenueCat exactly once per app process, before any other Purchases call, with no
 * appUserID (anonymous user). Returns false where billing isn't available (web, iOS with a Play
 * key, or no key), so the app keeps working as free.
 */
function configurePurchases(): boolean {
  if (rcGlobal.__rcConfigured) return true;
  const supported = Platform.OS === 'android' || Platform.OS === 'ios';
  if (!supported) return false;
  const problem = keyProblem(API_KEY);
  if (problem || !API_KEY) {
    // Warn in every build: on iOS this is expected until the App Store key is ready.
    console.warn(`${TAG} Purchases disabled on ${Platform.OS}: ${KEY_ENV_NAME} ${problem}.`);
    return false;
  }
  try {
    // setLogLevel is a static setting and is meant to be set before configure.
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: API_KEY });
    rcGlobal.__rcConfigured = true;
    return true;
  } catch (e) {
    console.warn(`${TAG} configure failed`, e);
    return false;
  }
}

/** Pro = exactly the Pro entitlement is active. */
export const hasPro = (info: CustomerInfo) => !!info.entitlements.active[PRO_ENTITLEMENT_ID];

function logCustomerInfo(label: string, info: CustomerInfo) {
  if (!__DEV__) return;
  console.log(`${TAG} ${label}`, {
    appUserId: info.originalAppUserId,
    activeEntitlements: Object.keys(info.entitlements.active),
    purchasedProducts: info.allPurchasedProductIdentifiers,
    nonSubscriptionTransactions: info.nonSubscriptionTransactions.length,
  });
}

const asRcError = (e: unknown) => e as Partial<PurchasesError> | undefined;

function showError(title: string, e: unknown) {
  const err = asRcError(e);
  if (err?.userCancelled || err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return;
  Alert.alert(title, err?.message || 'Something went wrong. Please try again.');
}

interface SubscriptionValue {
  isPro: boolean;
  /** True until the whole launch flow (customer info + silent restore) has finished. */
  loading: boolean;
  /** False when RevenueCat isn't configured on this platform/build. */
  available: boolean;
  offering: PurchasesOffering | null;
  packages: PurchasesPackage[];
  /** The one-time "Lifetime" package that unlocks Pro forever, or null if the offering has none. */
  lifetimePackage: PurchasesPackage | null;
  /** Store-localized price of the lifetime package (e.g. "₹499.00"), or null until loaded. */
  priceString: string | null;
  /** True while offerings are being (re)loaded. */
  offeringLoading: boolean;
  /** Fetches offerings again (paywall "Retry"). */
  reloadOfferings: () => Promise<void>;
  /** Fresh check against RevenueCat (not the cached state); also updates isPro. */
  getExactProStatus: () => Promise<boolean>;
  /** Resolves with isPro once the launch flow has finished (immediately if it already has). */
  whenReady: () => Promise<boolean>;
  /** Resolves true when the user ends up Pro (bought now, or already owned). Cancel → false, silently. */
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
  const [offeringLoading, setOfferingLoading] = useState(available);
  // True once isPro comes from a real CustomerInfo; from then on the cache is never read, only written.
  const verified = useRef(false);
  const cachedPro = useRef(false);

  // Cold start: trust the last known status until RevenueCat answers, so Pro users see no locks.
  useEffect(() => {
    if (!available) return;
    AsyncStorage.getItem(PRO_CACHE_KEY)
      .then((v) => {
        cachedPro.current = v === '1';
        if (v === '1' && !verified.current) setIsPro(true);
      })
      .catch(() => {});
  }, [available]);

  // Persist every verified change (purchase, restore, refund, launch check).
  useEffect(() => {
    if (verified.current) writeProCache(isPro);
  }, [isPro]);

  const setVerifiedPro = useCallback((pro: boolean) => {
    verified.current = true;
    setIsPro(pro);
  }, []);

  const reloadOfferings = useCallback(async () => {
    if (!available) return;
    setOfferingLoading(true);
    try {
      const offerings = await Purchases.getOfferings();
      setOffering(offerings.current);
    } catch (e) {
      console.warn(`${TAG} getOfferings failed`, e);
    } finally {
      setOfferingLoading(false);
    }
  }, [available]);

  // Settles once with the launch result, so taps made while loading can wait for it.
  const ready = useRef<{ promise: Promise<boolean>; resolve: (pro: boolean) => void } | null>(null);
  if (!ready.current) {
    let resolve!: (pro: boolean) => void;
    const promise = new Promise<boolean>((r) => (resolve = r));
    ready.current = { promise, resolve };
    if (!available) resolve(false);
  }

  useEffect(() => {
    if (!available) return;
    let active = true;

    // d) Live updates (purchases, restores, refunds), removed on cleanup.
    const onUpdate = (info: CustomerInfo) => {
      logCustomerInfo('customerInfo update', info);
      const pro = hasPro(info);
      logProStatus('live update', info, pro);
      setVerifiedPro(pro);
    };
    Purchases.addCustomerInfoUpdateListener(onUpdate);

    (async () => {
      let pro = false;
      let finalInfo: CustomerInfo | null = null;
      let source = 'launch: customerInfo';
      console.log(`${TAG} Launch: checking Pro status…`);
      try {
        // a) configure (done above) → getCustomerInfo → check the entitlement.
        const info = await Purchases.getCustomerInfo();
        logCustomerInfo('on launch', info);
        pro = hasPro(info);
        finalInfo = info;

        // b) Not Pro: a reinstall starts a new anonymous user, so silently restore once per session
        // to pull a Google Play purchase back onto this user. On Android this shows no UI.
        if (!pro && Platform.OS === 'android' && !rcGlobal.__rcLaunchRestoreDone) {
          rcGlobal.__rcLaunchRestoreDone = true;
          try {
            const restored = await Purchases.restorePurchases();
            logCustomerInfo('after launch restore', restored);
            pro = hasPro(restored);
            finalInfo = restored;
            source = 'launch: after silent restore';
          } catch (e) {
            console.warn(`${TAG} launch restore failed`, e);
          }
        }
      } catch (e) {
        console.warn(`${TAG} getCustomerInfo failed`, e);
      }

      if (active) await reloadOfferings();

      // RevenueCat unreachable (and no SDK cache): keep the last known status rather than locking
      // a paying user out while offline.
      if (!finalInfo) {
        pro = cachedPro.current;
        source = 'launch: offline, using cached status';
      }
      logProStatus(source, finalInfo, pro);

      // c) Only now is the status known: release the loading gate.
      if (active) {
        if (finalInfo) setVerifiedPro(pro);
        else setIsPro(pro);
        setLoading(false);
      }
      ready.current?.resolve(pro);
    })();

    return () => {
      active = false;
      Purchases.removeCustomerInfoUpdateListener(onUpdate);
    };
  }, [available, reloadOfferings, setVerifiedPro]);

  const getExactProStatus = useCallback(async () => {
    if (!available) return false;
    try {
      const info = await Purchases.getCustomerInfo();
      const pro = hasPro(info);
      setVerifiedPro(pro);
      return pro;
    } catch (e) {
      console.warn(`${TAG} getExactProStatus failed`, e);
      return false;
    }
  }, [available, setVerifiedPro]);

  const whenReady = useCallback(() => ready.current!.promise, []);

  const restore = useCallback(async () => {
    if (!available) return false;
    try {
      const info = await Purchases.restorePurchases();
      logCustomerInfo('after restore', info);
      const pro = hasPro(info);
      setVerifiedPro(pro);
      if (!pro)
        Alert.alert(
          'Nothing to restore',
          `No previous Pro purchase was found for this ${Platform.OS === 'ios' ? 'Apple ID' : 'Google account'}.`
        );
      return pro;
    } catch (e) {
      console.warn(`${TAG} restore failed`, e);
      showError('Restore failed', e);
      return false;
    }
  }, [available, setVerifiedPro]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      if (!available) return false;

      // Safety: never charge someone who already owns Pro (e.g. status was stale).
      if (await getExactProStatus()) return true;

      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        logCustomerInfo('after purchase', customerInfo);
        const pro = hasPro(customerInfo);
        setVerifiedPro(pro);
        if (!pro) {
          // Charged, but no entitlement granted: the product isn't attached to an entitlement.
          Alert.alert(
            'Purchase received',
            __DEV__
              ? `Paid for "${pkg.product.identifier}", but it didn't grant any entitlement. ` +
                  `In RevenueCat → Product catalog → Entitlements, attach "${pkg.product.identifier}" to your entitlement.`
              : 'Your payment went through but Pro is not active yet. Tap "Restore purchases" or try again shortly.'
          );
        }
        return pro;
      } catch (e) {
        // Google Play says this account already owns it: restore instead of showing an error.
        if (asRcError(e)?.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
          console.warn(`${TAG} already purchased, restoring`);
          return restore();
        }
        console.warn(`${TAG} purchase failed`, e);
        showError('Purchase failed', e);
        return false;
      }
    },
    [available, getExactProStatus, restore, setVerifiedPro]
  );

  const lifetime =
    offering?.lifetime ?? offering?.availablePackages.find((p) => p.packageType === PACKAGE_TYPE.LIFETIME) ?? null;

  const value = useMemo<SubscriptionValue>(
    () => ({
      isPro,
      loading,
      available,
      offering,
      packages: offering?.availablePackages ?? [],
      lifetimePackage: lifetime,
      priceString: lifetime?.product.priceString ?? null,
      offeringLoading,
      reloadOfferings,
      getExactProStatus,
      whenReady,
      purchase,
      restore,
    }),
    [isPro, loading, available, offering, lifetime, offeringLoading, reloadOfferings, getExactProStatus, whenReady, purchase, restore]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  return ctx;
}
