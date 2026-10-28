import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors } from './theme';

export interface HeaderProps {
  title: string;
  /** Small badge next to the title, e.g. "Inflation ON". */
  badge?: string;
  /** Right-side icon button (e.g. share). Omit for none. */
  rightIcon?: string;
  onRightPress?: () => void;
  onBack?: () => void;
}

export function Header({ title, badge, rightIcon, onRightPress, onBack }: HeaderProps) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.iconButton} onPress={onBack ?? (() => router.back())} hitSlop={10}>
        <Text style={styles.iconText}>‹</Text>
      </Pressable>
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {badge != null && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      {rightIcon != null ? (
        <Pressable style={styles.iconButton} onPress={onRightPress} hitSlop={10}>
          <Text style={styles.iconText}>{rightIcon}</Text>
        </Pressable>
      ) : (
        <View style={styles.iconButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 16 },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.text, fontSize: 22, fontWeight: '700' },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  badge: { backgroundColor: colors.green + '33', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: colors.green, fontSize: 10, fontWeight: '800' },
});
