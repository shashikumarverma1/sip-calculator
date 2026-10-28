import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link } from 'expo-router';

const ROUTES: { href: '/sip' | '/emi' | '/lumpsum' | '/compare' | '/goal'; label: string }[] = [
  { href: '/sip', label: 'SIP Calculator' },
  { href: '/emi', label: 'EMI Calculator' },
  { href: '/lumpsum', label: 'Lumpsum' },
  { href: '/compare', label: 'Compare FD vs SIP' },
  { href: '/goal', label: 'Goal Mode' },
];

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>JarUp 🫙</Text>
      <Text style={styles.subtitle}>Watch your money grow, one ball at a time.</Text>
      <View style={styles.cards}>
        {ROUTES.map((r) => (
          <Link key={r.href} href={r.href} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.cardText}>{r.label}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1420', padding: 24, paddingTop: 48 },
  title: { color: '#fff', fontSize: 36, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: '#9aa5b1', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  cards: { gap: 14 },
  card: {
    backgroundColor: '#1a2434',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
