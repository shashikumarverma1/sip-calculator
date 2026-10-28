import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const EMOJIS = ['🎉', '🎊', '✨', '💰', '🪙'];
const PIECES = 24;

function ConfettiPiece({ index, width }: { index: number; width: number }) {
  const progress = useSharedValue(0);
  const x = Math.random() * width;
  const emoji = EMOJIS[index % EMOJIS.length];
  const delay = Math.random() * 400;
  const duration = 1400 + Math.random() * 800;
  const rotateStart = Math.random() * 360;

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: -20,
    transform: [
      { translateY: progress.value * 420 },
      { rotate: `${rotateStart + progress.value * 360}deg` },
    ],
    opacity: 1 - progress.value * 0.6,
  }));

  return <Animated.Text style={[styles.piece, style]}>{emoji}</Animated.Text>;
}

export function Confetti({ width = 320 }: { width?: number }) {
  return (
    <>
      {Array.from({ length: PIECES }).map((_, i) => (
        <ConfettiPiece key={i} index={i} width={width} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  piece: { fontSize: 22 },
});
