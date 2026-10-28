import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, RoundedRect, Group, Line, vec } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { PhysicsWorld, type BallColor, type BallSnapshot } from './PhysicsWorld';
import { Ball } from './Ball';

export interface JarHandle {
  dropAmount: (amount: number, color: BallColor) => void;
  removeAmount: (amount: number, color: BallColor) => void;
  reset: () => void;
  shake: () => void;
  getBallCount: () => number;
}

export interface JarProps {
  width?: number;
  height?: number;
  jarRef?: React.MutableRefObject<JarHandle | null>;
  /** 0..1 position of a dashed goal line from the bottom of the jar, if any. */
  goalLineRatio?: number;
}

/** Room above and beside the jar's own walls so overflow balls spilling out stay visible
 * instead of being drawn past the edge of the canvas (which would just not render them). */
const SPILL_MARGIN_TOP = 180;
const SPILL_MARGIN_X = 60;

export function Jar({ width = 300, height = 360, jarRef, goalLineRatio }: JarProps) {
  const [snapshot, setSnapshot] = useState<BallSnapshot[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const world = new PhysicsWorld(width, height);
    world.onMerge = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    };

    if (jarRef) {
      jarRef.current = {
        dropAmount: (amount, color) => world.dropAmount(amount, color),
        removeAmount: (amount, color) => world.removeAmount(amount, color),
        reset: () => world.reset(),
        shake: () => world.shake(),
        getBallCount: () => world.ballBodies.size,
      };
    }

    let last = Date.now();
    let mounted = true;
    const loop = () => {
      if (!mounted) return;
      const now = Date.now();
      const delta = now - last;
      last = now;
      world.step(delta);
      setSnapshot(world.getSnapshot());
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (jarRef) jarRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  const goalY = goalLineRatio != null ? height - goalLineRatio * height : null;
  const canvasWidth = width + SPILL_MARGIN_X * 2;
  const canvasHeight = height + SPILL_MARGIN_TOP;

  return (
    <View style={{ width: canvasWidth, height: canvasHeight }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{ translateX: SPILL_MARGIN_X }, { translateY: SPILL_MARGIN_TOP }]}>
          <RoundedRect x={0} y={0} width={width} height={height} r={18} color="#15202e" />
          <RoundedRect x={2} y={2} width={width - 4} height={height - 4} r={16} style="stroke" strokeWidth={2} color="#2a3a52" />
          {snapshot.map((b) => (
            <Ball key={b.id} x={b.x} y={b.y} tier={b.tier} color={b.color} />
          ))}
          {goalY != null && (
            <Line p1={vec(8, goalY)} p2={vec(width - 8, goalY)} color="#ef4444" strokeWidth={2} />
          )}
        </Group>
      </Canvas>
    </View>
  );
}
