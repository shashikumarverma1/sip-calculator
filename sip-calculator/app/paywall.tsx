import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSubscription } from '@/lib/subscription/SubscriptionContext';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/components/ui/theme';
import { Screen } from '@/components/ui/Screen';
import * as WebBrowser from 'expo-web-browser';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/lib/legal';

/** One jar ball, bobbing on a loop. `delay` staggers the three balls. */
function BobbingBall({ color, delay, overlap }: { color: string; delay: number; overlap: boolean }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(withTiming(-8, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true)
    );
  }, [delay, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, overlap && { marginLeft: -10 }, style]} />;
}

const FEATURES = [
  'Financial Freedom meter: how long your money lasts',
  'Compare jar race: FD vs SIP side by side',
  'EMI prepayment planner',
  'Goal planner with save & track',
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { isPro, loading, available, lifetimePackage, priceString, offeringLoading, reloadOfferings, purchase, restore } =
    useSubscription();
  const [busy, setBusy] = useState<string | null>(null);

  // One close path, so a purchase and the live isPro update can't both pop the screen.
  const closed = useRef(false);
  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  // Someone who already owns Pro never sees the offer: close as soon as the status is known.
  useEffect(() => {
    if (!loading && isPro && busy === null) close();
  }, [loading, isPro, busy, close]);

  // purchase() re-checks the exact status first and resolves true without charging if already Pro.
  const buy = async (pkg: PurchasesPackage) => {
    setBusy(pkg.identifier);
    const unlocked = await purchase(pkg);
    setBusy(null);
    if (unlocked) close();
  };

  const onRestore = async () => {
    setBusy('restore');
    const unlocked = await restore();
    setBusy(null);
    if (unlocked) close();
  };

  // Don't render the offer until the launch status check has finished.
  if (loading || isPro) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <Screen contentContainerStyle={{ padding: 20, flexGrow: 1 }}>
      <Pressable style={[styles.closeButton, { top: insets.top + 4 }]} onPress={close} hitSlop={10}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.dotsRow}>
          <BobbingBall color={colors.gold} delay={0} overlap={false} />
          <BobbingBall color={colors.blue} delay={180} overlap />
          <BobbingBall color={colors.gold} delay={360} overlap />
        </View>
        <Text style={styles.brand}>JarUp Pro</Text>
        <Text style={styles.tagline}>Pay once. Yours forever.</Text>
      </View>

      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f} style={styles.featureRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {!lifetimePackage ? (
        <View style={styles.packageBlock}>
          <Text style={styles.emptyText}>
            {!available
              ? 'Purchases are not available on this device.'
              : offeringLoading
                ? 'Loading price…'
                : "Couldn't load the price. Check your connection and try again."}
          </Text>
          <Pressable style={[styles.unlockButton, styles.disabled]} disabled>
            {offeringLoading ? <ActivityIndicator color="#1a1200" /> : <Text style={styles.unlockText}>Unlock Lifetime</Text>}
          </Pressable>
          {available && !offeringLoading && (
            <Pressable style={styles.retryButton} onPress={reloadOfferings} hitSlop={8}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.packageBlock}>
          <View style={styles.priceCard}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.priceLabel}>Lifetime access</Text>
              <Text style={styles.priceSubtext}>One payment · no renewals</Text>
            </View>
            <Text style={styles.price}>{priceString}</Text>
          </View>
          <Pressable
            style={[styles.unlockButton, busy !== null && styles.disabled]}
            disabled={busy !== null}
            onPress={() => buy(lifetimePackage)}
          >
            {busy === lifetimePackage.identifier ? (
              <ActivityIndicator color="#1a1200" />
            ) : (
              <Text style={styles.unlockText}>Unlock Lifetime – {priceString}</Text>
            )}
          </Pressable>
          <Text style={styles.oneTimeText}>One-time payment. No subscription.</Text>
        </View>
      )}

      <View style={styles.footerRow}>
        <Pressable onPress={onRestore} disabled={busy !== null || !available} hitSlop={8}>
          <Text style={styles.footerLink}>{busy === 'restore' ? 'Restoring…' : 'Restore purchases'}</Text>
        </Pressable>
        <Text style={styles.footerDivider}>·</Text>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(TERMS_OF_USE_URL)} hitSlop={8} accessibilityRole="link">
          <Text style={styles.footerLink}>Terms of Use</Text>
        </Pressable>
        <Text style={styles.footerDivider}>·</Text>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)} hitSlop={8} accessibilityRole="link">
          <Text style={styles.footerLink}>Privacy Policy</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: { alignItems: 'center', justifyContent: 'center' },
  closeButton: { position: 'absolute', right: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  closeText: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  hero: { alignItems: 'center', marginTop: 16, marginBottom: 28 },
  dotsRow: { flexDirection: 'row', marginBottom: 16 },
  dot: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: colors.bg },
  brand: { color: colors.text, fontSize: 22, fontWeight: '900' },
  tagline: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  features: { gap: 12, marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  check: { color: colors.green, fontSize: 14, fontWeight: '900', marginTop: 1 },
  featureText: { color: colors.text, fontSize: 14, flex: 1, lineHeight: 19 },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.gold + '55',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  priceLabel: { color: colors.text, fontWeight: '800', fontSize: 14 },
  priceSubtext: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  price: { color: colors.gold, fontSize: 22, fontWeight: '900' },
  unlockButton: { backgroundColor: colors.gold, borderRadius: 20, paddingVertical: 18, alignItems: 'center' },
  unlockText: { color: '#1a1200', fontWeight: '900', fontSize: 16 },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 24 },
  footerLink: { color: colors.textFaint, fontSize: 11 },
  footerDivider: { color: colors.textFaint, fontSize: 11 },
  packageBlock: { marginBottom: 20 },
  disabled: { opacity: 0.6 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  oneTimeText: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 10 },
  retryButton: { alignSelf: 'center', marginTop: 14, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  retryText: { color: colors.link, fontWeight: '800', fontSize: 13 },
});
