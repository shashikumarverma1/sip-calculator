import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/components/ui/theme';
import { BallGrid, type PartialBall } from '@/components/jar/BallGrid';
import { CustomValueKeypad } from '@/components/ui/CustomValueKeypad';
import {
  simulateFreedom,
  foreverCorpusWithInflation,
  type FreedomMonth,
} from '@/lib/finance/freedom';
import { computeLumpsumFV } from '@/lib/finance/lumpsum';
import { computeSipFV } from '@/lib/finance/sip';
import { requiredMonthlySip } from '@/lib/finance/goal';
import { createJar, familyTotal, type JarState, type Ball } from '@/lib/balls/types';
import { addValue, removeValue } from '@/lib/balls/engine';
import { formatINR, formatCompactINR } from '@/lib/format';

type Phase = 'setup' | 'playing' | 'result' | 'closegap' | 'share';
type CustomField = 'corpus' | 'expense' | 'rate' | null;

const CORPUS_PRESETS = [500000, 1000000, 2500000, 5000000];
const EXPENSE_PRESETS = [10000, 25000, 50000, 100000];
const RATE_PRESETS = [7, 9, 11];
const GAP_YEAR_OPTIONS = [5, 10, 15, 20];
const INFLATION_PCT = 6;
const CHART_HORIZON_YEARS = 50;

interface YearFlow {
  interestEarned: number;
  expense: number;
}

/** Derives per-year growth/spend from the monthly simulation's real balance trajectory, so the
 * jar totals always match the underlying simulation exactly. */
function buildYearlyFlows(corpus: number, ratePct: number, schedule: FreedomMonth[]): YearFlow[] {
  const monthlyRate = ratePct / 12 / 100;
  let prevBalance = corpus;
  const perMonth = schedule.map((row) => {
    const grown = prevBalance * (1 + monthlyRate);
    const interestEarned = grown - prevBalance;
    prevBalance = row.balance;
    return { interestEarned, expense: row.expense };
  });
  const years: YearFlow[] = [];
  for (let i = 0; i < perMonth.length; i += 12) {
    const chunk = perMonth.slice(i, i + 12);
    years.push({
      interestEarned: chunk.reduce((s, m) => s + Math.max(m.interestEarned, 0), 0),
      expense: chunk.reduce((s, m) => s + m.expense, 0),
    });
  }
  return years;
}

interface YearSnapshot {
  corpusBalls: Ball[];
  spentBalls: Ball[];
  corpusPartials: PartialBall[];
  spentPartials: PartialBall[];
}

function snapshotJars(corpusJar: JarState, spentJar: JarState): YearSnapshot {
  return {
    corpusBalls: [...corpusJar.balls],
    spentBalls: [...spentJar.balls],
    corpusPartials: [{ family: 'returns', amount: corpusJar.partial.returns }],
    spentPartials: [{ family: 'expense', amount: spentJar.partial.expense }],
  };
}

/** Year-by-year snapshots of the draining "savings left" jar and the filling "spent on living"
 * jar — precomputed once so playback is just an array lookup. */
function buildSnapshots(corpus: number, yearlyFlows: YearFlow[]) {
  const corpusJar = createJar('corpus');
  const spentJar = createJar('spent');
  addValue(corpusJar, corpus, 'returns', 0);

  const snapshots: YearSnapshot[] = [snapshotJars(corpusJar, spentJar)];
  yearlyFlows.forEach((f, i) => {
    const year = i + 1;
    if (f.interestEarned > 0) addValue(corpusJar, f.interestEarned, 'returns', year);
    const removable = Math.min(f.expense, familyTotal(corpusJar, 'returns'));
    if (removable > 0) removeValue(corpusJar, removable, 'returns', year);
    if (f.expense > 0) addValue(spentJar, f.expense, 'expense', year);
    snapshots.push(snapshotJars(corpusJar, spentJar));
  });
  return snapshots;
}

export default function FreedomScreen() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [corpus, setCorpus] = useState(1000000);
  const [monthlyExpense, setMonthlyExpense] = useState(10000);
  const [ratePct, setRatePct] = useState(11);
  const [inflationOn, setInflationOn] = useState(true);
  const [age, setAge] = useState<number | null>(35);
  const [currentYear, setCurrentYear] = useState(0);
  const [customField, setCustomField] = useState<CustomField>(null);
  const [tryExpense, setTryExpense] = useState(monthlyExpense);
  const [gapYears, setGapYears] = useState(10);
  const [shareTab, setShareTab] = useState<'percent' | 'duration'>('percent');

  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflationPct = inflationOn ? INFLATION_PCT : 0;

  useEffect(() => setTryExpense(monthlyExpense), [monthlyExpense]);

  const sim = useMemo(
    () => simulateFreedom(corpus, ratePct, monthlyExpense, inflationPct, CHART_HORIZON_YEARS * 12),
    [corpus, ratePct, monthlyExpense, inflationPct],
  );
  const yearlyFlows = useMemo(() => buildYearlyFlows(corpus, ratePct, sim.schedule), [corpus, ratePct, sim.schedule]);
  const totalYears = yearlyFlows.length;
  const snapshots = useMemo(() => buildSnapshots(corpus, yearlyFlows), [corpus, yearlyFlows]);
  const lastsForever = sim.monthsSurvived == null;

  const foreverTarget = useMemo(() => foreverCorpusWithInflation(ratePct, monthlyExpense, inflationPct), [ratePct, monthlyExpense, inflationPct]);
  const meterPct = Number.isFinite(foreverTarget) ? Math.min(100, Math.round((corpus / foreverTarget) * 100)) : 0;
  const runOutAge = age != null && !lastsForever ? age + sim.years : null;

  const trySim = useMemo(
    () => simulateFreedom(corpus, ratePct, tryExpense, inflationPct, CHART_HORIZON_YEARS * 12),
    [corpus, ratePct, tryExpense, inflationPct],
  );

  // ---- Close the gap: SIP needed so the corpus hits the inflation-aware "free forever" target
  // by the chosen horizon, on top of the existing corpus simply growing on its own.
  const gapTargetExpense = monthlyExpense * Math.pow(1 + inflationPct / 100, gapYears);
  const gapTarget = foreverCorpusWithInflation(ratePct, gapTargetExpense, inflationPct);
  const gapLumpsumGrowth = computeLumpsumFV(corpus, ratePct, gapYears).total;
  const gapAmount = Math.max(gapTarget - gapLumpsumGrowth, 0);
  const gapRequiredMonthly = Number.isFinite(gapAmount) ? requiredMonthlySip(gapAmount, ratePct, Math.max(gapYears, 1)) : 0;
  const gapSipContribution = computeSipFV(gapRequiredMonthly, ratePct, gapYears).total;

  // Clamped against the *current* inputs' horizon: if the user edits corpus/expense/rate while
  // `currentYear` still reflects a longer-lived previous run, snapshots/yearlyFlows (freshly
  // resized by useMemo) would otherwise be indexed out of bounds for a render or two.
  const safeYear = Math.min(currentYear, totalYears);
  const row = safeYear === 0 ? { balance: corpus } : { balance: Math.max(sim.schedule[safeYear * 12 - 1]?.balance ?? 0, 0) };
  const spentSoFar = yearlyFlows.slice(0, safeYear).reduce((s, f) => s + f.expense, 0);
  const snap = snapshots[safeYear];
  const thisYearFlow = safeYear > 0 ? yearlyFlows[safeYear - 1] : { interestEarned: 0, expense: 0 };
  const returnsCoveredPct = thisYearFlow.expense > 0 ? Math.round((thisYearFlow.interestEarned / thisYearFlow.expense) * 100) : 0;

  const stopPlayback = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    stopPlayback();
    setCurrentYear(0);
    const perYearMs = Math.max(12000 / totalYears, 150);
    let y = 1;
    const step = () => {
      if (y > totalYears) {
        timerRef.current = null;
        return;
      }
      setCurrentYear(y);
      y++;
      timerRef.current = setTimeout(step, perYearMs);
    };
    step();
  }, [totalYears, stopPlayback]);

  useEffect(() => {
    if (phase === 'playing') play();
    return stopPlayback;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const skipToEnd = () => {
    stopPlayback();
    setCurrentYear(totalYears);
  };
  const goSetup = () => {
    stopPlayback();
    setCurrentYear(0);
    setPhase('setup');
  };
  const startSim = () => setPhase('playing');
  const seeVerdict = () => {
    stopPlayback();
    setCurrentYear(totalYears);
    setPhase('result');
  };
  const animationDone = safeYear >= totalYears;

  // ---------------- SETUP ----------------
  if (phase === 'setup') {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Financial Freedom</Text>
            <Text style={styles.stepLabel}>If you stopped working today, how long would you last</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Money I have saved</Text>
          <Text style={styles.stepperValue}>{formatINR(corpus)}</Text>
          <View style={styles.chipRow}>
            {CORPUS_PRESETS.map((v) => (
              <Pressable key={v} style={[styles.chip, corpus === v && styles.chipActive]} onPress={() => setCorpus(v)}>
                <Text style={[styles.chipText, corpus === v && styles.chipTextActive]}>{formatCompactINR(v).replace('₹', '')}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.chip, !CORPUS_PRESETS.includes(corpus) && styles.chipActive]} onPress={() => setCustomField('corpus')}>
              <Text style={[styles.chipText, !CORPUS_PRESETS.includes(corpus) && styles.chipTextActive]}>
                {!CORPUS_PRESETS.includes(corpus) ? formatCompactINR(corpus) : 'Other'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>I spend every month</Text>
          <Text style={styles.stepperValue}>{formatINR(monthlyExpense)}</Text>
          <View style={styles.chipRow}>
            {EXPENSE_PRESETS.map((v) => (
              <Pressable key={v} style={[styles.chip, monthlyExpense === v && styles.chipActive]} onPress={() => setMonthlyExpense(v)}>
                <Text style={[styles.chipText, monthlyExpense === v && styles.chipTextActive]}>{formatCompactINR(v).replace('₹', '')}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.chip, !EXPENSE_PRESETS.includes(monthlyExpense) && styles.chipActive]} onPress={() => setCustomField('expense')}>
              <Text style={[styles.chipText, !EXPENSE_PRESETS.includes(monthlyExpense) && styles.chipTextActive]}>
                {!EXPENSE_PRESETS.includes(monthlyExpense) ? formatCompactINR(monthlyExpense) : 'Other'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Savings earn</Text>
            <Pressable onPress={() => setCustomField('rate')}>
              <Text style={styles.cardLabelValue}>{ratePct}% p.a. ✎</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {RATE_PRESETS.map((v) => (
              <Pressable key={v} style={[styles.chip, ratePct === v && styles.chipActive]} onPress={() => setRatePct(v)}>
                <Text style={[styles.chipText, ratePct === v && styles.chipTextActive]}>{v}%</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.chip, !RATE_PRESETS.includes(ratePct) && styles.chipActive]} onPress={() => setCustomField('rate')}>
              <Text style={[styles.chipText, !RATE_PRESETS.includes(ratePct) && styles.chipTextActive]}>
                {!RATE_PRESETS.includes(ratePct) ? `${ratePct}%` : 'Other'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleTitle}>Prices rise every year</Text>
            <Text style={styles.toggleSubtitle}>Inflation {INFLATION_PCT}% · {inflationOn ? 'on' : 'off'}</Text>
          </View>
          <Switch value={inflationOn} onValueChange={setInflationOn} trackColor={{ true: colors.green, false: colors.border }} />
        </View>

        <View style={styles.ageRow}>
          <Text style={styles.cardLabel}>My age (optional)</Text>
          <View style={styles.stepperRow}>
            <Pressable style={styles.stepperButton} onPress={() => setAge((a) => Math.max(18, (a ?? 30) - 1))}>
              <Text style={styles.stepperText}>−</Text>
            </Pressable>
            <Text style={styles.ageValue}>{age ?? '—'}</Text>
            <Pressable style={styles.stepperButton} onPress={() => setAge((a) => Math.min(90, (a ?? 29) + 1))}>
              <Text style={styles.stepperText}>+</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.ctaButton} onPress={startSim}>
          <Text style={styles.ctaButtonText}>▶ Will my money last?</Text>
        </Pressable>

        {customField === 'corpus' && (
          <CustomValueKeypad
            title="Money saved"
            suffix="₹"
            initialValue={corpus}
            min={1000}
            max={1000000000}
            allowDecimal={false}
            doubleZero
            previewFormatter={formatCompactINR}
            hint="Allowed: ₹1,000 to ₹100 Cr"
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setCorpus(Math.round(v));
              setCustomField(null);
            }}
          />
        )}
        {customField === 'expense' && (
          <CustomValueKeypad
            title="Monthly spending"
            suffix="₹"
            initialValue={monthlyExpense}
            min={1000}
            max={5000000}
            allowDecimal={false}
            doubleZero
            previewFormatter={formatCompactINR}
            hint="Allowed: ₹1,000 to ₹50L"
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setMonthlyExpense(Math.round(v));
              setCustomField(null);
            }}
          />
        )}
        {customField === 'rate' && (
          <CustomValueKeypad
            title="Yearly return"
            suffix="%"
            initialValue={ratePct}
            min={0.1}
            max={30}
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setRatePct(v);
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
          <Text style={styles.subtitle}>
            {formatCompactINR(corpus)} saved · {formatCompactINR(monthlyExpense)}/mo · {inflationPct}% inflation
          </Text>
          <View style={styles.headerRow}>
            <Pressable style={styles.iconButton} onPress={goSetup} hitSlop={10}>
              <Text style={styles.iconText}>‹</Text>
            </Pressable>
            <Text style={[styles.title, { flex: 1, textAlign: 'center' }]}>
              {age != null ? `Age ${age + safeYear}` : `Year ${safeYear}`} <Text style={styles.titleFaint}>/ year {safeYear}</Text>
            </Text>
            <Pressable style={styles.iconButton} onPress={skipToEnd} hitSlop={10}>
              <Text style={styles.iconText}>›|</Text>
            </Pressable>
          </View>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(safeYear / totalYears) * 100}%` }]} />
            </View>
            {safeYear > 0 && <Text style={styles.progressHint}>Returns paid for this year's spending {returnsCoveredPct}%</Text>}
          </View>

          {animationDone && !lastsForever && (
            <View style={styles.ranOutBadge}>
              <Text style={styles.ranOutText}>
                Money ran out{runOutAge != null ? ` at age ${runOutAge}` : ''} · {sim.years} yrs {sim.months} mo
              </Text>
            </View>
          )}

          <View style={styles.resultPanel}>
            <Text style={styles.resultEyebrow}>Savings left</Text>
            <Text style={styles.resultValue}>{formatINR(row.balance)}</Text>
            <View style={styles.jarWrap}>
              <BallGrid width={300} height={140} balls={snap.corpusBalls} partials={snap.corpusPartials} />
            </View>
          </View>

          <View style={styles.resultPanel}>
            <Text style={styles.resultEyebrow}>Spent on living</Text>
            <Text style={styles.resultValue}>{formatINR(spentSoFar)}</Text>
            <View style={styles.jarWrap}>
              <BallGrid width={300} height={160} balls={snap.spentBalls} partials={snap.spentPartials} />
            </View>
          </View>
        </Screen>

        <View style={[styles.fixedFooter, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.bottomRow}>
            <Pressable style={styles.secondaryButton} onPress={play}>
              <Text style={styles.secondaryButtonText}>Replay</Text>
            </Pressable>
            <Pressable style={[styles.ctaButtonSmall, !animationDone && styles.ctaButtonDisabled]} disabled={!animationDone} onPress={seeVerdict}>
              <Text style={styles.ctaButtonSmallText}>See my verdict →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ---------------- CLOSE THE GAP ----------------
  if (phase === 'closegap') {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => setPhase('result')} hitSlop={10}>
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Close the gap</Text>
            <Text style={styles.stepLabel}>When do you want to be free?</Text>
          </View>
        </View>

        <View style={styles.chipRow}>
          {GAP_YEAR_OPTIONS.map((y) => (
            <Pressable key={y} style={[styles.chip, gapYears === y && styles.chipActive]} onPress={() => setGapYears(y)}>
              <Text style={[styles.chipText, gapYears === y && styles.chipTextActive]}>{y} yrs</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.inYearsLabel}>In {gapYears} years</Text>

        <View style={styles.freeLineCard}>
          <View style={styles.freeLineBarOuter}>
            <View style={[styles.freeLineBarInvested, { height: `${Math.min((gapLumpsumGrowth / gapTarget) * 100, 100)}%` }]} />
            <View style={[styles.freeLineBarSip, { height: `${Math.min((gapSipContribution / gapTarget) * 100, 100)}%` }]} />
          </View>
        </View>

        <Text style={styles.gapHeadline}>
          Start a monthly SIP of {formatINR(gapRequiredMonthly)} for {gapYears} years at {ratePct}%
        </Text>
        <Text style={styles.gapSubline}>Today's {formatCompactINR(corpus)} grows to {formatCompactINR(gapLumpsumGrowth)}</Text>
        <Text style={styles.gapSubline}>SIP adds {formatCompactINR(gapSipContribution)}</Text>

        <View style={styles.gapStatsRow}>
          <View>
            <Text style={styles.gapStatLabel}>Your spending then</Text>
            <Text style={styles.gapStatValue}>{formatINR(Math.round(gapTargetExpense))}/mo</Text>
          </View>
          <View>
            <Text style={styles.gapStatLabel}>Free-forever target then</Text>
            <Text style={styles.gapStatValue}>{formatCompactINR(gapTarget)}</Text>
          </View>
        </View>
        <Text style={styles.gapNote}>Target is higher because prices rise {inflationPct}%/yr</Text>

        <Pressable style={styles.ctaButton} onPress={() => router.push('/sip')}>
          <Text style={styles.ctaButtonText}>Start this SIP jar →</Text>
        </Pressable>

        <Text style={styles.disclaimer}>Illustration using steady returns. Not financial advice.</Text>
      </Screen>
    );
  }

  // ---------------- SHARE ----------------
  if (phase === 'share') {
    return (
      <Screen contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => setPhase('result')} hitSlop={10}>
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <Text style={[styles.title, { flex: 1, textAlign: 'center' }]}>Share my Freedom Meter</Text>
        </View>

        <View style={styles.tabRow}>
          <Pressable style={[styles.tabButton, shareTab === 'percent' && styles.tabButtonActive]} onPress={() => setShareTab('percent')}>
            <Text style={[styles.tabText, shareTab === 'percent' && styles.tabTextActive]}>Freedom %</Text>
          </Pressable>
          <Pressable style={[styles.tabButton, shareTab === 'duration' && styles.tabButtonActive]} onPress={() => setShareTab('duration')}>
            <Text style={[styles.tabText, shareTab === 'duration' && styles.tabTextActive]}>How long I last</Text>
          </Pressable>
        </View>

        <View style={styles.shareCard}>
          <Text style={styles.shareBrand}>🫙 JarUp</Text>
          <Text style={styles.shareTitle}>My Financial Freedom Meter</Text>
          <View style={styles.meterRing}>
            <Text style={styles.meterRingValue}>{shareTab === 'percent' ? `${meterPct}%` : (lastsForever ? '∞' : `${sim.years}y`)}</Text>
            <Text style={styles.meterRingSub}>{shareTab === 'percent' ? 'of the way' : 'it lasts'}</Text>
          </View>
          <Text style={styles.shareFooterLine}>Building my forever jar, one ball at a time.</Text>
          <Text style={styles.shareFindYours}>Find yours on JarUp</Text>
          <Text style={styles.shareDisclaimer}>Card never shows your savings or spending amounts</Text>
        </View>

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
  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => router.replace('/')} hitSlop={10}>
          <Text style={styles.iconText}>✕</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.subtitle}>
            {formatCompactINR(corpus)} saved · {ratePct}% · {inflationPct}% inflation{age != null ? ` · age ${age}` : ''}
          </Text>
        </View>
        <Pressable style={styles.iconButton} onPress={goSetup} hitSlop={10}>
          <Text style={styles.iconText}>✎</Text>
        </Pressable>
      </View>

      <Text style={styles.heroEyebrow}>If you stop working today, your money lasts</Text>
      <Text style={styles.heroValue}>{lastsForever ? 'Forever 🎉' : `${sim.years} yrs ${sim.months} mo`}</Text>
      {!lastsForever && (
        <Text style={styles.heroSubtext}>Runs out around{runOutAge != null ? ` age ${runOutAge}` : ` year ${sim.years}`}</Text>
      )}

      <View style={styles.meterHeaderRow}>
        <Text style={styles.meterLabel}>Freedom Meter</Text>
        <Text style={styles.meterPct}>{meterPct}%</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${meterPct}%` }]} />
      </View>
      <Text style={styles.meterSub}>
        You have {formatCompactINR(corpus)} · Free forever at {Number.isFinite(foreverTarget) ? formatCompactINR(foreverTarget) : '∞'}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Try spending less</Text>
        <Text style={styles.trySpendingValue}>{formatINR(tryExpense)}<Text style={styles.summaryUnit}>/mo</Text></Text>
        <View style={styles.stepperRow}>
          <Pressable style={styles.stepperButton} onPress={() => setTryExpense((v) => Math.max(1000, v - 500))}>
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <Pressable style={styles.bankEmiChip} onPress={() => setTryExpense(monthlyExpense)}>
            <Text style={styles.bankEmiChipText}>Now</Text>
          </Pressable>
          <Pressable style={styles.stepperButton} onPress={() => setTryExpense((v) => v + 500)}>
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.chipRow}>
          {[0.1, 0.2, 0.3].map((pct) => (
            <Pressable key={pct} style={styles.chip} onPress={() => setTryExpense(Math.round(monthlyExpense * (1 - pct)))}>
              <Text style={styles.chipText}>-{pct * 100}%</Text>
            </Pressable>
          ))}
        </View>
        {tryExpense !== monthlyExpense && (
          <View style={styles.bigEmiResultRow}>
            <Text style={styles.bigEmiResultText}>
              → lasts {trySim.monthsSurvived == null ? 'forever' : `${trySim.years}y ${trySim.months}m`}
            </Text>
          </View>
        )}
      </View>

      <Pressable style={styles.planLink} onPress={() => setPhase('closegap')}>
        <Text style={styles.planLinkText}>Close the gap · Find the SIP that makes you free</Text>
      </Pressable>

      <View style={styles.bottomActionsRow}>
        <Pressable style={styles.secondaryButton} onPress={skipToEnd}>
          <Text style={styles.secondaryButtonText}>Explore years</Text>
        </Pressable>
        <Pressable style={styles.ctaButtonSmall} onPress={() => setPhase('share')}>
          <Text style={styles.ctaButtonSmallText}>⬆ Share</Text>
        </Pressable>
      </View>

      <Text style={styles.disclaimer}>Assumes steady returns and inflation. Real markets go up and down.</Text>
    </Screen>
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
  subtitle: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 4 },

  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginBottom: 14 },
  cardLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  cardLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabelValue: { color: colors.green, fontWeight: '800', fontSize: 13 },
  stepperValue: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center', marginVertical: 10 },
  trySpendingValue: { color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center', marginVertical: 8 },
  summaryUnit: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { backgroundColor: colors.cardAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.green },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#06240f' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 14 },
  toggleTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  toggleSubtitle: { color: colors.textFaint, fontSize: 11, marginTop: 2 },

  ageRow: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  stepperButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  stepperText: { color: colors.text, fontSize: 18, fontWeight: '900' },
  ageValue: { color: colors.text, fontSize: 18, fontWeight: '800', minWidth: 28, textAlign: 'center' },

  ctaButton: { backgroundColor: colors.green, borderRadius: 20, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  ctaButtonText: { color: '#06240f', fontWeight: '900', fontSize: 16 },

  progressRow: { marginBottom: 12 },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.green },
  progressHint: { color: colors.textFaint, fontSize: 10, textAlign: 'right', marginTop: 4 },

  ranOutBadge: { alignSelf: 'center', backgroundColor: colors.red + '22', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  ranOutText: { color: colors.red, fontWeight: '800', fontSize: 12 },

  resultPanel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 16, alignItems: 'center', marginBottom: 14 },
  resultEyebrow: { color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  resultValue: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 4 },
  jarWrap: { alignItems: 'center', marginVertical: 10 },

  fixedFooter: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg },
  bottomRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  bottomActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  secondaryButtonText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  ctaButtonSmall: { flex: 1.3, backgroundColor: colors.green, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  ctaButtonDisabled: { opacity: 0.4 },
  ctaButtonSmallText: { color: '#06240f', fontWeight: '900', fontSize: 14 },

  heroEyebrow: { color: colors.textFaint, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  heroValue: { color: colors.green, fontSize: 30, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  heroSubtext: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2, marginBottom: 12 },

  meterHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, marginTop: 8 },
  meterLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  meterPct: { color: colors.green, fontSize: 12, fontWeight: '800' },
  meterTrack: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  meterFill: { height: 8, backgroundColor: colors.green },
  meterSub: { color: colors.textFaint, fontSize: 11, marginBottom: 16 },

  bigEmiResultRow: { backgroundColor: colors.green + '14', borderRadius: 12, paddingVertical: 8, marginTop: 10, alignItems: 'center' },
  bigEmiResultText: { color: colors.green, fontSize: 12, fontWeight: '800' },
  bankEmiChip: { backgroundColor: colors.cardAlt, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  bankEmiChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },

  planLink: { alignItems: 'center', marginBottom: 20, marginTop: 4 },
  planLinkText: { color: colors.link, fontWeight: '700', fontSize: 13, textAlign: 'center' },

  disclaimer: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 16 },

  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabButtonActive: { backgroundColor: colors.green },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#06240f' },

  inYearsLabel: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginBottom: 12 },
  freeLineCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, height: 160, padding: 12, marginBottom: 16, alignItems: 'center' },
  freeLineBarOuter: { width: 60, height: '100%', borderRadius: 10, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.cardAlt },
  freeLineBarInvested: { backgroundColor: colors.blue, width: '100%' },
  freeLineBarSip: { backgroundColor: colors.gold, width: '100%' },

  gapHeadline: { color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  gapSubline: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginBottom: 2 },
  gapStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, marginBottom: 8 },
  gapStatLabel: { color: colors.textFaint, fontSize: 11, textAlign: 'center' },
  gapStatValue: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 2 },
  gapNote: { color: colors.textFaint, fontSize: 10, textAlign: 'center', marginBottom: 20 },

  shareCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.green + '44', borderRadius: 22, padding: 18, alignItems: 'center', marginBottom: 16 },
  shareBrand: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 4 },
  shareTitle: { color: colors.textMuted, fontSize: 13, marginBottom: 16 },
  meterRing: { width: 140, height: 140, borderRadius: 70, borderWidth: 10, borderColor: colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  meterRingValue: { color: colors.green, fontSize: 28, fontWeight: '900' },
  meterRingSub: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  shareFooterLine: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  shareFindYours: { color: colors.link, fontSize: 12, fontWeight: '700', marginTop: 4 },
  shareDisclaimer: { color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: 12 },
  shareIconsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  shareIconItem: { alignItems: 'center', gap: 4 },
  shareIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  shareIconGlyph: { fontSize: 18 },
  shareIconLabel: { color: colors.textFaint, fontSize: 10 },
});
