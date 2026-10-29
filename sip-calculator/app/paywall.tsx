import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';
import { colors } from '@/components/ui/theme';
import { Screen } from '@/components/ui/Screen';
import { fetchCurrentOffering, purchaseLifetimePackage, restorePurchases, hasProEntitlement } from '@/lib/purchases';
import { useProStore } from '@/store/proStore';

const FEATURES = [
  'Financial Freedom meter',
  'Compare jars, Goals, Step-up SIP',
  'Inflation mode (ghost balls)',
  'Gold vault, piggy bank and galaxy themes',
  'PDF reports, unlimited saved plans, no ads',
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const setFromCustomerInfo = useProStore((s) => s.setFromCustomerInfo);
  const isPro = useProStore((s) => s.isPro);
  const [lifetimePackage, setLifetimePackage] = useState<PurchasesPackage | null>(null);
  const [offeringLoading, setOfferingLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentOffering()
      .then((offering) => {
        if (cancelled) return;
        const pkg = offering?.lifetime ?? offering?.availablePackages.find((p) => p.packageType === 'LIFETIME') ?? offering?.availablePackages[0] ?? null;
        setLifetimePackage(pkg);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setOfferingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = async () => {
    if (!lifetimePackage || purchasing) return;
    setPurchasing(true);
    try {
      const info = await purchaseLifetimePackage(lifetimePackage);
      setFromCustomerInfo(info);
      router.back();
    } catch (e: any) {
      if (!e?.userCancelled) {
        Alert.alert('Purchase failed', e?.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const info = await restorePurchases();
      setFromCustomerInfo(info);
      const restored = hasProEntitlement(info);
      Alert.alert(
        restored ? 'Restored' : 'Nothing to restore',
        restored ? 'Your Pro access has been restored.' : 'No previous purchase was found for this account.'
      );
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const priceText = lifetimePackage?.product.priceString ?? '₹149';

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

      <View style={styles.priceCard}>
        <View>
          <Text style={styles.priceLabel}>Lifetime access</Text>
          <Text style={styles.priceSubtext}>One payment · no renewals</Text>
        </View>
        {offeringLoading ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.price}>{priceText}</Text>}
      </View>

      {isPro ? (
        <View style={[styles.unlockButton, styles.unlockButtonDone]}>
          <Text style={styles.unlockText}>✓ You already own Pro</Text>
        </View>
      ) : (
        <Pressable
          style={[styles.unlockButton, (!lifetimePackage || purchasing) && styles.unlockButtonDisabled]}
          disabled={!lifetimePackage || purchasing}
          onPress={unlock}
        >
          {purchasing ? <ActivityIndicator color="#1a1200" /> : <Text style={styles.unlockText}>Unlock Pro forever</Text>}
        </Pressable>
      )}

      <View style={styles.footerRow}>
        <Pressable onPress={restore} disabled={restoring}>
          <Text style={styles.footerLink}>{restoring ? 'Restoring…' : 'Restore purchases'}</Text>
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
  unlockButtonDisabled: { opacity: 0.5 },
  unlockButtonDone: { backgroundColor: colors.cardAlt },
  unlockText: { color: '#1a1200', fontWeight: '900', fontSize: 16 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 24 },
  footerLink: { color: colors.textFaint, fontSize: 11 },
  footerDivider: { color: colors.textFaint, fontSize: 11 },
});
