import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from './theme';

export interface CustomValueKeypadProps {
  title: string;
  suffix: string;
  initialValue: number;
  min: number;
  max: number;
  allowDecimal?: boolean;
  /** Adds a "00" key, handy for typing large rupee amounts quickly. */
  doubleZero?: boolean;
  /** Optional live preview under the typed value, e.g. a compact "₹2.75 L" readout of a raw amount. */
  previewFormatter?: (value: number) => string;
  /** Shown instead of the default "Allowed: min–max" hint when provided. */
  hint?: string;
  onCancel: () => void;
  onSet: (value: number) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
const KEYS_DOUBLE_ZERO = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'];

/** Full-screen numeric entry used by the "Other"/"Custom" chips — type a precise value instead
 * of dragging a slider or stepping through presets. */
export function CustomValueKeypad({ title, suffix, initialValue, min, max, allowDecimal = true, doubleZero = false, previewFormatter, hint, onCancel, onSet }: CustomValueKeypadProps) {
  const [draft, setDraft] = useState(String(initialValue));

  const press = (key: string) => {
    if (key === '⌫') {
      setDraft((d) => d.slice(0, -1));
      return;
    }
    if (key === '.' && (!allowDecimal || draft.includes('.'))) return;
    if (draft === '0' && key !== '.') {
      setDraft(key.replace('00', '0'));
      return;
    }
    setDraft((d) => d + key);
  };

  const parsed = parseFloat(draft);
  const valid = !isNaN(parsed) && parsed >= min && parsed <= max;

  return (
    <View style={styles.overlay}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>
        {draft || '0'}
        <Text style={styles.suffix}> {suffix}</Text>
      </Text>
      {previewFormatter != null && !isNaN(parsed) && (
        <Text style={styles.preview}>= {previewFormatter(parsed)}</Text>
      )}
      <Text style={styles.hint}>{hint ?? `Allowed: ${min}${suffix} to ${max}${suffix}`}</Text>

      <View style={styles.pad}>
        {(doubleZero ? KEYS_DOUBLE_ZERO : KEYS).map((k) => (
          <Pressable key={k} style={styles.key} onPress={() => press(k)}>
            <Text style={styles.keyText}>{k}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.setButton, !valid && styles.setButtonDisabled]}
          disabled={!valid}
          onPress={() => valid && onSet(parsed)}
        >
          <Text style={styles.setText}>Set value</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, padding: 20, paddingTop: 80 },
  title: { color: colors.textMuted, fontSize: 12, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' },
  value: { color: colors.text, fontSize: 36, fontWeight: '900', textAlign: 'center', marginTop: 10 },
  suffix: { color: colors.textFaint, fontSize: 18, fontWeight: '700' },
  preview: { color: colors.gold, fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  hint: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 8, marginBottom: 32 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  key: { width: '30%', paddingVertical: 18, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center' },
  keyText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  cancelText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  setButton: { flex: 1.3, backgroundColor: colors.gold, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  setButtonDisabled: { opacity: 0.4 },
  setText: { color: '#1a1200', fontWeight: '900', fontSize: 14 },
});
