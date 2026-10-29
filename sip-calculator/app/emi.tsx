import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/components/ui/theme';
import { BallGrid, type PartialBall } from '@/components/jar/BallGrid';
import { CustomValueKeypad } from '@/components/ui/CustomValueKeypad';
import { useProStore } from '@/store/proStore';
import {
  computeEMI,
  computeEmiYearly,
  simulateEmiWithPrepayment,
  simulateEmiRecast,
  type EmiYearBreakdown,
} from '@/lib/finance/emi';
import { createJar, familyTotal, type JarState, type Ball } from '@/lib/balls/types';
import { addValue, removeValue } from '@/lib/balls/engine';
import { formatINR, formatCompactINR } from '@/lib/format';

type Phase = 'setup' | 'playing' | 'result' | 'prepay' | 'share';
type CustomField = 'amount' | 'rate' | 'tenure' | null;
type LoanType = 'Home' | 'Car' | 'Personal' | 'Education';

const TENURE_PRESETS = [3, 5, 10, 20];
const LOAN_TYPES: { key: LoanType; icon: string }[] = [
  { key: 'Home', icon: '🏠' },
  { key: 'Car', icon: '🚗' },
  { key: 'Personal', icon: '👤' },
  { key: 'Education', icon: '🎓' },
];

interface YearSnapshot {
  loanBalls: Ball[];
  paidBalls: Ball[];
  loanPartials: PartialBall[];
  paidPartials: PartialBall[];
}

function snapshotJars(loanJar: JarState, paidJar: JarState): YearSnapshot {
  return {
    loanBalls: [...loanJar.balls],
    paidBalls: [...paidJar.balls],
    loanPartials: [
      { family: 'principal', amount: loanJar.partial.principal },
      { family: 'interest', amount: loanJar.partial.interest },
    ],
    paidPartials: [
      { family: 'principal', amount: paidJar.partial.principal },
      { family: 'interest', amount: paidJar.partial.interest },
    ],
  };
}

/** Year-by-year snapshots of the draining "loan left" jar and the filling "total paid" jar —
 * precomputed once so playback is just an array lookup, not a re-simulation per frame. */
function buildSnapshots(principal: number, ratePct: number, years: number, totalInterest: number, yearlyRows: EmiYearBreakdown[]) {
  const loanJar = createJar('loanLeft');
  const paidJar = createJar('paid');
  addValue(loanJar, principal, 'principal', 0);
  addValue(loanJar, totalInterest, 'interest', 0);

  const snapshots: YearSnapshot[] = [snapshotJars(loanJar, paidJar)];
  let prevPrincipal = 0;
  let prevInterest = 0;
  for (const row of yearlyRows) {
    const dPrincipal = Math.min(row.principalPaid - prevPrincipal, familyTotal(loanJar, 'principal'));
    const dInterest = Math.min(row.interestPaid - prevInterest, familyTotal(loanJar, 'interest'));
    if (dPrincipal > 0) {
      removeValue(loanJar, dPrincipal, 'principal', row.year);
      addValue(paidJar, dPrincipal, 'principal', row.year);
    }
    if (dInterest > 0) {
      removeValue(loanJar, dInterest, 'interest', row.year);
      addValue(paidJar, dInterest, 'interest', row.year);
    }
    prevPrincipal = row.principalPaid;
    prevInterest = row.interestPaid;
    snapshots.push(snapshotJars(loanJar, paidJar));
  }
  return snapshots;
}

/** Throwaway jar used only to visualize a bare interest amount in the share/compare cards. */
function interestOnlyJar(amount: number): JarState {
  const jar = createJar('preview');
  addValue(jar, amount, 'interest', 1);
  return jar;
}

export default function EmiScreen() {
  const isPro = useProStore((s) => s.isPro);
  const [phase, setPhase] = useState<Phase>('setup');
  const [loanType, setLoanType] = useState<LoanType>('Home');
  const [principal, setPrincipal] = useState(2000000);
  const [ratePct, setRatePct] = useState(9);
  const [years, setYears] = useState(20);
  const [currentYear, setCurrentYear] = useState(0);
  const [customField, setCustomField] = useState<CustomField>(null);
  const [prepayMode, setPrepayMode] = useState<'sooner' | 'lower'>('sooner');
  const [extraMonthly, setExtraMonthly] = useState(2000);
  const [extraYearly, setExtraYearly] = useState(0);
  const [shareTab, setShareTab] = useState<'shock' | 'savings'>('shock');
  const [bigEmiExtra, setBigEmiExtra] = useState(0);

  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { emi, totalInterest, totalPayment } = useMemo(() => computeEMI(principal, ratePct, years), [principal, ratePct, years]);
  const yearlyRows = useMemo(() => computeEmiYearly(principal, ratePct, years), [principal, ratePct, years]);
  const snapshots = useMemo(
    () => buildSnapshots(principal, ratePct, years, totalInterest, yearlyRows),
    [principal, ratePct, years, totalInterest, yearlyRows],
  );

  const row = currentYear === 0 ? { principalPaid: 0, interestPaid: 0, balance: principal } : yearlyRows[currentYear - 1];
  const prevRow = currentYear <= 1 ? { principalPaid: 0, interestPaid: 0 } : yearlyRows[currentYear - 2];
  const snap = snapshots[currentYear];

  const thisYearPrincipal = row.principalPaid - prevRow.principalPaid;
  const thisYearInterest = row.interestPaid - prevRow.interestPaid;
  const thisYearTotal = thisYearPrincipal + thisYearInterest;
  const interestSharePct = thisYearTotal > 0 ? Math.round((thisYearInterest / thisYearTotal) * 100) : 0;
  const loanSharePct = 100 - interestSharePct;

  const multiplier = totalPayment / principal;
  const loanPct = Math.round((principal / totalPayment) * 100);
  const interestPct = 100 - loanPct;

  const originalMonths = years * 12;
  const monthsEarly = (months: number) => {
    const diff = originalMonths - months;
    return { y: Math.floor(diff / 12), m: diff % 12 };
  };

  const bigEmi = emi + bigEmiExtra;
  const bigEmiResult = useMemo(
    () => simulateEmiWithPrepayment(principal, ratePct, years, bigEmiExtra, 0),
    [principal, ratePct, years, bigEmiExtra],
  );
  const bigEmiSaved = totalInterest - bigEmiResult.totalInterest;
  const bigEmiEarly = monthsEarly(bigEmiResult.months);

  const prepaySooner = useMemo(
    () => simulateEmiWithPrepayment(principal, ratePct, years, extraMonthly, extraYearly),
    [principal, ratePct, years, extraMonthly, extraYearly],
  );
  const prepayLower = useMemo(
    () => simulateEmiRecast(principal, ratePct, years, extraMonthly, extraYearly),
    [principal, ratePct, years, extraMonthly, extraYearly],
  );
  const prepayInterestSaved = prepayMode === 'sooner' ? totalInterest - prepaySooner.totalInterest : totalInterest - prepayLower.totalInterest;
  const prepaySoonerEarly = monthsEarly(prepaySooner.months);

  const stopPlayback = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    stopPlayback();
    setCurrentYear(0);
    const perYearMs = Math.max(12000 / years, 150);
    let y = 1;
    const step = () => {
      if (y > years) {
        timerRef.current = null;
        return;
      }
      setCurrentYear(y);
      y++;
      timerRef.current = setTimeout(step, perYearMs);
    };
    step();
  }, [years, stopPlayback]);

  useEffect(() => {
    if (phase === 'playing') play();
    return stopPlayback;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const skipToEnd = () => {
    stopPlayback();
    setCurrentYear(years);
  };
  const goSetup = () => {
    stopPlayback();
    setPhase('setup');
  };
  const startLoan = () => setPhase('playing');
  const seeTheDamage = () => {
    stopPlayback();
    setCurrentYear(years);
    setPhase('result');
  };
  const animationDone = currentYear >= years;

  // ---------------- SETUP ----------------
  if (phase === 'setup') {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>New Loan Jar</Text>
            <Text style={styles.stepLabel}>See where every rupee of your EMI goes</Text>
          </View>
        </View>

        <View style={styles.typeRow}>
          {LOAN_TYPES.map((t) => (
            <Pressable key={t.key} style={[styles.typeChip, loanType === t.key && styles.typeChipActive]} onPress={() => setLoanType(t.key)}>
              <Text style={styles.typeIcon}>{t.icon}</Text>
              <Text style={[styles.typeText, loanType === t.key && styles.typeTextActive]}>{t.key}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.card} onPress={() => setCustomField('amount')}>
          <Text style={styles.cardLabel}>I am borrowing</Text>
          <Text style={styles.stepperValue}>{formatINR(principal)} ✎</Text>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Interest rate</Text>
            <Pressable onPress={() => setCustomField('rate')}>
              <Text style={styles.cardLabelValue}>{ratePct}% p.a. ✎</Text>
            </Pressable>
          </View>
          <Slider minimumValue={1} maximumValue={36} step={0.05} value={ratePct} minimumTrackTintColor={colors.red} onValueChange={setRatePct} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Tenure</Text>
            <Pressable onPress={() => setCustomField('tenure')}>
              <Text style={styles.cardLabelValue}>{years} years ✎</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {TENURE_PRESETS.map((y) => (
              <Pressable key={y} style={[styles.chip, years === y && styles.chipActive]} onPress={() => setYears(y)}>
                <Text style={[styles.chipText, years === y && styles.chipTextActive]}>{y}y</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.chip, !TENURE_PRESETS.includes(years) && styles.chipActive]} onPress={() => setCustomField('tenure')}>
              <Text style={[styles.chipText, !TENURE_PRESETS.includes(years) && styles.chipTextActive]}>
                {!TENURE_PRESETS.includes(years) ? `${years}y` : 'Other'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Your EMI</Text>
            <Text style={styles.summaryValue}>{formatINR(emi)}<Text style={styles.summaryUnit}>/month</Text></Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total interest</Text>
            <Text style={[styles.summaryValue, { color: colors.red }]}>{formatCompactINR(totalInterest)}</Text>
          </View>
        </View>

        <Pressable style={styles.ctaButton} onPress={startLoan}>
          <Text style={styles.ctaButtonText}>▶ Show me where it goes</Text>
        </Pressable>

        {customField === 'amount' && (
          <CustomValueKeypad
            title="Loan amount"
            suffix="₹"
            initialValue={principal}
            min={10000}
            max={200000000}
            allowDecimal={false}
            doubleZero
            previewFormatter={formatCompactINR}
            hint="Allowed: ₹10,000 to ₹20 Cr"
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setPrincipal(Math.round(v));
              setCustomField(null);
            }}
          />
        )}
        {customField === 'rate' && (
          <CustomValueKeypad
            title="Yearly interest rate"
            suffix="%"
            initialValue={ratePct}
            min={1}
            max={36}
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setRatePct(v);
              setCustomField(null);
            }}
          />
        )}
        {customField === 'tenure' && (
          <CustomValueKeypad
            title="Loan tenure"
            suffix="y"
            initialValue={years}
            min={1}
            max={35}
            allowDecimal={false}
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setYears(Math.round(v));
              setCustomField(null);
            }}
          />
        )}
      </Screen>
    );
  }

  // ---------------- PLAYING ----------------
  if (phase === 'playing') {
    return (
      <View style={styles.flexScreen}>
        <Screen contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}>
          <Text style={styles.subtitle}>{loanType} loan · {formatCompactINR(principal)} · {ratePct}%</Text>
          <View style={styles.headerRow}>
            <Pressable style={styles.iconButton} onPress={goSetup} hitSlop={10}>
              <Text style={styles.iconText}>‹</Text>
            </Pressable>
            <Text style={[styles.title, { flex: 1, textAlign: 'center' }]}>
              Year {currentYear} <Text style={styles.titleFaint}>/ {years}</Text>
            </Text>
            <Pressable style={styles.iconButton} onPress={skipToEnd} hitSlop={10}>
              <Text style={styles.iconText}>›|</Text>
            </Pressable>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(currentYear / years) * 100}%` }]} />
          </View>

          {currentYear > 0 && (
            <>
              <View style={styles.splitHeaderRow}>
                <Text style={styles.splitLabel}>This year's EMIs went to</Text>
                <Text style={styles.splitLabel}>{interestSharePct}% interest · {loanSharePct}% loan</Text>
              </View>
              <View style={styles.splitBar}>
                <View style={[styles.splitBarLoan, { flex: Math.max(loanSharePct, 1) }]} />
                <View style={[styles.splitBarInterest, { flex: Math.max(interestSharePct, 1) }]} />
              </View>
            </>
          )}
          {animationDone && (
            <View style={styles.loanFreeBadge}>
              <Text style={styles.loanFreeText}>Loan free!</Text>
            </View>
          )}

          <View style={styles.resultPanel}>
            <Text style={styles.resultEyebrow}>Loan left</Text>
            <Text style={styles.resultValue}>{formatINR(row.balance)}</Text>
            <View style={styles.jarWrap}>
              <BallGrid width={300} height={140} balls={snap.loanBalls} partials={snap.loanPartials} />
            </View>
            {!animationDone && <Text style={styles.panelHint}>{formatINR(emi)} every month</Text>}
          </View>

          <View style={styles.resultPanel}>
            <Text style={styles.resultEyebrow}>Total paid</Text>
            <Text style={styles.resultValue}>{formatINR(row.principalPaid + row.interestPaid)}</Text>
            <View style={styles.jarWrap}>
              <BallGrid width={300} height={160} balls={snap.paidBalls} partials={snap.paidPartials} />
            </View>
            <View style={styles.legendRow}>
              <Legend color={colors.blue} label="Loan cleared" value={formatINR(row.principalPaid)} />
              <Legend color={colors.red} label="Interest" value={formatINR(row.interestPaid)} />
            </View>
          </View>
        </Screen>

        <View style={[styles.fixedFooter, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.bottomRow}>
            <Pressable style={styles.secondaryButton} onPress={play}>
              <Text style={styles.secondaryButtonText}>Replay</Text>
            </Pressable>
            <Pressable style={[styles.ctaButtonSmall, !animationDone && styles.ctaButtonDisabled]} disabled={!animationDone} onPress={seeTheDamage}>
              <Text style={styles.ctaButtonSmallText}>See the damage →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ---------------- PREPAY PLANNER ----------------
  if (phase === 'prepay') {
    const activeResult = prepayMode === 'sooner' ? prepaySooner : prepayLower;
    return (
      <Screen>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => setPhase('result')} hitSlop={10}>
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Prepay Planner</Text>
            <Text style={styles.stepLabel}>Drag to see how interest disappears</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <Pressable style={[styles.tabButton, prepayMode === 'sooner' && styles.tabButtonActiveGreen]} onPress={() => setPrepayMode('sooner')}>
            <Text style={[styles.tabText, prepayMode === 'sooner' && styles.tabTextActive]}>Finish loan sooner</Text>
          </Pressable>
          <Pressable style={[styles.tabButton, prepayMode === 'lower' && styles.tabButtonActiveGreen]} onPress={() => setPrepayMode('lower')}>
            <Text style={[styles.tabText, prepayMode === 'lower' && styles.tabTextActive]}>Lower my EMI</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Extra every month</Text>
            <Text style={styles.cardLabelValue}>+{formatINR(extraMonthly)}</Text>
          </View>
          <Slider minimumValue={0} maximumValue={20000} step={500} value={extraMonthly} minimumTrackTintColor={colors.red} onValueChange={setExtraMonthly} />
        </View>
        <View style={styles.card}>
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Extra once a year (bonus)</Text>
            <Text style={styles.cardLabelValue}>+{formatINR(extraYearly)}</Text>
          </View>
          <Slider minimumValue={0} maximumValue={200000} step={5000} value={extraYearly} minimumTrackTintColor={colors.red} onValueChange={setExtraYearly} />
        </View>

        <View style={styles.compareRow}>
          <View style={styles.compareCol}>
            <Text style={styles.compareColLabel}>Without prepay</Text>
            <View style={styles.jarWrap}>
              <BallGrid width={140} height={130} balls={interestOnlyJar(totalInterest).balls} />
            </View>
            <Text style={styles.compareColValue}>{formatCompactINR(totalInterest)}</Text>
            <Text style={styles.compareColSub}>Ends in {years} yrs</Text>
          </View>
          <View style={styles.compareCol}>
            <Text style={styles.compareColLabel}>With prepay</Text>
            <View style={styles.jarWrap}>
              <BallGrid width={140} height={130} balls={interestOnlyJar(activeResult.totalInterest).balls} />
            </View>
            <Text style={[styles.compareColValue, { color: colors.green }]}>{formatCompactINR(activeResult.totalInterest)}</Text>
            <Text style={styles.compareColSub}>
              {prepayMode === 'sooner' ? `Ends in ${prepaySooner.years} yrs ${prepaySooner.remainderMonths} mo` : `Still ${years} yrs`}
            </Text>
          </View>
        </View>

        <View style={styles.savingsBanner}>
          <View>
            <Text style={styles.savingsLabel}>Interest you save</Text>
            <Text style={styles.savingsValue}>{formatCompactINR(prepayInterestSaved)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {prepayMode === 'sooner' ? (
              <>
                <Text style={styles.savingsLabel}>Loan-free</Text>
                <Text style={styles.savingsValue}>{prepaySoonerEarly.y} yrs {prepaySoonerEarly.m} mo sooner</Text>
              </>
            ) : (
              <>
                <Text style={styles.savingsLabel}>New EMI</Text>
                <Text style={styles.savingsValue}>{formatINR(prepayLower.finalEmi)}</Text>
              </>
            )}
          </View>
        </View>

        <Text style={styles.disclaimer}>Estimates assume a fixed rate. Some lenders charge for prepayment — check your loan terms.</Text>
      </Screen>
    );
  }

  // ---------------- SHARE ----------------
  if (phase === 'share') {
    const shockJar = interestOnlyJar(totalInterest);
    const savingsJar = interestOnlyJar(prepayInterestSaved);
    return (
      <Screen contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => setPhase('result')} hitSlop={10}>
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <Text style={[styles.title, { flex: 1, textAlign: 'center' }]}>Share the shock</Text>
        </View>

        <View style={styles.tabRow}>
          <Pressable style={[styles.tabButton, shareTab === 'shock' && styles.tabButtonActive]} onPress={() => setShareTab('shock')}>
            <Text style={[styles.tabText, shareTab === 'shock' && styles.tabTextActive]}>Interest shock</Text>
          </Pressable>
          <Pressable style={[styles.tabButton, shareTab === 'savings' && styles.tabButtonActive]} onPress={() => setShareTab('savings')}>
            <Text style={[styles.tabText, shareTab === 'savings' && styles.tabTextActive]}>My savings</Text>
          </Pressable>
        </View>

        {shareTab === 'shock' ? (
          <View style={styles.shareCard}>
            <Text style={styles.shareBrand}>🫙 JarUp</Text>
            <Text style={styles.shareLine}>
              My {formatCompactINR(principal)} {loanType.toLowerCase()} loan will cost me{'\n'}
              <Text style={styles.shareValue}>{formatCompactINR(totalInterest)}</Text> extra, just in interest
            </Text>
            <View style={styles.jarWrap}>
              <BallGrid width={220} height={170} balls={shockJar.balls} />
            </View>
            <View style={styles.legendRow}>
              <Legend color={colors.blue} label="Loan" value={formatCompactINR(principal)} />
              <Legend color={colors.red} label="Interest" value={formatCompactINR(totalInterest)} />
            </View>
            <Text style={styles.shareDisclaimer}>{ratePct}% for {years} years · estimate only</Text>
          </View>
        ) : (
          <View style={styles.shareCard}>
            <Text style={styles.shareBrand}>🫙 JarUp</Text>
            <Text style={styles.shareLine}>
              By paying {formatINR(extraMonthly)} extra every month, I'll save{'\n'}
              <Text style={styles.shareValue}>{formatCompactINR(prepayInterestSaved)}</Text> in interest
            </Text>
            <View style={styles.jarWrap}>
              <BallGrid width={220} height={170} balls={savingsJar.balls} />
            </View>
            <View style={styles.legendRow}>
              {prepayMode === 'sooner' ? (
                <Legend color={colors.green} label="Loan-free sooner by" value={`${prepaySoonerEarly.y}y ${prepaySoonerEarly.m}m`} />
              ) : (
                <Legend color={colors.green} label="New EMI" value={formatINR(prepayLower.finalEmi)} />
              )}
            </View>
            <Text style={styles.shareDisclaimer}>{ratePct}% for {years} years · estimate only</Text>
          </View>
        )}

        <View style={styles.shareIconsRow}>
          <ShareIcon icon="💬" label="Chat" />
          <ShareIcon icon="📸" label="Story" />
          <ShareIcon icon="⬇" label="Save" />
          <ShareIcon icon="⋯" label="More" />
        </View>

        <Pressable style={styles.ctaButton} onPress={() => setPhase('result')}>
          <Text style={styles.ctaButtonText}>Done</Text>
        </Pressable>
      </Screen>
    );
  }

  // ---------------- RESULT ----------------
  const finalSnap = snapshots[years];
  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => router.replace('/')} hitSlop={10}>
          <Text style={styles.iconText}>✕</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.subtitle}>{loanType} loan · {formatCompactINR(principal)} · {ratePct}% · {years}yrs</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={goSetup} hitSlop={10}>
          <Text style={styles.iconText}>✎</Text>
        </Pressable>
      </View>

      <Text style={styles.heroEyebrow}>You borrow {formatCompactINR(principal)} but pay back</Text>
      <Text style={styles.heroValue}>{formatINR(totalPayment)}</Text>
      <Text style={styles.heroSubtext}>
        {formatCompactINR(totalInterest)} goes to the bank as interest · {multiplier.toFixed(2)}× the loan
      </Text>

      <View style={styles.splitHeaderRow}>
        <Text style={styles.splitLabel}>Loan {loanPct}%</Text>
        <Text style={styles.exploreLink}>Explore years →</Text>
        <Text style={styles.splitLabel}>Interest {interestPct}%</Text>
      </View>
      <View style={styles.splitBar}>
        <View style={[styles.splitBarLoan, { flex: Math.max(loanPct, 1) }]} />
        <View style={[styles.splitBarInterest, { flex: Math.max(interestPct, 1) }]} />
      </View>
      <Text style={styles.bankEmiLabel}>Bank EMI {formatINR(emi)}</Text>

      <View style={styles.jarWrap}>
        <BallGrid width={300} height={240} balls={finalSnap.paidBalls} partials={finalSnap.paidPartials} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Try a bigger EMI</Text>
        <Text style={styles.stepperValue}>{formatINR(bigEmi)}<Text style={styles.summaryUnit}>/mo</Text></Text>
        <Text style={styles.bigEmiSubtitle}>
          {bigEmiExtra === 0 ? 'Same as bank EMI' : `${formatINR(bigEmiExtra)} more than bank EMI`}
        </Text>

        <View style={styles.stepperRow}>
          <Pressable style={styles.stepperButton} onPress={() => setBigEmiExtra((v) => Math.max(0, v - 1000))}>
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <Pressable style={styles.bankEmiChip} onPress={() => setBigEmiExtra(0)}>
            <Text style={styles.bankEmiChipText}>Bank EMI</Text>
          </Pressable>
          <Pressable style={styles.stepperButton} onPress={() => setBigEmiExtra((v) => v + 1000)}>
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>

        <View style={styles.chipRow}>
          {[1000, 2000, 5000].map((v) => (
            <Pressable key={v} style={styles.chip} onPress={() => setBigEmiExtra(v)}>
              <Text style={styles.chipText}>+{formatCompactINR(v).replace('₹', '')}</Text>
            </Pressable>
          ))}
        </View>

        {bigEmiExtra > 0 && (
          <View style={styles.bigEmiResultRow}>
            <Text style={styles.bigEmiResultText}>
              Save {formatCompactINR(bigEmiSaved)} · ends {bigEmiEarly.y}y {bigEmiEarly.m}m early
            </Text>
          </View>
        )}
      </View>

      <Pressable style={styles.planLink} onPress={() => (isPro ? setPhase('prepay') : router.push('/paywall'))}>
        <Text style={styles.planLinkText}>Plan my own prepayments</Text>
        <View style={styles.proBadgeSmall}>
          <Text style={styles.proBadgeSmallText}>PRO</Text>
        </View>
      </Pressable>

      <View style={styles.bottomActionsRow}>
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>💾 Save</Text>
        </Pressable>
        <Pressable style={styles.ctaButtonSmall} onPress={() => setPhase('share')}>
          <Text style={styles.ctaButtonSmallText}>⬆ Share the shock</Text>
        </Pressable>
      </View>

      <Text style={styles.disclaimer}>Estimates only. Check prepayment charges with your lender.</Text>
    </Screen>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

function ShareIcon({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.shareIconItem}>
      <View style={styles.shareIconCircle}>
        <Text style={styles.shareIconGlyph}>{icon}</Text>
      </View>
      <Text style={styles.shareIconLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flexScreen: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  title: { color: colors.text, fontSize: 18, fontWeight: '900' },
  titleFaint: { color: colors.textFaint, fontWeight: '700', fontSize: 14 },
  stepLabel: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  subtitle: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.red + '22', borderColor: colors.red },
  typeIcon: { fontSize: 16, marginBottom: 4 },
  typeText: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  typeTextActive: { color: colors.red },

  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginBottom: 14 },
  cardLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  cardLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabelValue: { color: colors.red, fontWeight: '800', fontSize: 13 },
  stepperValue: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center', marginVertical: 10 },
  bankEmiLabel: { color: colors.textFaint, fontSize: 11, textAlign: 'right', marginBottom: 12 },
  bigEmiSubtitle: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginBottom: 12 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 12 },
  stepperButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  stepperText: { color: colors.text, fontSize: 20, fontWeight: '900' },
  bankEmiChip: { backgroundColor: colors.cardAlt, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  bankEmiChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  bigEmiResultRow: { backgroundColor: colors.green + '14', borderRadius: 12, paddingVertical: 8, marginTop: 10, alignItems: 'center' },
  bigEmiResultText: { color: colors.green, fontSize: 12, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { backgroundColor: colors.cardAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.red },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#fff' },

  summaryCard: { flexDirection: 'row', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginBottom: 16 },
  summaryCol: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: colors.border },
  summaryLabel: { color: colors.textFaint, fontSize: 11 },
  summaryValue: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 4 },
  summaryUnit: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },

  ctaButton: { backgroundColor: colors.red, borderRadius: 20, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  ctaButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.red },

  splitHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  splitLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  splitBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 14 },
  splitBarLoan: { backgroundColor: colors.blue },
  splitBarInterest: { backgroundColor: colors.red },

  loanFreeBadge: { alignSelf: 'center', backgroundColor: colors.green + '22', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  loanFreeText: { color: colors.green, fontWeight: '800', fontSize: 13 },

  resultPanel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 16, alignItems: 'center', marginBottom: 14 },
  resultEyebrow: { color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  resultValue: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 4 },
  panelHint: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
  jarWrap: { alignItems: 'center', marginVertical: 10 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.textFaint, fontSize: 12 },
  legendValue: { color: colors.text, fontSize: 12, fontWeight: '800' },

  fixedFooter: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg },
  bottomRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  bottomActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  secondaryButtonText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  ctaButtonSmall: { flex: 1.3, backgroundColor: colors.red, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  ctaButtonDisabled: { opacity: 0.4 },
  ctaButtonSmallText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  heroEyebrow: { color: colors.textFaint, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  heroValue: { color: colors.red, fontSize: 30, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  heroSubtext: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2, marginBottom: 12 },

  sectionLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  tipCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 10, gap: 10 },
  tipTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
  tipSubtitle: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  tipBadge: { backgroundColor: colors.green + '22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  tipBadgeText: { color: colors.green, fontSize: 11, fontWeight: '800' },

  planLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, marginTop: 4 },
  planLinkText: { color: colors.link, fontWeight: '700', fontSize: 13 },
  proBadgeSmall: { backgroundColor: colors.gold + '22', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  proBadgeSmallText: { color: colors.gold, fontSize: 9, fontWeight: '900' },

  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabButtonActive: { backgroundColor: colors.red },
  tabButtonActiveGreen: { backgroundColor: colors.green },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#fff' },

  compareRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  compareCol: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, alignItems: 'center' },
  compareColLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  compareColValue: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 4 },
  compareColSub: { color: colors.textFaint, fontSize: 10, marginTop: 2 },

  savingsBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.green + '14', borderWidth: 1, borderColor: colors.green + '44', borderRadius: 18, padding: 16, marginBottom: 16 },
  savingsLabel: { color: colors.textFaint, fontSize: 11 },
  savingsValue: { color: colors.green, fontSize: 16, fontWeight: '900', marginTop: 4 },

  disclaimer: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  exploreLink: { color: colors.link, fontSize: 11, fontWeight: '700' },

  shareCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.red + '44', borderRadius: 22, padding: 18, alignItems: 'center', marginBottom: 16 },
  shareBrand: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 8 },
  shareLine: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  shareValue: { color: colors.red, fontSize: 18, fontWeight: '900' },
  shareDisclaimer: { color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: 10 },
  shareIconsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  shareIconItem: { alignItems: 'center', gap: 4 },
  shareIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  shareIconGlyph: { fontSize: 18 },
  shareIconLabel: { color: colors.textFaint, fontSize: 10 },
});
