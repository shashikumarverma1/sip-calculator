import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { colors } from '@/components/ui/theme';
import { ProBadge } from '@/components/ui/ProBadge';
import { Screen } from '@/components/ui/Screen';

interface CalcTile {
  href: '/sip' | '/emi' | '/lumpsum' | '/compare' | '/goal' | '/freedom';
  title: string;
  subtitle: string;
  dots: string[];
  pro?: boolean;
}

const TILES: CalcTile[] = [
  { href: '/sip', title: 'SIP', subtitle: 'Monthly investing, year by year', dots: [colors.blue, colors.gold] },
  { href: '/emi', title: 'EMI / Loan', subtitle: 'See the real interest you pay', dots: [colors.blue, colors.red] },
  { href: '/lumpsum', title: 'Lumpsum', subtitle: 'One drop, growing every year', dots: [colors.blue, colors.gold] },
  { href: '/freedom', title: 'Freedom', subtitle: 'How long your money lasts', dots: [colors.gold, colors.red], pro: true },
  { href: '/compare', title: 'Compare', subtitle: 'FD vs SIP jar race', dots: [colors.blue, colors.green], pro: true },
  { href: '/goal', title: 'Goal', subtitle: 'House, car, wedding target', dots: [colors.gold, colors.gold], pro: true },
];

export default function Home() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>🫙 JarUp</Text>
        <Pressable style={styles.goProButton} onPress={() => router.push('/paywall')}>
          <Text style={styles.goProText}>Go Pro</Text>
        </Pressable>
      </View>

      <Pressable style={styles.hero} onPress={() => router.push('/sip')}>
        <Text style={styles.heroEyebrow}>EVERY BALL IS REAL MONEY</Text>
        <Text style={styles.heroTitle}>Watch your SIP{'\n'}fill the jar</Text>
        <Text style={styles.heroCta}>Start with SIP →</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Calculators</Text>
      <View style={styles.grid}>
        {TILES.map((t) => (
          <Link key={t.href} href={t.href} asChild>
            <Pressable style={styles.tile}>
              {t.pro && <ProBadge />}
              <View style={styles.dotsRow}>
                {t.dots.map((c, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: c, marginLeft: i === 0 ? 0 : -8 }]} />
                ))}
              </View>
              <Text style={styles.tileTitle}>{t.title}</Text>
              <Text style={styles.tileSubtitle}>{t.subtitle}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <Text style={styles.footer}>✓ Works offline · No subscription · Pay once</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  brand: { color: colors.text, fontSize: 20, fontWeight: '900' },
  goProButton: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  goProText: { color: colors.gold, fontWeight: '800', fontSize: 12 },
  hero: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
  },
  heroEyebrow: { color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  heroTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 10, lineHeight: 30 },
  heroCta: { color: colors.link, fontSize: 14, fontWeight: '700', marginTop: 14 },
  sectionLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
  },
  dotsRow: { flexDirection: 'row', marginBottom: 10 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.card },
  tileTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  tileSubtitle: { color: colors.textFaint, fontSize: 11, marginTop: 3, lineHeight: 15 },
  footer: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 28 },
});
