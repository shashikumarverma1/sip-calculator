import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from './theme';
import { useSubscription } from '@/lib/subscription/SubscriptionContext';

/** Gold "PRO" corner badge. Shown only once we know the user isn't Pro (hidden while loading). */
export function ProBadge() {
  const { isPro, loading } = useSubscription();
  if (loading || isPro) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: { color: '#1a1200', fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
});
