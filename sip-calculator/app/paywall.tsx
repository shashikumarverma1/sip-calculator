import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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
        {/* Price is a placeholder until RevenueCat is wired up — it should show the
         * localized price from customerInfo at that point, not a hardcoded value. */}
        <Text style={styles.price}>₹149</Text>
      </View>

      <Pressable style={styles.unlockButton} onPress={() => router.back()}>
        <Text style={styles.unlockText}>Unlock Pro forever</Text>
      </Pressable>

      <View style={styles.footerRow}>
        <Text style={styles.footerLink}>Restore purchases</Text>
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
});
