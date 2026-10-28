import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { colors } from './theme';

export interface ScrubBarProps {
  label: string;
  min: number;
  max: number;
  value: number;
  trackColor?: string;
  onSlidingComplete: (v: number) => void;
  isPlaying: boolean;
  onPlay: () => void;
}

/** Circular play button + labeled scrub slider, matching the "▶ ─●───── Scrub years 1–30" row. */
export function ScrubBar({ label, min, max, value, trackColor = colors.textFaint, onSlidingComplete, isPlaying, onPlay }: ScrubBarProps) {
  return (
    <View>
      <View style={styles.row}>
        <Pressable style={[styles.playButton, isPlaying && styles.playButtonDisabled]} onPress={onPlay} disabled={isPlaying}>
          <Text style={styles.playIcon}>{isPlaying ? '…' : '▶'}</Text>
        </Pressable>
        <View style={styles.sliderWrap}>
          <Text style={styles.label}>{label}</Text>
          <Slider
            minimumValue={min}
            maximumValue={max}
            step={1}
            value={value}
            minimumTrackTintColor={trackColor}
            onSlidingComplete={onSlidingComplete}
          />
        </View>
      </View>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{min}</Text>
        <Text style={styles.rangeText}>{max}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonDisabled: { opacity: 0.6 },
  playIcon: { color: '#1a1200', fontSize: 16, fontWeight: '900' },
  sliderWrap: { flex: 1 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 54 },
  rangeText: { color: colors.textFaint, fontSize: 10 },
});
