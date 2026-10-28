import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from './theme';

export interface PanelProps {
  /** e.g. "YOUR WEALTH · YEAR 10" */
  eyebrow: string;
  value: string;
  valueColor?: string;
  children?: React.ReactNode;
  footnote?: string;
}

/** Bordered card used to frame a jar with its section label and headline value, matching the
 * "YOUR WEALTH · YEAR 10 / ₹10.95L" style panels in the design. */
export function Panel({ eyebrow, value, valueColor = colors.text, children, footnote }: PanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {children}
      {footnote != null && <Text style={styles.footnote}>{footnote}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  eyebrow: { color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  value: { fontSize: 24, fontWeight: '900', marginTop: 4, marginBottom: 8 },
  footnote: { color: colors.textFaint, fontSize: 11, marginTop: 8, textAlign: 'center' },
});
