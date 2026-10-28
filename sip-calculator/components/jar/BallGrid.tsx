import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/components/ui/theme';
import { Ball, Family, Tier } from '@/lib/balls/types';

const FAMILY_COLOR: Record<Family, string> = {
  principal: colors.blue,
  returns: colors.gold,
  expense: colors.red,
  interest: colors.red,
};

const TIER_SIZE: Record<Tier, number> = {
  1_000: 18,
  10_000: 24,
  100_000: 32,
  1_000_000: 38,
  10_000_000: 44,
  100_000_000: 50,
};

const TIER_LABEL: Record<Tier, string | undefined> = {
  1_000: '1K',
  10_000: '10K',
  100_000: '1L',
  1_000_000: '10L',
  10_000_000: '1Cr',
  100_000_000: '10Cr',
};

export { FAMILY_COLOR, TIER_SIZE, TIER_LABEL };

export interface PartialBall {
  family: Family;
  /** Remainder below ₹1K (0–999) that doesn't round into a whole ball on its own. */
  amount: number;
}

export interface BallGridProps {
  width?: number;
  height?: number;
  balls: Ball[];
  /** Sub-₹1K remainders per family, rendered as faint partial balls so the sum of everything
   * drawn always equals the real total — otherwise amounts not divisible by 1,000 would be
   * short by their remainder with no ball accounting for it. */
  partials?: PartialBall[];
  onBallPress?: (ball: Ball) => void;
  hint?: string;
}

const MIN_SCALE = 0.7;
const MAX_SCALE = 3.5;
/** Fraction of the box's pixel area the balls should fill — under 1 to leave breathing room
 * since circles (and the flex-wrap layout) never tile edge-to-edge. */
const FILL_FACTOR = 0.55;

/** Scale factor so this exact set of balls visually fills the box: few balls render bigger,
 * many balls render smaller, and the final/fullest set fills the jar edge-to-edge instead of
 * floating in empty space at a fixed per-tier size. */
function computeScale(ballCount: number, partialCount: number, baseArea: number, width: number, height: number): number {
  if (ballCount + partialCount === 0) return 1;
  const boxArea = width * height * FILL_FACTOR;
  const scale = Math.sqrt(boxArea / baseArea);
  return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
}

/** Interactive, non-physics jar: balls laid out biggest-first (so they anchor the bottom row),
 * each individually tappable. Driven by real Ball[] data from /lib/balls so every ball carries
 * its true tier, value, family and the year it was added. Ball size scales dynamically with the
 * current ball count so the jar always looks appropriately full, not just densely packed. */
export function BallGrid({ width = 260, height = 220, balls, partials, onBallPress, hint }: BallGridProps) {
  const sorted = [...balls].sort((a, b) => b.tier - a.tier);
  const visiblePartials = (partials ?? []).filter((p) => p.amount > 0);
  const baseArea =
    balls.reduce((sum, b) => sum + Math.PI * (TIER_SIZE[b.tier] / 2) ** 2, 0) +
    visiblePartials.reduce((sum) => sum + Math.PI * (TIER_SIZE[1_000] / 2) ** 2, 0);
  const scale = computeScale(balls.length, visiblePartials.length, baseArea, width, height);
  return (
    <View style={[styles.jar, { width, height }]}>
      {hint != null && (
        <View style={styles.hintBadge}>
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      )}
      <View style={styles.ballsWrap}>
        {sorted.map((b, i) => {
          const size = TIER_SIZE[b.tier] * scale;
          return (
            <Pressable
              key={b.id}
              onPress={() => onBallPress?.(b)}
              style={[
                styles.ball,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: FAMILY_COLOR[b.family],
                  marginLeft: i === 0 ? 0 : -size * 0.28,
                },
              ]}
            >
              <Text style={[styles.label, { fontSize: Math.min(Math.max(size * 0.32, 7), 14) }]} numberOfLines={1}>
                {TIER_LABEL[b.tier]}
              </Text>
            </Pressable>
          );
        })}
        {visiblePartials.map((p, i) => {
          const size = TIER_SIZE[1_000] * scale;
          const fill = p.amount / 1000;
          return (
            <View
              key={`partial-${p.family}-${i}`}
              style={[
                styles.ball,
                styles.partialBall,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: FAMILY_COLOR[p.family],
                  opacity: 0.3 + fill * 0.5,
                  marginLeft: sorted.length === 0 && i === 0 ? 0 : -size * 0.28,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
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
  hintBadge: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: colors.bg + 'cc',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  hintText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  ballsWrap: { flexDirection: 'row', flexWrap: 'wrap-reverse', justifyContent: 'center', alignItems: 'flex-end' },
  ball: { alignItems: 'center', justifyContent: 'center', marginBottom: 4, borderWidth: 2, borderColor: '#00000022' },
  partialBall: { borderStyle: 'dashed' },
  label: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
