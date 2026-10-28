import React from 'react';
import { ScrollView, StyleSheet, ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './theme';

/** Scrollable screen body that pads for the real safe-area inset (notch/status bar) instead of a
 * guessed constant, so the header/pills never collide with system UI. */
export function Screen({ children, contentContainerStyle, ...rest }: ScrollViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        { padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
        contentContainerStyle,
      ]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
