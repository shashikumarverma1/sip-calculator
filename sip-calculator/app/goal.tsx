import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import Slider from '@react-native-community/slider';
import { Jar, type JarHandle } from '@/components/jar/Jar';
import { computeSipYearly } from '@/lib/finance/sip';
import { requiredMonthlySip, yearsToReachGoal } from '@/lib/finance/goal';
import { formatINR } from '@/lib/format';
import { Confetti } from '@/components/Confetti';

const JAR_SIZE = { width: 300, height: 360 };

export default function GoalScreen() {
  const [goalName, setGoalName] = useState('House');
  const [goalAmount, setGoalAmount] = useState(5000000);
  const [monthly, setMonthly] = useState(10000);
  const [ratePct, setRatePct] = useState(12);
  const [currentYear, setCurrentYear] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  const jarRef = useRef<JarHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const yearsNeeded = useMemo(() => yearsToReachGoal(monthly, ratePct, goalAmount, 50), [monthly, ratePct, goalAmount]);
  const planHorizon = yearsNeeded ?? 40;
  const yearly = useMemo(() => computeSipYearly(monthly, ratePct, planHorizon), [monthly, ratePct, planHorizon]);
  const requiredMonthly = useMemo(() => requiredMonthlySip(goalAmount, ratePct, Math.max(planHorizon, 1)), [goalAmount, ratePct, planHorizon]);

  const current = currentYear === 0 ? { invested: 0, returns: 0, total: 0 } : yearly[currentYear - 1];
  const reached = current.total >= goalAmount;

  const visualMax = Math.max(goalAmount, yearly[yearly.length - 1]?.total ?? goalAmount) * 1.1;
  const goalLineRatio = Math.min(goalAmount / visualMax, 1);

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
        const b = yearly[y - 1];
        jarRef.current?.dropAmount(b.invested - prevInvested, 'blue');
        jarRef.current?.dropAmount(b.returns - prevReturns, 'gold');
        prevInvested = b.invested;
        prevReturns = b.returns;
      }
    },
    [yearly],
  );

  useEffect(() => {
    stopPlayback();
    jarRef.current?.reset();
    setCurrentYear(0);
    setCelebrated(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly, ratePct, goalAmount]);

  const handleInputChange = (apply: () => void) => {
    stopPlayback();
    apply();
  };

  const handleScrub = (year: number) => {
    stopPlayback();
    setCurrentYear(year);
    rebuildToYear(year);
    setCelebrated(yearly[year - 1]?.total >= goalAmount);
  };

  const play = () => {
    if (isPlaying) return;
    jarRef.current?.reset();
    setCurrentYear(0);
    setCelebrated(false);
    setIsPlaying(true);
    const perYearMs = Math.max(12000 / planHorizon, 150);
    let y = 1;
    let prevInvested = 0;
    let prevReturns = 0;

    const step = () => {
      if (y > planHorizon) {
        setIsPlaying(false);
        timerRef.current = null;
        return;
      }
      const b = yearly[y - 1];
      jarRef.current?.dropAmount(b.invested - prevInvested, 'blue');
      jarRef.current?.dropAmount(b.returns - prevReturns, 'gold');
      prevInvested = b.invested;
      prevReturns = b.returns;
      setCurrentYear(y);
      if (b.total >= goalAmount && !celebrated) {
        setCelebrated(true);
        setIsPlaying(false);
        timerRef.current = null;
        return;
      }
      y++;
      timerRef.current = setTimeout(step, perYearMs);
    };
    step();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.yearLabel}>Year {currentYear}{yearsNeeded ? ` / ${yearsNeeded}` : ''}</Text>
      <Text style={styles.total}>{formatINR(current.total)}</Text>
      <Text style={styles.goalLine}>Goal: {goalName} · {formatINR(goalAmount)}</Text>

      <View style={styles.jarWrap}>
        <Jar {...JAR_SIZE} jarRef={jarRef} goalLineRatio={goalLineRatio} />
        {celebrated && <Confetti width={JAR_SIZE.width} />}
      </View>

      {reached && (
        <Text style={styles.reachedBanner}>🎉 Goal reached in {currentYear} years!</Text>
      )}

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
          <Text style={styles.statLabel}>{yearsNeeded ? 'Years needed' : 'Required monthly'}</Text>
          <Text style={styles.statTotal}>{yearsNeeded ? `${yearsNeeded} yrs` : formatINR(requiredMonthly)}</Text>
        </View>
      </View>

      <Field label="Goal name">
        <TextInput
          style={styles.input}
          value={goalName}
          onChangeText={setGoalName}
          placeholder="e.g. House"
          placeholderTextColor="#6b7280"
        />
      </Field>
      <Field label={`Goal amount: ${formatINR(goalAmount)}`}>
        <Slider
          minimumValue={100000}
          maximumValue={50000000}
          step={100000}
          value={goalAmount}
          minimumTrackTintColor="#ef4444"
          onValueChange={(v) => handleInputChange(() => setGoalAmount(v))}
        />
      </Field>
      <Field label={`Monthly SIP: ${formatINR(monthly)}`}>
        <Slider
          minimumValue={500}
          maximumValue={200000}
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

      <Pressable style={[styles.playButton, isPlaying && styles.playButtonDisabled]} onPress={play} disabled={isPlaying}>
        <Text style={styles.playButtonText}>{isPlaying ? 'Playing…' : '▶ Play'}</Text>
      </Pressable>

      <Field label={`Scrub to year: ${currentYear}`}>
        <Slider
          minimumValue={0}
          maximumValue={planHorizon}
          step={1}
          value={currentYear}
          minimumTrackTintColor="#9aa5b1"
          onSlidingComplete={handleScrub}
        />
      </Field>

      {!yearsNeeded && (
        <Text style={styles.warning}>
          This goal isn't reachable within 50 years at this rate — try a higher monthly amount.
        </Text>
      )}

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
  goalLine: { color: '#ef4444', textAlign: 'center', fontWeight: '700', marginBottom: 4 },
  jarWrap: { alignItems: 'center', marginVertical: 12 },
  reachedBanner: { color: '#10b981', textAlign: 'center', fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  statLabel: { color: '#6b7280', fontSize: 12, textAlign: 'center' },
  statBlue: { color: '#3B82F6', fontWeight: '800', fontSize: 15 },
  statGold: { color: '#F5B301', fontWeight: '800', fontSize: 15 },
  statTotal: { color: '#fff', fontWeight: '800', fontSize: 15 },
  field: { marginBottom: 16 },
  fieldLabel: { color: '#cfd6e0', marginBottom: 4, fontWeight: '600' },
  input: {
    backgroundColor: '#1a2434',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontWeight: '600',
  },
  playButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    marginVertical: 8,
  },
  playButtonDisabled: { opacity: 0.6 },
  playButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  warning: { color: '#f59e0b', fontSize: 12, textAlign: 'center', marginTop: 8 },
  disclaimer: { color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: 16 },
});
