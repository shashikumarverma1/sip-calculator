import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from './theme';

export function ProBadge() {
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
