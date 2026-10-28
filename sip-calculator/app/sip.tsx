import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import { Jar, type JarHandle } from '@/components/jar/Jar';
import { computeSipYearly, type YearBreakdown } from '@/lib/finance/sip';
import { formatINR } from '@/lib/format';

const ZERO: YearBreakdown = { year: 0, invested: 0, returns: 0, total: 0 };

export default function SipScreen() {
  const [monthly, setMonthly] = useState(5000);
  const [ratePct, setRatePct] = useState(11);
  const [years, setYears] = useState(10);
  const [currentYear, setCurrentYear] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const jarRef = useRef<JarHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const breakdown = useMemo(() => computeSipYearly(monthly, ratePct, years), [monthly, ratePct, years]);
  const current = currentYear === 0 ? ZERO : breakdown[currentYear - 1];

  const stopPlayback = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const rebuildToYear = useCallback(
    (year: number) => {
      jarRef.current?.reset();
      let prevInvested = 0;
      let prevReturns = 0;
      for (let y = 1; y <= year; y++) {
        const b = breakdown[y - 1];
        jarRef.current?.dropAmount(b.invested - prevInvested, 'blue');
        jarRef.current?.dropAmount(b.returns - prevReturns, 'gold');
        prevInvested = b.invested;
        prevReturns = b.returns;
      }
    },
    [breakdown],
  );

  const handleInputChange = (apply: () => void) => {
    stopPlayback();
    apply();
    setCurrentYear(0);
    jarRef.current?.reset();
  };

  const handleScrub = (year: number) => {
    stopPlayback();
    setCurrentYear(year);
    rebuildToYear(year);
  };

  const play = () => {
    if (isPlaying) return;
    jarRef.current?.reset();
    setCurrentYear(0);
    setIsPlaying(true);
    const perYearMs = Math.max(12000 / years, 150);
    let y = 1;
    let prevInvested = 0;
    let prevReturns = 0;

    const step = () => {
      if (y > years) {
        setIsPlaying(false);
        timerRef.current = null;
        return;
      }
      const b = breakdown[y - 1];
      jarRef.current?.dropAmount(b.invested - prevInvested, 'blue');
      jarRef.current?.dropAmount(b.returns - prevReturns, 'gold');
      prevInvested = b.invested;
      prevReturns = b.returns;
      setCurrentYear(y);
      y++;
      timerRef.current = setTimeout(step, perYearMs);
    };
    step();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.yearLabel}>Year {currentYear} / {years}</Text>
      <Text style={styles.total}>{formatINR(current.total)}</Text>

      <View style={styles.jarWrap}>
        <Jar width={300} height={360} jarRef={jarRef} />
      </View>

      <View style={styles.row}>
        <View>
          <Text style={styles.statLabel}>Invested</Text>
          <Text style={styles.statBlue}>{formatINR(current.invested)}</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Returns</Text>
          <Text style={styles.statGold}>{formatINR(current.returns)}</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statTotal}>{formatINR(current.total)}</Text>
        </View>
      </View>

      <Field label={`Monthly SIP: ${formatINR(monthly)}`}>
        <Slider
          minimumValue={500}
          maximumValue={100000}
          step={500}
          value={monthly}
          minimumTrackTintColor="#3B82F6"
          onValueChange={(v) => handleInputChange(() => setMonthly(v))}
        />
      </Field>
      <Field label={`Expected return: ${ratePct}%`}>
        <Slider
          minimumValue={1}
          maximumValue={30}
          step={0.5}
          value={ratePct}
          minimumTrackTintColor="#F5B301"
          onValueChange={(v) => handleInputChange(() => setRatePct(v))}
        />
      </Field>
      <Field label={`Duration: ${years} years`}>
        <Slider
          minimumValue={1}
          maximumValue={40}
          step={1}
          value={years}
          minimumTrackTintColor="#10b981"
          onValueChange={(v) => handleInputChange(() => setYears(v))}
        />
      </Field>

      <Pressable style={[styles.playButton, isPlaying && styles.playButtonDisabled]} onPress={play} disabled={isPlaying}>
        <Text style={styles.playButtonText}>{isPlaying ? 'Playing…' : '▶ Play'}</Text>
      </Pressable>

      <Field label={`Scrub to year: ${currentYear}`}>
        <Slider
          minimumValue={0}
          maximumValue={years}
          step={1}
          value={currentYear}
          minimumTrackTintColor="#9aa5b1"
          onSlidingComplete={handleScrub}
        />
      </Field>

      <Text style={styles.disclaimer}>
        Returns are assumed for illustration and are not guaranteed. Not financial advice.
      </Text>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1420' },
  yearLabel: { color: '#9aa5b1', textAlign: 'center', marginTop: 4, fontWeight: '600' },
  total: { color: '#fff', fontSize: 34, fontWeight: '900', textAlign: 'center', marginVertical: 4 },
  jarWrap: { alignItems: 'center', marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  statLabel: { color: '#6b7280', fontSize: 12, textAlign: 'center' },
  statBlue: { color: '#3B82F6', fontWeight: '800', fontSize: 15 },
  statGold: { color: '#F5B301', fontWeight: '800', fontSize: 15 },
  statTotal: { color: '#fff', fontWeight: '800', fontSize: 15 },
  field: { marginBottom: 16 },
  fieldLabel: { color: '#cfd6e0', marginBottom: 4, fontWeight: '600' },
  playButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    marginVertical: 8,
  },
  playButtonDisabled: { opacity: 0.6 },
  playButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  disclaimer: { color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: 16 },
});
