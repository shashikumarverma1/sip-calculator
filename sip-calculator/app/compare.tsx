import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import { Jar, type JarHandle } from '@/components/jar/Jar';
import { computeSipYearly } from '@/lib/finance/sip';
import { formatINR } from '@/lib/format';

const JAR_SIZE = { width: 150, height: 300 };

export default function CompareScreen() {
  const [monthly, setMonthly] = useState(5000);
  const [sipRate, setSipRate] = useState(12);
  const [fdRate, setFdRate] = useState(7);
  const [years, setYears] = useState(10);
  const [currentYear, setCurrentYear] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const sipJarRef = useRef<JarHandle | null>(null);
  const fdJarRef = useRef<JarHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sipYearly = useMemo(() => computeSipYearly(monthly, sipRate, years), [monthly, sipRate, years]);
  const fdYearly = useMemo(() => computeSipYearly(monthly, fdRate, years), [monthly, fdRate, years]);

  const sipNow = currentYear === 0 ? { invested: 0, returns: 0, total: 0 } : sipYearly[currentYear - 1];
  const fdNow = currentYear === 0 ? { invested: 0, returns: 0, total: 0 } : fdYearly[currentYear - 1];
  const sipWinning = sipNow.total >= fdNow.total;

  const resetBoth = useCallback(() => {
    sipJarRef.current?.reset();
    fdJarRef.current?.reset();
  }, []);

  useEffect(() => {
    resetBoth();
    setCurrentYear(0);
  }, [resetBoth]);

  const stopPlayback = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const rebuildToYear = useCallback(
    (year: number) => {
      resetBoth();
      let prevSip = 0;
      let prevFd = 0;
      for (let y = 1; y <= year; y++) {
        const s = sipYearly[y - 1];
        const f = fdYearly[y - 1];
        sipJarRef.current?.dropAmount(s.invested - prevSip, 'blue');
        sipJarRef.current?.dropAmount(s.returns - (sipYearly[y - 2]?.returns ?? 0), 'gold');
        fdJarRef.current?.dropAmount(f.invested - prevFd, 'blue');
        fdJarRef.current?.dropAmount(f.returns - (fdYearly[y - 2]?.returns ?? 0), 'gold');
        prevSip = s.invested;
        prevFd = f.invested;
      }
    },
    [resetBoth, sipYearly, fdYearly],
  );

  const handleInputChange = (apply: () => void) => {
    stopPlayback();
    apply();
  };

  const handleScrub = (year: number) => {
    stopPlayback();
    setCurrentYear(year);
    rebuildToYear(year);
  };

  const play = () => {
    if (isPlaying) return;
    resetBoth();
    setCurrentYear(0);
    setIsPlaying(true);
    const perYearMs = Math.max(12000 / years, 150);
    let y = 1;
    let prevSipInvested = 0;
    let prevSipReturns = 0;
    let prevFdInvested = 0;
    let prevFdReturns = 0;

    const step = () => {
      if (y > years) {
        setIsPlaying(false);
        timerRef.current = null;
        return;
      }
      const s = sipYearly[y - 1];
      const f = fdYearly[y - 1];
      sipJarRef.current?.dropAmount(s.invested - prevSipInvested, 'blue');
      sipJarRef.current?.dropAmount(s.returns - prevSipReturns, 'gold');
      fdJarRef.current?.dropAmount(f.invested - prevFdInvested, 'blue');
      fdJarRef.current?.dropAmount(f.returns - prevFdReturns, 'gold');
      prevSipInvested = s.invested;
      prevSipReturns = s.returns;
      prevFdInvested = f.invested;
      prevFdReturns = f.returns;
      setCurrentYear(y);
      y++;
      timerRef.current = setTimeout(step, perYearMs);
    };
    step();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.yearLabel}>Year {currentYear} / {years}</Text>

      <View style={styles.jarsRow}>
        <View style={styles.jarColumn}>
          <View style={[styles.jarBadge, sipWinning && currentYear > 0 && styles.jarBadgeWinning]}>
            <Text style={styles.jarTitle}>SIP {sipWinning && currentYear > 0 ? '🏆' : ''}</Text>
          </View>
          <Jar {...JAR_SIZE} jarRef={sipJarRef} />
          <Text style={styles.jarTotal}>{formatINR(sipNow.total)}</Text>
          <Text style={styles.jarSub}>{sipRate}% p.a.</Text>
        </View>
        <View style={styles.jarColumn}>
          <View style={[styles.jarBadge, !sipWinning && currentYear > 0 && styles.jarBadgeWinning]}>
            <Text style={styles.jarTitle}>FD {!sipWinning && currentYear > 0 ? '🏆' : ''}</Text>
          </View>
          <Jar {...JAR_SIZE} jarRef={fdJarRef} />
          <Text style={styles.jarTotal}>{formatINR(fdNow.total)}</Text>
          <Text style={styles.jarSub}>{fdRate}% p.a.</Text>
        </View>
      </View>

      <Field label={`Monthly deposit: ${formatINR(monthly)}`}>
        <Slider
          minimumValue={500}
          maximumValue={100000}
          step={500}
          value={monthly}
          minimumTrackTintColor="#3B82F6"
          onValueChange={(v) => handleInputChange(() => setMonthly(v))}
        />
      </Field>
      <Field label={`SIP expected return: ${sipRate}%`}>
        <Slider
          minimumValue={1}
          maximumValue={30}
          step={0.5}
          value={sipRate}
          minimumTrackTintColor="#F5B301"
          onValueChange={(v) => handleInputChange(() => setSipRate(v))}
        />
      </Field>
      <Field label={`FD rate: ${fdRate}%`}>
        <Slider
          minimumValue={1}
          maximumValue={15}
          step={0.1}
          value={fdRate}
          minimumTrackTintColor="#10b981"
          onValueChange={(v) => handleInputChange(() => setFdRate(v))}
        />
      </Field>
      <Field label={`Duration: ${years} years`}>
        <Slider
          minimumValue={1}
          maximumValue={40}
          step={1}
          value={years}
          minimumTrackTintColor="#9aa5b1"
          onValueChange={(v) => handleInputChange(() => setYears(v))}
        />
      </Field>

      <Pressable style={[styles.playButton, isPlaying && styles.playButtonDisabled]} onPress={play} disabled={isPlaying}>
        <Text style={styles.playButtonText}>{isPlaying ? 'Racing…' : '▶ Race'}</Text>
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
  yearLabel: { color: '#9aa5b1', textAlign: 'center', marginTop: 4, marginBottom: 8, fontWeight: '600' },
  jarsRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 20 },
  jarColumn: { alignItems: 'center' },
  jarBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 6 },
  jarBadgeWinning: { backgroundColor: '#4f46e522' },
  jarTitle: { color: '#fff', fontWeight: '800' },
  jarTotal: { color: '#fff', fontWeight: '800', fontSize: 15, marginTop: 8 },
  jarSub: { color: '#6b7280', fontSize: 11 },
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
