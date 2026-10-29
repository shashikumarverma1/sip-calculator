import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/components/ui/theme';
import { BallGrid } from '@/components/jar/BallGrid';
import { CustomValueKeypad } from '@/components/ui/CustomValueKeypad';
import {
  computeGoalYearly,
  requiredMonthlyForGoal,
  requiredMonthlyForGoalWithStepUp,
  type GoalYearBreakdown,
} from '@/lib/finance/goal';
import { createJar, jarTotal, familyTotal, type JarState } from '@/lib/balls/types';
import { addValue } from '@/lib/balls/engine';
import { formatINR, formatCompactINR } from '@/lib/format';
import { useGoalsStore } from '@/store/goalsStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
/** Screen padding (16×2) + card padding (16×2) + the gap before the goal progress bar + its width. */
const GOAL_JAR_WIDTH = SCREEN_WIDTH - 32 - 32 - 14 - 20;
const GOAL_JAR_HEIGHT = 320;

type Phase = 'setup' | 'configure' | 'playing' | 'result' | 'mygoals';
type CustomField = 'cost' | 'saved' | null;

interface GoalPreset {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  defaultCost: number;
}

const GOAL_PRESETS: GoalPreset[] = [
  { key: 'home', icon: '🏠', title: 'Home', subtitle: 'Down payment · ~₹20 L', defaultCost: 2000000 },
  { key: 'education', icon: '🎓', title: "Child's education", subtitle: 'College · ~₹25 L', defaultCost: 2500000 },
  { key: 'wedding', icon: '💍', title: 'Wedding', subtitle: '~₹15 L', defaultCost: 1500000 },
  { key: 'car', icon: '🚗', title: 'Car', subtitle: '~₹8 L', defaultCost: 800000 },
  { key: 'trip', icon: '✈️', title: 'Dream trip', subtitle: '~₹3 L', defaultCost: 300000 },
  { key: 'custom', icon: '✨', title: 'Something else', subtitle: 'Name your own goal', defaultCost: 500000 },
];

const COST_PRESETS = [1000000, 2000000, 3000000, 5000000];
const DURATION_PRESETS = [3, 5, 8, 10, 15];
const SAVED_PRESETS = [0, 100000, 200000, 500000];
const RATE_PRESETS = [8, 10, 12];
const INFLATION_PCT = 6;

const remainder = (amount: number) => amount - Math.floor(amount / 1000) * 1000;

function buildJar(breakdown: GoalYearBreakdown[], alreadySaved: number): JarState {
  const jar = createJar('goal');
  if (alreadySaved > 0) addValue(jar, alreadySaved, 'principal', 0);
  let prevInvested = alreadySaved;
  let prevReturns = 0;
  for (const row of breakdown) {
    addValue(jar, row.invested - prevInvested, 'principal', row.year);
    addValue(jar, row.returns - prevReturns, 'returns', row.year);
    prevInvested = row.invested;
    prevReturns = row.returns;
  }
  return jar;
}

function valueAfterMonths(alreadySaved: number, monthly: number, ratePct: number, months: number): number {
  const r = ratePct / 12 / 100;
  let balance = alreadySaved;
  for (let i = 0; i < months; i++) balance = (balance + monthly) * (1 + r);
  return balance;
}

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH_NAME = new Date().toLocaleString('default', { month: 'long' });
const CURRENT_MONTH_KEY = `${CURRENT_YEAR}-${new Date().getMonth()}`;

export default function GoalScreen() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [preset, setPreset] = useState<GoalPreset>(GOAL_PRESETS[0]);
  const [goalName, setGoalName] = useState(GOAL_PRESETS[0].title);
  const [cost, setCost] = useState(GOAL_PRESETS[0].defaultCost);
  const [years, setYears] = useState(8);
  const [adjustInflation, setAdjustInflation] = useState(true);
  const [alreadySaved, setAlreadySaved] = useState(0);
  const [ratePct, setRatePct] = useState(12);
  const [stepUp, setStepUp] = useState<'flat' | 'stepup'>('flat');
  const [exploreYears, setExploreYears] = useState<number | null>(null);
  const [currentYear, setCurrentYear] = useState(0);
  const [customField, setCustomField] = useState<CustomField>(null);

  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { goals, addGoal, markMonthDone } = useGoalsStore();

  const effectiveYears = exploreYears ?? years;
  const inflatedCost = adjustInflation ? cost * Math.pow(1 + INFLATION_PCT / 100, effectiveYears) : cost;
  const requiredMonthly = useMemo(
    () => requiredMonthlyForGoal(inflatedCost, alreadySaved, ratePct, effectiveYears),
    [inflatedCost, alreadySaved, ratePct, effectiveYears],
  );
  const requiredMonthlyStepUp = useMemo(
    () => requiredMonthlyForGoalWithStepUp(inflatedCost, alreadySaved, ratePct, effectiveYears, 10),
    [inflatedCost, alreadySaved, ratePct, effectiveYears],
  );
  const monthlyForPlan = stepUp === 'stepup' ? requiredMonthlyStepUp : requiredMonthly;

  const breakdown = useMemo(
    () => computeGoalYearly(alreadySaved, requiredMonthly, ratePct, years),
    [alreadySaved, requiredMonthly, ratePct, years],
  );
  const jar = useMemo(() => buildJar(breakdown, alreadySaved), [breakdown, alreadySaved]);
  const finalTotal = jarTotal(jar);
  const finalInvested = familyTotal(jar, 'principal');
  const finalReturns = familyTotal(jar, 'returns');

  const safeYear = Math.min(currentYear, years);
  const current = safeYear === 0 ? { invested: alreadySaved, returns: 0, total: alreadySaved } : breakdown[safeYear - 1];
  const pctComplete = Math.min(100, Math.round((current.total / inflatedCost) * 100));
  const visibleBalls = useMemo(() => jar.balls.filter((b) => b.sourceYear <= safeYear), [jar, safeYear]);
  const currentPartials = [
    { family: 'principal' as const, amount: remainder(current.invested) },
    { family: 'returns' as const, amount: remainder(current.returns) },
  ];

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
  const pickPreset = (p: GoalPreset) => {
    setPreset(p);
    setGoalName(p.title);
    setCost(p.defaultCost);
    setPhase('configure');
  };
  const goConfigure = () => {
    stopPlayback();
    setCurrentYear(0);
    setExploreYears(null);
    setPhase('configure');
  };
  const fillJar = () => setPhase('playing');
  const seeMyPlan = () => {
    stopPlayback();
    setCurrentYear(years);
    setPhase('result');
  };
  const animationDone = safeYear >= years;

  const saveAndTrack = () => {
    addGoal({
      name: goalName,
      icon: preset.icon,
      targetCost: inflatedCost,
      alreadySaved,
      ratePct,
      years,
      startedAt: CURRENT_YEAR,
      monthlySip: Math.round(monthlyForPlan),
    });
    setPhase('mygoals');
  };

  // ---------------- SETUP (goal picker) ----------------
  if (phase === 'setup') {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Goal Jar</Text>
            <Text style={styles.stepLabel}>What are you saving for?</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {GOAL_PRESETS.map((p) => (
            <Pressable key={p.key} style={styles.presetTile} onPress={() => pickPreset(p)}>
              <Text style={styles.presetIcon}>{p.icon}</Text>
              <Text style={styles.presetTitle}>{p.title}</Text>
              <Text style={styles.presetSubtitle}>{p.subtitle}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.savedGoalsRow} onPress={() => setPhase('mygoals')}>
          <View>
            <Text style={styles.savedGoalsTitle}>My saved goals</Text>
            <Text style={styles.savedGoalsSubtitle}>{goals.length} goal{goals.length === 1 ? '' : 's'} · track every month</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Screen>
    );
  }

  // ---------------- CONFIGURE ----------------
  if (phase === 'configure') {
    const targetYear = CURRENT_YEAR + years;
    return (
      <Screen>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => setPhase('setup')} hitSlop={10}>
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <TextInput style={styles.titleInput} value={goalName} onChangeText={setGoalName} />
            <Text style={styles.stepLabel}>Tap the name to rename</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>It costs today</Text>
          <View style={styles.stepperRow}>
            <Pressable style={styles.stepperButton} onPress={() => setCost((c) => Math.max(50000, c - 50000))}>
              <Text style={styles.stepperText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{formatINR(cost)}</Text>
            <Pressable style={styles.stepperButton} onPress={() => setCost((c) => c + 50000)}>
              <Text style={styles.stepperText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {COST_PRESETS.map((v) => (
              <Pressable key={v} style={[styles.chip, cost === v && styles.chipActive]} onPress={() => setCost(v)}>
                <Text style={[styles.chipText, cost === v && styles.chipTextActive]}>{formatCompactINR(v).replace('₹', '')}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.chip, !COST_PRESETS.includes(cost) && styles.chipActive]} onPress={() => setCustomField('cost')}>
              <Text style={[styles.chipText, !COST_PRESETS.includes(cost) && styles.chipTextActive]}>
                {!COST_PRESETS.includes(cost) ? formatCompactINR(cost) : 'Other'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>I need it in {years} years · {targetYear}</Text>
          <View style={styles.chipRow}>
            {DURATION_PRESETS.map((y) => (
              <Pressable key={y} style={[styles.chip, years === y && styles.chipActive]} onPress={() => setYears(y)}>
                <Text style={[styles.chipText, years === y && styles.chipTextActive]}>{y}y</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Adjust for rising prices</Text>
            {adjustInflation && (
              <Text style={styles.toggleSubtitle}>
                Will cost about {formatINR(Math.round(inflatedCost))} in {targetYear} ({INFLATION_PCT}%/yr)
              </Text>
            )}
          </View>
          <Pressable style={[styles.switchTrack, adjustInflation && styles.switchTrackOn]} onPress={() => setAdjustInflation((v) => !v)}>
            <View style={[styles.switchThumb, adjustInflation && styles.switchThumbOn]} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Already saved for this</Text>
          <View style={styles.chipRow}>
            {SAVED_PRESETS.map((v) => (
              <Pressable key={v} style={[styles.chip, alreadySaved === v && styles.chipActive]} onPress={() => setAlreadySaved(v)}>
                <Text style={[styles.chipText, alreadySaved === v && styles.chipTextActive]}>{v === 0 ? 'Nothing' : formatCompactINR(v).replace('₹', '')}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.chip, !SAVED_PRESETS.includes(alreadySaved) && styles.chipActive]} onPress={() => setCustomField('saved')}>
              <Text style={[styles.chipText, !SAVED_PRESETS.includes(alreadySaved) && styles.chipTextActive]}>
                {!SAVED_PRESETS.includes(alreadySaved) ? formatCompactINR(alreadySaved) : 'Other'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Expected return</Text>
            <Text style={styles.cardLabelValue}>{ratePct}% p.a.</Text>
          </View>
          <View style={styles.chipRow}>
            {RATE_PRESETS.map((v) => (
              <Pressable key={v} style={[styles.chip, ratePct === v && styles.chipActive]} onPress={() => setRatePct(v)}>
                <Text style={[styles.chipText, ratePct === v && styles.chipTextActive]}>{v}%</Text>
              </Pressable>
            ))}
          </View>
          {years < 3 && <Text style={styles.hintText}>Goals under 3 years: safer options usually make more sense</Text>}
        </View>

        <Pressable style={styles.ctaButton} onPress={fillJar}>
          <Text style={styles.ctaButtonText}>▶ Fill my goal jar</Text>
        </Pressable>

        {customField === 'cost' && (
          <CustomValueKeypad
            title="Goal cost today"
            suffix="₹"
            initialValue={cost}
            min={10000}
            max={1000000000}
            allowDecimal={false}
            doubleZero
            previewFormatter={formatCompactINR}
            hint="Allowed: ₹10,000 to ₹100 Cr"
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setCost(Math.round(v));
              setCustomField(null);
            }}
          />
        )}
        {customField === 'saved' && (
          <CustomValueKeypad
            title="Already saved"
            suffix="₹"
            initialValue={alreadySaved}
            min={0}
            max={1000000000}
            allowDecimal={false}
            doubleZero
            previewFormatter={formatCompactINR}
            hint="Allowed: ₹0 to ₹100 Cr"
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setAlreadySaved(Math.round(v));
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
          <View style={styles.headerRow}>
            <Pressable style={styles.iconButton} onPress={goConfigure} hitSlop={10}>
              <Text style={styles.iconText}>‹</Text>
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.title}>{preset.icon} {goalName}</Text>
              <Text style={styles.stepLabel}>Year {safeYear} / {years}</Text>
            </View>
            <Pressable style={styles.iconButton} onPress={skipToEnd} hitSlop={10}>
              <Text style={styles.iconText}>›|</Text>
            </Pressable>
          </View>

          {animationDone && (
            <View style={styles.reachedBadge}>
              <Text style={styles.reachedText}>🎉 Goal reached! Your {goalName.toLowerCase()} fund is ready</Text>
            </View>
          )}

          <View style={styles.resultPanel}>
            <View style={styles.goalPanelHeader}>
              <View>
                <Text style={styles.resultEyebrow}>Goal {formatCompactINR(inflatedCost)}</Text>
                <Text style={styles.resultValue}>{formatCompactINR(current.total)}</Text>
              </View>
              <Text style={styles.pctText}>{pctComplete}%</Text>
            </View>
            <View style={styles.playingRow}>
              <BallGrid width={GOAL_JAR_WIDTH} height={GOAL_JAR_HEIGHT} balls={visibleBalls} partials={currentPartials} />
              <View style={[styles.goalBarOuter, { height: GOAL_JAR_HEIGHT }]}>
                <View style={[styles.goalBarFill, { height: `${pctComplete}%` }]} />
              </View>
            </View>
          </View>

          <Text style={styles.legendFooter}>
            You put in {formatCompactINR(current.invested)} · Growth {formatCompactINR(current.returns)} · % of goal
          </Text>
        </Screen>

        <View style={[styles.fixedFooter, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.bottomRow}>
            <Pressable style={styles.secondaryButton} onPress={play}>
              <Text style={styles.secondaryButtonText}>Replay</Text>
            </Pressable>
            <Pressable style={[styles.ctaButtonSmall, !animationDone && styles.ctaButtonDisabled]} disabled={!animationDone} onPress={seeMyPlan}>
              <Text style={styles.ctaButtonSmallText}>See my plan →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ---------------- MY GOALS ----------------
  if (phase === 'mygoals') {
    const doneThisMonth = goals.filter((g) => g.doneMonths.includes(CURRENT_MONTH_KEY)).length;
    const totalMonthly = goals.reduce((s, g) => s + g.monthlySip, 0);
    return (
      <Screen>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => router.replace('/')} hitSlop={10}>
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <Text style={[styles.title, { flex: 1 }]}>My Goals</Text>
          <Pressable style={styles.iconButton} onPress={() => setPhase('setup')} hitSlop={10}>
            <Text style={styles.iconText}>+</Text>
          </Pressable>
        </View>

        {goals.length === 0 ? (
          <Text style={styles.emptyText}>No goals saved yet. Tap + to add one.</Text>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>{CURRENT_MONTH_NAME} SIPs</Text>
                <Text style={styles.summaryValue}>{doneThisMonth} of {goals.length} done</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.summaryLabel}>Every month</Text>
                <Text style={styles.summaryValue}>{formatINR(totalMonthly)}</Text>
              </View>
            </View>

            {goals.map((g) => {
              const monthsDone = g.doneMonths.length;
              const saved = valueAfterMonths(g.alreadySaved, g.monthlySip, g.ratePct, monthsDone);
              const pct = Math.min(100, Math.round((saved / g.targetCost) * 100));
              const isDoneThisMonth = g.doneMonths.includes(CURRENT_MONTH_KEY);
              return (
                <View key={g.id} style={styles.goalRow}>
                  <View style={styles.goalRowHeader}>
                    <Text style={styles.goalRowTitle}>{g.icon} {g.name}</Text>
                    <Text style={styles.goalRowPct}>{pct}%</Text>
                  </View>
                  <View style={styles.goalRowTrack}>
                    <View style={[styles.goalRowFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.goalRowSub}>
                    {formatCompactINR(saved)} of {formatCompactINR(g.targetCost)} · by {g.startedAt + g.years}
                  </Text>
                  <Text style={styles.goalRowDue}>
                    {CURRENT_MONTH_NAME} SIP {isDoneThisMonth ? 'added' : 'due'} · {formatINR(g.monthlySip)}
                  </Text>
                  <Pressable
                    style={[styles.markDoneButton, isDoneThisMonth && styles.markDoneButtonDone]}
                    disabled={isDoneThisMonth}
                    onPress={() => markMonthDone(g.id, CURRENT_MONTH_KEY)}
                  >
                    <Text style={[styles.markDoneText, isDoneThisMonth && styles.markDoneTextDone]}>
                      {isDoneThisMonth ? `✓ Done for ${CURRENT_MONTH_NAME}` : `Mark ${CURRENT_MONTH_NAME} SIP done`}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        <Text style={styles.disclaimer}>We remind you on SIP day. Your data stays on this phone.</Text>
      </Screen>
    );
  }

  // ---------------- RESULT ----------------
  const targetYear = CURRENT_YEAR + years;
  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => router.replace('/')} hitSlop={10}>
          <Text style={styles.iconText}>✕</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.subtitle}>{preset.icon} {goalName} · {targetYear}</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={goConfigure} hitSlop={10}>
          <Text style={styles.iconText}>✎</Text>
        </Pressable>
      </View>

      <Text style={styles.heroEyebrow}>To have {formatCompactINR(inflatedCost)} by {targetYear}, put</Text>
      <Text style={styles.heroValue}>{formatINR(Math.round(monthlyForPlan))}</Text>
      <Text style={styles.heroSubtext}>every month for {years} years</Text>

      <View style={styles.sideBySideRow}>
        <Pressable style={[styles.stepUpTab, stepUp === 'flat' && styles.stepUpTabActive]} onPress={() => setStepUp('flat')}>
          <Text style={[styles.stepUpTabText, stepUp === 'flat' && styles.stepUpTabTextActive]}>Same every year</Text>
        </Pressable>
        <Pressable style={[styles.stepUpTab, stepUp === 'stepup' && styles.stepUpTabActive]} onPress={() => setStepUp('stepup')}>
          <Text style={[styles.stepUpTabText, stepUp === 'stepup' && styles.stepUpTabTextActive]}>Grow it 10% yearly</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Too much? Give it more time</Text>
      <View style={styles.chipRow}>
        {DURATION_PRESETS.map((y) => (
          <Pressable key={y} style={[styles.chip, (exploreYears ?? years) === y && styles.chipActive]} onPress={() => setExploreYears(y)}>
            <Text style={[styles.chipText, (exploreYears ?? years) === y && styles.chipTextActive]}>{y}yrs</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.statsRow}>
        <View>
          <Text style={styles.statLabel}>You will put in</Text>
          <Text style={styles.statValue}>{formatCompactINR(monthlyForPlan * effectiveYears * 12 + alreadySaved)}</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Jar grows by</Text>
          <Text style={styles.statValue}>{formatCompactINR(Math.max(inflatedCost - (monthlyForPlan * effectiveYears * 12 + alreadySaved), 0))}</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Price then ({INFLATION_PCT}% inflation)</Text>
          <Text style={styles.statValue}>{formatCompactINR(inflatedCost)}</Text>
        </View>
      </View>

      <Pressable style={styles.saveTrackRow} onPress={saveAndTrack}>
        <View style={{ flex: 1 }}>
          <Text style={styles.saveTrackTitle}>Save & track this goal</Text>
          <Text style={styles.saveTrackSubtitle}>Tick each month's SIP and watch the jar fill</Text>
        </View>
        <View style={styles.proBadgeSmall}>
          <Text style={styles.proBadgeSmallText}>PRO</Text>
        </View>
      </Pressable>

      <Pressable style={styles.ctaButton} onPress={() => router.push('/sip')}>
        <Text style={styles.ctaButtonText}>Start this SIP jar →</Text>
      </Pressable>

      <Text style={styles.disclaimer}>Assumes {ratePct}% yearly return. Markets go up and down. Not financial advice.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexScreen: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  title: { color: colors.text, fontSize: 18, fontWeight: '900' },
  titleInput: { color: colors.text, fontSize: 18, fontWeight: '900', padding: 0 },
  stepLabel: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  subtitle: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  presetTile: { width: '47%', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14 },
  presetIcon: { fontSize: 22, marginBottom: 8 },
  presetTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  presetSubtitle: { color: colors.textFaint, fontSize: 11, marginTop: 3 },

  savedGoalsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 },
  savedGoalsTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  savedGoalsSubtitle: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  chevron: { color: colors.textFaint, fontSize: 20, marginLeft: 'auto' },

  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginBottom: 14 },
  cardLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  cardLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabelValue: { color: colors.gold, fontWeight: '800', fontSize: 13 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginVertical: 10 },
  stepperButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  stepperText: { color: colors.text, fontSize: 20, fontWeight: '900' },
  stepperValue: { color: colors.text, fontSize: 26, fontWeight: '900' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 12 },
  chip: { backgroundColor: colors.cardAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#1a1200' },
  hintText: { color: colors.textFaint, fontSize: 11 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 14, gap: 10 },
  toggleTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  toggleSubtitle: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  switchTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.border, padding: 3 },
  switchTrackOn: { backgroundColor: colors.gold },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  switchThumbOn: { marginLeft: 18 },

  ctaButton: { backgroundColor: colors.gold, borderRadius: 20, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  ctaButtonText: { color: '#1a1200', fontWeight: '900', fontSize: 16 },

  reachedBadge: { alignSelf: 'center', backgroundColor: colors.green + '22', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  reachedText: { color: colors.green, fontWeight: '800', fontSize: 12, textAlign: 'center' },

  resultPanel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 16, marginBottom: 14 },
  goalPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  resultEyebrow: { color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  resultValue: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 4 },
  pctText: { color: colors.gold, fontSize: 16, fontWeight: '900' },
  playingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10 },
  goalBarOuter: { width: 20, height: 200, borderRadius: 10, backgroundColor: colors.cardAlt, justifyContent: 'flex-end', overflow: 'hidden' },
  goalBarFill: { backgroundColor: colors.gold, width: '100%' },
  legendFooter: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 8 },

  fixedFooter: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg },
  bottomRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  secondaryButtonText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  ctaButtonSmall: { flex: 1.3, backgroundColor: colors.gold, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  ctaButtonDisabled: { opacity: 0.4 },
  ctaButtonSmallText: { color: '#1a1200', fontWeight: '900', fontSize: 14 },

  heroEyebrow: { color: colors.textFaint, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  heroValue: { color: colors.gold, fontSize: 32, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  heroSubtext: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2, marginBottom: 16 },

  sideBySideRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stepUpTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  stepUpTabActive: { backgroundColor: colors.gold },
  stepUpTabText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  stepUpTabTextActive: { color: '#1a1200' },

  sectionLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 2 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, marginTop: 8 },
  statLabel: { color: colors.textFaint, fontSize: 10, maxWidth: 100 },
  statValue: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 4 },

  saveTrackRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 16, gap: 10 },
  saveTrackTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  saveTrackSubtitle: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  proBadgeSmall: { backgroundColor: colors.gold + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  proBadgeSmallText: { color: colors.gold, fontSize: 10, fontWeight: '900' },

  disclaimer: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 16 },

  emptyText: { color: colors.textFaint, fontSize: 13, textAlign: 'center', marginTop: 40 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 14 },
  summaryLabel: { color: colors.textFaint, fontSize: 11 },
  summaryValue: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 2 },

  goalRow: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14, marginBottom: 12 },
  goalRowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  goalRowTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  goalRowPct: { color: colors.green, fontWeight: '800', fontSize: 13 },
  goalRowTrack: { height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  goalRowFill: { height: 6, backgroundColor: colors.green },
  goalRowSub: { color: colors.textFaint, fontSize: 11, marginBottom: 4 },
  goalRowDue: { color: colors.textMuted, fontSize: 11, marginBottom: 10 },
  markDoneButton: { backgroundColor: colors.cardAlt, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  markDoneButtonDone: { backgroundColor: colors.green + '22' },
  markDoneText: { color: colors.textMuted, fontWeight: '800', fontSize: 12 },
  markDoneTextDone: { color: colors.green },
});
