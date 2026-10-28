import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import { Jar, type JarHandle } from '@/components/jar/Jar';
import { computeEMI, computeEmiYearly } from '@/lib/finance/emi';
import { formatINR } from '@/lib/format';

export default function EmiScreen() {
  const [principal, setPrincipal] = useState(1000000);
  const [ratePct, setRatePct] = useState(9);
  const [years, setYears] = useState(20);
  const [currentYear, setCurrentYear] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const jarRef = useRef<JarHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { emi, totalInterest, totalPayment } = useMemo(() => computeEMI(principal, ratePct, years), [principal, ratePct, years]);
  const yearly = useMemo(() => computeEmiYearly(principal, ratePct, years), [principal, ratePct, years]);

  const fillJar = useCallback(() => {
    jarRef.current?.reset();
    jarRef.current?.dropAmount(principal, 'blue');
    jarRef.current?.dropAmount(totalInterest, 'red');
  }, [principal, totalInterest]);

  const stopPlayback = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const rebuildToYear = useCallback(
    (year: number) => {
      fillJar();
      let prevPrincipal = 0;
      let prevInterest = 0;
      for (let y = 1; y <= year; y++) {
        const row = yearly[y - 1];
        jarRef.current?.removeAmount(row.principalPaid - prevPrincipal, 'blue');
        jarRef.current?.removeAmount(row.interestPaid - prevInterest, 'red');
        prevPrincipal = row.principalPaid;
        prevInterest = row.interestPaid;
      }
    },
    [fillJar, yearly],
  );

  const handleInputChange = (apply: () => void) => {
    stopPlayback();
    apply();
    setCurrentYear(0);
  };

  const handleScrub = (year: number) => {
    stopPlayback();
    setCurrentYear(year);
    rebuildToYear(year);
  };

  const play = () => {
    if (isPlaying) return;
    fillJar();
    setCurrentYear(0);
    setIsPlaying(true);
    const perYearMs = Math.max(12000 / years, 150);
    let y = 1;
    let prevPrincipal = 0;
    let prevInterest = 0;

    const step = () => {
      if (y > years) {
        setIsPlaying(false);
        timerRef.current = null;
        return;
      }
      const row = yearly[y - 1];
      jarRef.current?.removeAmount(row.principalPaid - prevPrincipal, 'blue');
      jarRef.current?.removeAmount(row.interestPaid - prevInterest, 'red');
      prevPrincipal = row.principalPaid;
      prevInterest = row.interestPaid;
      setCurrentYear(y);
      y++;
      timerRef.current = setTimeout(step, perYearMs);
    };
    step();
  };

  useEffect(() => {
    fillJar();
    setCurrentYear(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillJar]);

  const row = currentYear === 0 ? { principalPaid: 0, interestPaid: 0, balance: principal } : yearly[currentYear - 1];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.yearLabel}>Year {currentYear} / {years}</Text>
      <Text style={styles.emi}>{formatINR(emi)}<Text style={styles.emiSuffix}> / month</Text></Text>

      <View style={styles.jarWrap}>
        <Jar width={300} height={360} jarRef={jarRef} />
      </View>

      <View style={styles.row}>
        <View>
          <Text style={styles.statLabel}>Balance left</Text>
          <Text style={styles.statBlue}>{formatINR(row.balance)}</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Interest paid</Text>
          <Text style={styles.statRed}>{formatINR(row.interestPaid)}</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Total interest</Text>
          <Text style={styles.statTotal}>{formatINR(totalInterest)}</Text>
        </View>
      </View>

      <Field label={`Loan amount: ${formatINR(principal)}`}>
        <Slider
          minimumValue={100000}
          maximumValue={20000000}
          step={50000}
          value={principal}
          minimumTrackTintColor="#3B82F6"
          onValueChange={(v) => handleInputChange(() => setPrincipal(v))}
        />
      </Field>
      <Field label={`Interest rate: ${ratePct}%`}>
        <Slider
          minimumValue={1}
          maximumValue={30}
          step={0.1}
          value={ratePct}
          minimumTrackTintColor="#ef4444"
          onValueChange={(v) => handleInputChange(() => setRatePct(v))}
        />
      </Field>
      <Field label={`Tenure: ${years} years`}>
        <Slider
          minimumValue={1}
          maximumValue={30}
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

      <Text style={styles.summary}>
        Total payment of {formatINR(totalPayment)} = {formatINR(principal)} principal + {formatINR(totalInterest)} interest.
      </Text>

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
  emi: { color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'center', marginVertical: 4 },
  emiSuffix: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  jarWrap: { alignItems: 'center', marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  statLabel: { color: '#6b7280', fontSize: 12, textAlign: 'center' },
  statBlue: { color: '#3B82F6', fontWeight: '800', fontSize: 15 },
  statRed: { color: '#ef4444', fontWeight: '800', fontSize: 15 },
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
  summary: { color: '#9aa5b1', fontSize: 12, textAlign: 'center', marginTop: 12 },
  disclaimer: { color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: 16 },
});
