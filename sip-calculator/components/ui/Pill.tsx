import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from './theme';

export interface PillProps {
  label: string;
  value: string;
  onPress?: () => void;
}

/** Small rounded input-summary badge, e.g. "Monthly ₹5,000". Tappable to go back and edit. */
export function Pill({ label, value, onPress }: PillProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={styles.pill} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </Wrapper>
  );
}

export function PillRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  label: { color: colors.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 2 },
});
