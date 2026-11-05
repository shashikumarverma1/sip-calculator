import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSubscription } from '@/lib/subscription/SubscriptionContext';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/components/ui/theme';
import { Screen } from '@/components/ui/Screen';

const FEATURES = [
  'Financial Freedom meter',
  'Compare jars, Goals, Step-up SIP',
  'Inflation mode (ghost balls)',
  'Gold vault, piggy bank and galaxy themes',
  'PDF reports, unlimited saved plans, no ads',
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { isPro, loading, available, lifetimePackage, purchase, restore } = useSubscription();
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (pkg: PurchasesPackage) => {
    setBusy(pkg.identifier);
    const unlocked = await purchase(pkg);
    setBusy(null);
    if (unlocked) router.back();
  };

  const onRestore = async () => {
    setBusy('restore');
    const unlocked = await restore();
    setBusy(null);
    if (unlocked) router.back();
  };

  return (
    <Screen contentContainerStyle={{ padding: 20, flexGrow: 1 }}>
      <Pressable style={[styles.closeButton, { top: insets.top + 4 }]} onPress={() => router.back()} hitSlop={10}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.dotsRow}>
          <View style={[styles.dot, { backgroundColor: colors.gold }]} />
          <View style={[styles.dot, { backgroundColor: colors.blue, marginLeft: -10 }]} />
          <View style={[styles.dot, { backgroundColor: colors.gold, marginLeft: -10 }]} />
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

      {isPro ? (
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>✓ JarUp Pro is active on this account</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator color={colors.gold} style={{ marginVertical: 24 }} />
      ) : !lifetimePackage ? (
        <Text style={styles.emptyText}>
          {available ? 'Pro is not available right now. Please try again later.' : 'Purchases are not available on this device.'}
        </Text>
      ) : (
        <View style={styles.packageBlock}>
          <View style={styles.priceCard}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.priceLabel}>Lifetime access</Text>
              <Text style={styles.priceSubtext}>One payment · no renewals</Text>
            </View>
            <Text style={styles.price}>{lifetimePackage.product.priceString}</Text>
          </View>
          <Pressable
            style={[styles.unlockButton, busy !== null && styles.disabled]}
            disabled={busy !== null}
            onPress={() => buy(lifetimePackage)}
          >
            {busy === lifetimePackage.identifier ? (
              <ActivityIndicator color="#1a1200" />
            ) : (
              <Text style={styles.unlockText}>Unlock Pro forever · {lifetimePackage.product.priceString}</Text>
            )}
          </Pressable>
        </View>
      )}

      <View style={styles.footerRow}>
        <Pressable onPress={onRestore} disabled={busy !== null || !available} hitSlop={8}>
          <Text style={styles.footerLink}>{busy === 'restore' ? 'Restoring…' : 'Restore purchases'}</Text>
        </Pressable>
        <Text style={styles.footerDivider}>·</Text>
        <Text style={styles.footerLink}>Terms</Text>
        <Text style={styles.footerDivider}>·</Text>
        <Text style={styles.footerLink}>Privacy</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 24 },
  footerLink: { color: colors.textFaint, fontSize: 11 },
  footerDivider: { color: colors.textFaint, fontSize: 11 },
  packageBlock: { marginBottom: 20 },
  disabled: { opacity: 0.6 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginVertical: 24 },
});
