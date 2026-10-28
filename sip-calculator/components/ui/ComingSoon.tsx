import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Screen } from './Screen';
import { Header } from './Header';
import { colors } from './theme';

export function ComingSoon({ title }: { title: string }) {
  return (
    <Screen contentContainerStyle={{ flexGrow: 1 }}>
      <Header title={title} />
      <Text style={styles.emoji}>🚧</Text>
      <Text style={styles.heading}>Coming soon</Text>
      <Text style={styles.subheading}>We're still building the {title} jar. Check back soon.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 40, textAlign: 'center', marginTop: 80 },
  heading: { color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 16 },
  subheading: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
});
