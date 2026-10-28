import React from 'react';
import { Circle, Group, BlurMask, Text as SkiaText, matchFont } from '@shopify/react-native-skia';
import { TIERS, type BallColor } from './PhysicsWorld';

export interface BallProps {
  x: number;
  y: number;
  tier: number;
  color: BallColor;
}

const FILL: Record<BallColor, string> = {
  blue: '#3B82F6',
  gold: '#F5B301',
  red: '#ef4444',
};

export function Ball({ x, y, tier, color }: BallProps) {
  const t = TIERS[Math.min(tier, TIERS.length - 1)];
  const fill = FILL[color];
  const showLabel = tier >= 2;
  const font = matchFont({ fontFamily: 'System', fontSize: Math.max(10, t.radius * 0.5), fontWeight: 'bold' });

  return (
    <Group>
      {color === 'gold' && (
        <Circle cx={x} cy={y} r={t.radius + 5} color={fill} opacity={0.3}>
          <BlurMask blur={8} style="normal" />
        </Circle>
      )}
      <Circle cx={x} cy={y} r={t.radius} color={fill} />
      <Circle cx={x - t.radius * 0.3} cy={y - t.radius * 0.3} r={t.radius * 0.35} color="white" opacity={0.18} />
      {showLabel && font && (
        <SkiaText
          x={x - t.radius * 0.55}
          y={y + t.radius * 0.2}
          text={t.label}
          font={font}
          color="white"
        />
      )}
    </Group>
  );
}
