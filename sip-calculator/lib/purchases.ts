import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';

/**
 * Public RevenueCat SDK key, read from .env (EXPO_PUBLIC_* vars are inlined at build time —
 * see https://docs.expo.dev/guides/environment-variables/). RevenueCat issues a separate key per
 * platform (and per app store), so set both EXPO_PUBLIC_REVENUECAT_API_KEY_IOS and
 * EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID rather than reusing one cross-platform.
 */
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '';

/** Entitlement identifier configured in the RevenueCat dashboard for lifetime Pro access. */
export const PRO_ENTITLEMENT_ID = 'pro';

let configured = false;

/** Configures the RevenueCat SDK once per app launch. Safe to call more than once. */
export function configurePurchases(): void {
  if (configured) return;
  configured = true;
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  if (!apiKey) {
    console.warn('[purchases] Missing RevenueCat API key — set EXPO_PUBLIC_REVENUECAT_API_KEY_IOS / _ANDROID in .env');
    return;
  }
  Purchases.configure({ apiKey });
}

export function hasProEntitlement(info: CustomerInfo): boolean {
  return info.entitlements.active[PRO_ENTITLEMENT_ID] != null;
}

export async function fetchCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

/** The current offering's packages — expected to contain one non-subscription "lifetime" package. */
export async function fetchCurrentOffering(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchaseLifetimePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}
