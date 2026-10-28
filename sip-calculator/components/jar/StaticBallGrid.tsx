import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/components/ui/theme';
import { decompose } from '@/lib/balls/decompose';

export type StaticBallColor = 'blue' | 'gold' | 'red';

export interface StaticBall {
  /** Visual size in px (diameter). */
  size: number;
  color: StaticBallColor;
  /** Label shown on the ball, e.g. "1L". Omit for small unlabeled balls. */
  label?: string;
}

const FILL: Record<StaticBallColor, string> = {
  blue: colors.blue,
  gold: colors.gold,
  red: colors.red,
};

/** Non-physics, non-animated jar: just lays out a fixed set of balls in a wrapping grid.
 * Used for the static-UI/design-review build — no calculation or animation runs here. */
export function StaticBallGrid({ width = 260, height = 220, balls }: { width?: number; height?: number; balls: StaticBall[] }) {
  return (
    <View style={[styles.jar, { width, height }]}>
      <View style={styles.ballsWrap}>
        {balls.map((b, i) => (
          <View
            key={i}
            style={[
              styles.ball,
              {
                width: b.size,
                height: b.size,
                borderRadius: b.size / 2,
                backgroundColor: FILL[b.color],
                marginLeft: i === 0 ? 0 : -b.size * 0.28,
              },
            ]}
          >
            {b.label != null && <Text style={styles.label}>{b.label}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

// 1K, 10K, 100K ("1L"), 1M ("10L") — matches the tiers this app's amounts actually reach.
const TIER_SIZE = [16, 20, 32, 38];
const TIER_LABEL: (string | undefined)[] = [undefined, undefined, '1L', '10L'];

/**
 * Builds the exact ball layout for a jar from its real amounts, so the count/size/label of every
 * ball is mathematically derived from the number shown (via the same digit-decomposition used by
 * the real ball engine) instead of hand-picked. Big balls come first so they land in the bottom
 * row (StaticBallGrid wraps bottom-up); same-tier balls across colors are grouped together.
 */
export function staticBallsFromAmounts(entries: { amount: number; color: StaticBallColor }[]): StaticBall[] {
  const decomposed = entries.map((e) => ({ color: e.color, counts: decompose(e.amount).counts }));
  const balls: StaticBall[] = [];
  for (let tier = TIER_SIZE.length - 1; tier >= 0; tier--) {
    for (const d of decomposed) {
      const count = d.counts[tier] ?? 0;
      for (let i = 0; i < count; i++) {
        balls.push({ size: TIER_SIZE[tier], color: d.color, label: TIER_LABEL[tier] });
      }
    }
  }
  return balls;
}

const styles = StyleSheet.create({
  jar: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 10,
  },
  ballsWrap: { flexDirection: 'row', flexWrap: 'wrap-reverse', justifyContent: 'center', alignItems: 'flex-end' },
  ball: { alignItems: 'center', justifyContent: 'center', marginBottom: 4, borderWidth: 2, borderColor: '#00000022' },
  label: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
