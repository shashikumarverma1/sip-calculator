/**
 * Hidden RevenueCat diagnostics. Open it by long-pressing the "🫙 JarUp" title on Home for 1.5 s
 * (works in release builds, so it can be used on a Play install), or via jarup://debug in dev.
 * Read-only apart from "Restore now", which does the same thing as the paywall's restore.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Share, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/components/ui/theme';
import {
  IS_TEST_STORE_KEY,
  PRO_ENTITLEMENT_ID,
  RC_LOG_LEVEL_LABEL,
  hasPro,
  useSubscription,
} from '@/lib/subscription/SubscriptionContext';

const json = (v: unknown) => JSON.stringify(v, null, 2);

export default function RevenueCatDebugScreen() {
  const { available, isPro, loading } = useSubscription();
  const [appUserId, setAppUserId] = useState<string>('…');
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!available) return;
    setError(null);
    try {
      const [id, ci] = await Promise.all([Purchases.getAppUserID(), Purchases.getCustomerInfo()]);
      setAppUserId(id);
      setInfo(ci);
    } catch (e) {
      console.warn('[RC] debug refresh failed', e);
      setError(json(e));
    }
  }, [available]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const restoreNow = async () => {
    setBusy(true);
    try {
      const restored = await Purchases.restorePurchases();
      setRestoreResult(json(restored));
      setInfo(restored);
      setAppUserId(await Purchases.getAppUserID());
    } catch (e) {
      console.warn('[RC] debug restore failed', e);
      setRestoreResult(`ERROR\n${json(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const sections: [string, string][] = [
    ['App user ID', appUserId],
    ['Platform', `${Platform.OS} ${Platform.Version}`],
    ['RevenueCat log level', RC_LOG_LEVEL_LABEL],
    ['API key type', !available ? 'not configured' : IS_TEST_STORE_KEY ? 'Test Store (test_…)' : 'Store key (goog_…)'],
    ['App state', `isPro=${isPro} loading=${loading} · expected entitlement "${PRO_ENTITLEMENT_ID}"`],
    ['Pro per this customerInfo', info ? String(hasPro(info)) : '…'],
    ['entitlements.active', info ? json(info.entitlements.active) : '…'],
    ['entitlements.all', info ? json(info.entitlements.all) : '…'],
    ['allPurchasedProductIdentifiers', info ? json(info.allPurchasedProductIdentifiers) : '…'],
    ['nonSubscriptionTransactions', info ? json(info.nonSubscriptionTransactions) : '…'],
    ['originalAppUserId', info?.originalAppUserId ?? '…'],
    ['requestDate', info?.requestDate ?? '…'],
  ];
  if (restoreResult) sections.push(['Raw restore result', restoreResult]);
  if (error) sections.push(['Error', error]);

  const allText = sections.map(([k, v]) => `## ${k}\n${v}`).join('\n\n');

  const copyAll = async () => {
    try {
      // Loaded lazily: a dev client built before expo-clipboard was added has no native module.
      const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      await Clipboard.setStringAsync(allText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      await Share.share({ message: allText });
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>RevenueCat debug</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.buttons}>
        <Pressable style={[styles.button, busy && styles.disabled]} onPress={restoreNow} disabled={busy || !available}>
          {busy ? <ActivityIndicator color="#1a1200" /> : <Text style={styles.buttonText}>Restore now</Text>}
        </Pressable>
        <Pressable style={styles.buttonAlt} onPress={refresh} disabled={!available}>
          <Text style={styles.buttonAltText}>Refresh</Text>
        </Pressable>
        <Pressable style={styles.buttonAlt} onPress={copyAll}>
          <Text style={styles.buttonAltText}>{copied ? 'Copied ✓' : 'Copy all'}</Text>
        </Pressable>
      </View>

      {sections.map(([k, v]) => (
        <View key={k} style={styles.section}>
          <Text style={styles.label}>{k}</Text>
          <Text style={styles.value} selectable>
            {v}
          </Text>
        </View>
      ))}
    </Screen>
  );
}

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  close: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  button: { flex: 1, backgroundColor: colors.gold, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#1a1200', fontWeight: '900' },
  buttonAlt: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonAltText: { color: colors.text, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  section: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 10 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  value: { color: colors.text, fontSize: 12, fontFamily: mono },
});
