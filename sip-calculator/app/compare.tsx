import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/components/ui/theme';
import { BallGrid, type PartialBall } from '@/components/jar/BallGrid';
import { CustomValueKeypad } from '@/components/ui/CustomValueKeypad';
import { computeSipYearly, type YearBreakdown } from '@/lib/finance/sip';
import { computeLumpsumYearly } from '@/lib/finance/lumpsum';
import { createJar, jarTotal, familyTotal, type JarState } from '@/lib/balls/types';
import { addValue } from '@/lib/balls/engine';
import { formatINR, formatCompactINR } from '@/lib/format';

const SCREEN_WIDTH = Dimensions.get('window').width;
/** Screen horizontal padding (16×2) + the gap between the two race columns. */
const RACE_JAR_WIDTH = (SCREEN_WIDTH - 32 - 12) / 2;
const RACE_JAR_HEIGHT = RACE_JAR_WIDTH * 1.9;

type Phase = 'setup' | 'configure' | 'playing' | 'result' | 'share';
type SideKind = 'sip' | 'lumpsum' | 'delayedSip';
type CustomField = 'amount' | 'rateA' | 'rateB' | null;

interface RacePreset {
  key: string;
  title: string;
  subtitle: string;
  badge?: string;
  labelA: string;
  labelB: string;
  kindA: SideKind;
  kindB: SideKind;
  rateA: number;
  rateB: number;
  delayB?: number;
  subtitleConfigure: string;
  facts: [string, string, string][];
}

const RACES: RacePreset[] = [
  {
    key: 'fdVsSip',
    title: 'FD / RD vs SIP',
    subtitle: 'Guaranteed bank return vs market return',
    badge: 'Most tried',
    labelA: 'FD/RD',
    labelB: 'SIP',
    kindA: 'sip',
    kindB: 'sip',
    rateA: 7,
    rateB: 12,
    subtitleConfigure: "Both jars get exactly the same money",
    facts: [
      ['Return', 'Fixed, guaranteed', 'Goes up and down'],
      ['Bad year?', 'Never negative', 'Can fall 20%+'],
      ['Tax', 'On interest, yearly', 'When you sell'],
      ['Best for', 'Short goal, emergency', '5+ year goals'],
    ],
  },
  {
    key: 'lumpsumVsSip',
    title: 'Lumpsum vs SIP',
    subtitle: 'Invest all now, or spread it monthly?',
    labelA: 'Lumpsum',
    labelB: 'SIP',
    kindA: 'lumpsum',
    kindB: 'sip',
    rateA: 11,
    rateB: 11,
    subtitleConfigure: 'Same total money, different timing',
    facts: [
      ['Timing risk', 'All at once', 'Spread out'],
      ['Needs', 'A lump sum ready', 'Monthly discipline'],
      ['Best for', 'Markets rising steadily', 'Volatile, uncertain markets'],
    ],
  },
  {
    key: 'savingsVsSip',
    title: 'Savings account vs SIP',
    subtitle: 'Money barely really grows there',
    labelA: 'Savings',
    labelB: 'SIP',
    kindA: 'sip',
    kindB: 'sip',
    rateA: 3.5,
    rateB: 12,
    subtitleConfigure: 'Both jars get exactly the same money',
    facts: [
      ['Return', '~3-4%, rarely changes', 'Market-linked, higher long term'],
      ['Risk', 'Virtually none', 'Can fall short-term'],
      ['Best for', 'Emergency fund', 'Long-term goals'],
    ],
  },
  {
    key: 'delayVsSip',
    title: 'Start now vs SIP',
    subtitle: 'start in 5yrs · The cost of waiting',
    badge: 'Eye opener',
    labelA: 'Start now',
    labelB: 'Wait 5yrs',
    kindA: 'sip',
    kindB: 'delayedSip',
    rateA: 12,
    rateB: 12,
    delayB: 5,
    subtitleConfigure: 'Same monthly amount and rate — only the start date differs',
    facts: [
      ['Time in market', 'Starts now', 'Starts 5 yrs later'],
      ['Lost growth', 'None', 'Years of compounding missed'],
      ['Lesson', 'Starting early wins', 'Waiting has a real cost'],
    ],
  },
  {
    key: 'custom',
    title: 'Custom race',
    subtitle: 'Set any two rates and amounts',
    labelA: 'Jar A',
    labelB: 'Jar B',
    kindA: 'sip',
    kindB: 'sip',
    rateA: 7,
    rateB: 12,
    subtitleConfigure: 'Both jars get exactly the same money',
    facts: [['Return', 'Your rate A', 'Your rate B']],
  },
];

const AMOUNT_PRESETS = [1000, 5000, 10000, 25000];
const DURATION_PRESETS = [5, 10, 15, 20];

function computeSideYearly(kind: SideKind, monthly: number, years: number, rate: number, delayYears = 0): YearBreakdown[] {
  if (kind === 'sip') return computeSipYearly(monthly, rate, years);
  if (kind === 'lumpsum') {
    const principal = monthly * years * 12;
    return computeLumpsumYearly(principal, rate, years).map((r, i) => ({ year: i + 1, invested: r.invested, returns: r.returns, total: r.total }));
  }
  // delayedSip: zero years while waiting, then a plain SIP for whatever's left.
  const activeYears = Math.max(years - delayYears, 0);
  const active = computeSipYearly(monthly, rate, activeYears);
  const padded: YearBreakdown[] = [];
  for (let y = 1; y <= delayYears; y++) padded.push({ year: y, invested: 0, returns: 0, total: 0 });
  active.forEach((r) => padded.push({ ...r, year: r.year + delayYears }));
  return padded;
}

function buildJar(id: string, breakdown: YearBreakdown[]): JarState {
  const jar = createJar(id);
  let prevInvested = 0;
  let prevReturns = 0;
  for (const row of breakdown) {
    addValue(jar, row.invested - prevInvested, 'principal', row.year);
    addValue(jar, row.returns - prevReturns, 'returns', row.year);
    prevInvested = row.invested;
    prevReturns = row.returns;
  }
  return jar;
}

const remainder = (amount: number) => amount - Math.floor(amount / 1000) * 1000;

export default function CompareScreen() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [race, setRace] = useState<RacePreset>(RACES[0]);
  const [monthly, setMonthly] = useState(5000);
  const [years, setYears] = useState(10);
  const [rateA, setRateA] = useState(RACES[0].rateA);
  const [rateB, setRateB] = useState(RACES[0].rateB);
  const [currentYear, setCurrentYear] = useState(0);
  const [customField, setCustomField] = useState<CustomField>(null);
  const [shareTheme, setShareTheme] = useState<'Night' | 'Gold vault' | 'Galaxy'>('Night');

  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const breakdownA = useMemo(() => computeSideYearly(race.kindA, monthly, years, rateA), [race.kindA, monthly, years, rateA]);
  const breakdownB = useMemo(
    () => computeSideYearly(race.kindB, monthly, years, rateB, race.delayB ?? 0),
    [race.kindB, monthly, years, rateB, race.delayB],
  );
  const jarA = useMemo(() => buildJar('A', breakdownA), [breakdownA]);
  const jarB = useMemo(() => buildJar('B', breakdownB), [breakdownB]);
  const totalA = jarTotal(jarA);
  const totalB = jarTotal(jarB);
  const investedA = familyTotal(jarA, 'principal');
  const investedB = familyTotal(jarB, 'principal');
  const partialsFor = (jar: JarState) => [
    { family: 'principal' as const, amount: remainder(familyTotal(jar, 'principal')) },
    { family: 'returns' as const, amount: remainder(familyTotal(jar, 'returns')) },
  ];

  const aWins = totalA >= totalB;
  const winnerLabel = aWins ? race.labelA : race.labelB;
  const winnerTotal = aWins ? totalA : totalB;
  const winnerInvested = aWins ? investedA : investedB;
  const gap = Math.abs(totalA - totalB);
  const multiple = winnerInvested > 0 ? winnerTotal / winnerInvested : 1;

  const safeYear = Math.min(currentYear, years);
  const currentA = safeYear === 0 ? { invested: 0, returns: 0, total: 0 } : breakdownA[safeYear - 1];
  const currentB = safeYear === 0 ? { invested: 0, returns: 0, total: 0 } : breakdownB[safeYear - 1];
  const currentlyAWins = currentA.total >= currentB.total;
  const currentGap = Math.abs(currentA.total - currentB.total);
  const visibleA = useMemo(() => jarA.balls.filter((b) => b.sourceYear <= safeYear), [jarA, safeYear]);
  const visibleB = useMemo(() => jarB.balls.filter((b) => b.sourceYear <= safeYear), [jarB, safeYear]);

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
  const pickRace = (r: RacePreset) => {
    setRace(r);
    setRateA(r.rateA);
    setRateB(r.rateB);
    setPhase('configure');
  };
  const goConfigure = () => {
    stopPlayback();
    setCurrentYear(0);
    setPhase('configure');
  };
  const startRace = () => setPhase('playing');
  const seeWhoWon = () => {
    stopPlayback();
    setCurrentYear(years);
    setPhase('result');
  };
  const animationDone = safeYear >= years;

  // ---------------- SETUP (race picker) ----------------
  if (phase === 'setup') {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Jar Race</Text>
            <Text style={styles.stepLabel}>Same race, two jars. Which one fills faster?</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Popular races</Text>
        {RACES.map((r) => (
          <Pressable key={r.key} style={styles.raceCard} onPress={() => pickRace(r)}>
            <View style={styles.raceDots}>
              <View style={[styles.raceDot, { backgroundColor: colors.blue }]} />
              <View style={[styles.raceDot, { backgroundColor: colors.gold, marginLeft: -10 }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.raceTitle}>{r.title}</Text>
              <Text style={styles.raceSubtitle}>{r.subtitle}</Text>
            </View>
            {r.badge != null && (
              <View style={styles.raceBadge}>
                <Text style={styles.raceBadgeText}>{r.badge}</Text>
              </View>
            )}
          </Pressable>
        ))}

        <Text style={styles.disclaimer}>Races compare assumed returns. FD returns are fixed, market returns go up and down.</Text>
      </Screen>
    );
  }

  // ---------------- CONFIGURE ----------------
  if (phase === 'configure') {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => setPhase('setup')} hitSlop={10}>
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{race.labelA} vs {race.labelB}</Text>
            <Text style={styles.stepLabel}>{race.subtitleConfigure}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Every month, each jar gets</Text>
          <View style={styles.stepperRow}>
            <Pressable style={styles.stepperButton} onPress={() => setMonthly((m) => Math.max(500, m - 500))}>
              <Text style={styles.stepperText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{formatINR(monthly)}</Text>
            <Pressable style={styles.stepperButton} onPress={() => setMonthly((m) => m + 500)}>
              <Text style={styles.stepperText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {AMOUNT_PRESETS.map((v) => (
              <Pressable key={v} style={[styles.chip, monthly === v && styles.chipActive]} onPress={() => setMonthly(v)}>
                <Text style={[styles.chipText, monthly === v && styles.chipTextActive]}>{formatCompactINR(v).replace('₹', '')}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.chip, !AMOUNT_PRESETS.includes(monthly) && styles.chipActive]} onPress={() => setCustomField('amount')}>
              <Text style={[styles.chipText, !AMOUNT_PRESETS.includes(monthly) && styles.chipTextActive]}>
                {!AMOUNT_PRESETS.includes(monthly) ? formatCompactINR(monthly) : 'Other'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Race length</Text>
            <Text style={styles.cardLabelValue}>{years} years</Text>
          </View>
          <View style={styles.chipRow}>
            {DURATION_PRESETS.map((y) => (
              <Pressable key={y} style={[styles.chip, years === y && styles.chipActive]} onPress={() => setYears(y)}>
                <Text style={[styles.chipText, years === y && styles.chipTextActive]}>{y}y</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sideBySideRow}>
          <Pressable style={styles.rateCard} onPress={() => setCustomField('rateA')}>
            <View style={styles.rateCardHeader}>
              <View style={[styles.raceDot, { backgroundColor: colors.blue }]} />
              <Text style={styles.rateCardLabel}>{race.labelA}</Text>
            </View>
            <Text style={styles.rateCardSubtitle}>{race.kindA === 'lumpsum' ? 'Invested once, upfront' : 'Fixed, guaranteed'}</Text>
            <Text style={styles.rateCardValue}>{rateA}%</Text>
            <Slider minimumValue={0.5} maximumValue={20} step={0.1} value={rateA} minimumTrackTintColor={colors.blue} onValueChange={setRateA} />
          </Pressable>
          <Pressable style={styles.rateCard} onPress={() => setCustomField('rateB')}>
            <View style={styles.rateCardHeader}>
              <View style={[styles.raceDot, { backgroundColor: colors.gold }]} />
              <Text style={styles.rateCardLabel}>{race.labelB}</Text>
            </View>
            <Text style={styles.rateCardSubtitle}>{race.kindB === 'delayedSip' ? `Starts ${race.delayB}y late` : 'Market-linked, varies'}</Text>
            <Text style={styles.rateCardValue}>{rateB}%</Text>
            <Slider minimumValue={0.5} maximumValue={30} step={0.1} value={rateB} minimumTrackTintColor={colors.gold} onValueChange={setRateB} />
          </Pressable>
        </View>
        <Text style={styles.hintText}>Tap any rate to type your own. Your bank's FD rate and your fund's past return are good starting points.</Text>

        <Pressable style={styles.ctaButton} onPress={startRace}>
          <Text style={styles.ctaButtonText}>▶ Start the race</Text>
        </Pressable>

        {customField === 'amount' && (
          <CustomValueKeypad
            title="Monthly amount"
            suffix="₹"
            initialValue={monthly}
            min={500}
            max={1000000}
            allowDecimal={false}
            doubleZero
            previewFormatter={formatCompactINR}
            hint="Allowed: ₹500 to ₹10L"
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setMonthly(Math.round(v));
              setCustomField(null);
            }}
          />
        )}
        {customField === 'rateA' && (
          <CustomValueKeypad
            title={`${race.labelA} rate`}
            suffix="%"
            initialValue={rateA}
            min={0.1}
            max={30}
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setRateA(v);
              setCustomField(null);
            }}
          />
        )}
        {customField === 'rateB' && (
          <CustomValueKeypad
            title={`${race.labelB} rate`}
            suffix="%"
            initialValue={rateB}
            min={0.1}
            max={30}
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setRateB(v);
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
          <Text style={styles.subtitle}>{formatINR(monthly)}/mo into each jar</Text>
          <View style={styles.splitHeaderRow}>
            <Text style={styles.splitLabel}>{race.labelA} {rateA}%</Text>
            <Text style={styles.splitLabel}>{race.labelB} {rateB}%</Text>
          </View>
          <View style={styles.headerRow}>
            <Pressable style={styles.iconButton} onPress={goConfigure} hitSlop={10}>
              <Text style={styles.iconText}>‹</Text>
            </Pressable>
            <Text style={[styles.title, { flex: 1, textAlign: 'center' }]}>
              Year {safeYear} <Text style={styles.titleFaint}>/ {years}</Text>
            </Text>
            <Pressable style={styles.iconButton} onPress={skipToEnd} hitSlop={10}>
              <Text style={styles.iconText}>›|</Text>
            </Pressable>
          </View>
          <View style={styles.splitBar}>
            <View style={[styles.splitBarLoan, { flex: Math.max(Math.round((currentA.total / Math.max(currentA.total + currentB.total, 1)) * 100), 1) }]} />
            <View style={[styles.splitBarInterest, { flex: Math.max(Math.round((currentB.total / Math.max(currentA.total + currentB.total, 1)) * 100), 1), backgroundColor: colors.gold }]} />
          </View>

          {safeYear > 0 && (
            <View style={styles.leaderBadge}>
              <Text style={styles.leaderBadgeText}>
                {currentlyAWins ? race.labelA : race.labelB} wins by {formatCompactINR(currentGap)}
              </Text>
            </View>
          )}

          <View style={styles.sideBySideRow}>
            <View style={styles.raceColumn}>
              <Text style={styles.raceColumnLabel}>{race.labelA}</Text>
              <Text style={styles.raceColumnValue}>{formatCompactINR(currentA.total)}</Text>
              <BallGrid width={RACE_JAR_WIDTH} height={RACE_JAR_HEIGHT} balls={visibleA} partials={safeYear > 0 ? partialsFor(jarA).map((p) => ({ ...p, amount: remainder(currentA[p.family === 'principal' ? 'invested' : 'returns']) })) : []} />
            </View>
            <View style={styles.raceColumn}>
              <Text style={styles.raceColumnLabel}>{race.labelB}</Text>
              <Text style={styles.raceColumnValue}>{formatCompactINR(currentB.total)}</Text>
              <BallGrid width={RACE_JAR_WIDTH} height={RACE_JAR_HEIGHT} balls={visibleB} partials={safeYear > 0 ? partialsFor(jarB).map((p) => ({ ...p, amount: remainder(currentB[p.family === 'principal' ? 'invested' : 'returns']) })) : []} />
            </View>
          </View>

          <Text style={styles.legendFooter}>
            Your money {formatCompactINR(monthly * safeYear * 12)} (same) · Growth is the difference
          </Text>
        </Screen>

        <View style={[styles.fixedFooter, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.bottomRow}>
            <Pressable style={styles.secondaryButton} onPress={play}>
              <Text style={styles.secondaryButtonText}>Replay</Text>
            </Pressable>
            <Pressable style={[styles.ctaButtonSmall, !animationDone && styles.ctaButtonDisabled]} disabled={!animationDone} onPress={seeWhoWon}>
              <Text style={styles.ctaButtonSmallText}>See who won →</Text>
            </Pressable>
          </View>
        </View>
      </View>
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
          <Text style={[styles.title, { flex: 1, textAlign: 'center' }]}>Share the race</Text>
        </View>

        <View style={styles.chipRow}>
          {(['Night', 'Gold vault', 'Galaxy'] as const).map((t) => (
            <Pressable key={t} style={[styles.chip, shareTheme === t && styles.chipActive]} onPress={() => setShareTheme(t)}>
              <Text style={[styles.chipText, shareTheme === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.shareCard}>
          <Text style={styles.shareBrand}>🫙 JarUp · Jar Race</Text>
          <Text style={styles.shareLine}>Same {formatINR(monthly)} a month for {years} years</Text>
          <View style={styles.sideBySideRow}>
            <View style={styles.raceColumn}>
              <BallGrid width={110} height={150} balls={jarA.balls} />
              <Text style={styles.raceColumnLabel}>{race.labelA} {formatCompactINR(totalA)}</Text>
            </View>
            <View style={styles.raceColumn}>
              <BallGrid width={110} height={150} balls={jarB.balls} />
              <Text style={styles.raceColumnLabel}>{race.labelB} {formatCompactINR(totalB)}</Text>
            </View>
          </View>
          <Text style={styles.shareWinner}>{winnerLabel} wins by {formatCompactINR(gap)}</Text>
          <Text style={styles.shareDisclaimer}>Assumes {race.labelA} {rateA}%, {race.labelB} {rateB}%. Markets can fall.</Text>
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
          <Text style={styles.subtitle}>{race.labelA} {rateA}% vs {race.labelB} {rateB}%</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={goConfigure} hitSlop={10}>
          <Text style={styles.iconText}>✎</Text>
        </Pressable>
      </View>

      <View style={styles.winnerRibbon}>
        <Text style={styles.winnerRibbonText}>🏁 {winnerLabel} wins</Text>
      </View>
      <Text style={styles.heroValue}>+{formatCompactINR(gap)}</Text>
      <Text style={styles.heroSubtext}>
        more, from the same {formatCompactINR(winnerInvested)} in · {multiple.toFixed(1)}× the growth
      </Text>

      <View style={styles.sideBySideRow}>
        <View style={[styles.resultCard, aWins && styles.resultCardWinner]}>
          <Text style={styles.resultCardLabel}>{race.labelA} {rateA}%</Text>
          <Text style={styles.resultCardValue}>{formatCompactINR(totalA)}</Text>
          <Text style={styles.resultCardSub}>Growth {formatCompactINR(totalA - investedA)}</Text>
        </View>
        <View style={[styles.resultCard, !aWins && styles.resultCardWinner]}>
          <Text style={styles.resultCardLabel}>{race.labelB} {rateB}%</Text>
          <Text style={styles.resultCardValue}>{formatCompactINR(totalB)}</Text>
          <Text style={styles.resultCardSub}>Growth {formatCompactINR(totalB - investedB)}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>But also…</Text>
      <View style={styles.factsTable}>
        {race.facts.map(([label, a, b]) => (
          <View key={label} style={styles.factsRow}>
            <Text style={styles.factsLabel}>{label}</Text>
            <Text style={styles.factsValue}>{a}</Text>
            <Text style={styles.factsValue}>{b}</Text>
          </View>
        ))}
      </View>

      <View style={styles.bottomActionsRow}>
        <Pressable style={styles.secondaryButton} onPress={() => setPhase('setup')}>
          <Text style={styles.secondaryButtonText}>Another race</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/sip')}>
          <Text style={styles.secondaryButtonText}>Plan this SIP</Text>
        </Pressable>
      </View>

      <Pressable style={styles.ctaButton} onPress={() => setPhase('share')}>
        <Text style={styles.ctaButtonText}>⬆ Share the race</Text>
      </Pressable>

      <Text style={styles.disclaimer}>Market returns are not guaranteed. Results are before tax. Not financial advice.</Text>
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

  sectionLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  raceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  raceDots: { flexDirection: 'row' },
  raceDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.card },
  raceTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  raceSubtitle: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  raceBadge: { backgroundColor: colors.gold + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  raceBadgeText: { color: colors.gold, fontSize: 9, fontWeight: '900' },

  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginBottom: 14 },
  cardLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  cardLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabelValue: { color: colors.gold, fontWeight: '800', fontSize: 13 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginVertical: 10 },
  stepperButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  stepperText: { color: colors.text, fontSize: 20, fontWeight: '900' },
  stepperValue: { color: colors.text, fontSize: 26, fontWeight: '900' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { backgroundColor: colors.cardAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#1a1200' },

  sideBySideRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  rateCard: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 },
  rateCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  rateCardLabel: { color: colors.text, fontWeight: '800', fontSize: 13 },
  rateCardSubtitle: { color: colors.textFaint, fontSize: 10, marginBottom: 6 },
  rateCardValue: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 4 },
  hintText: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginBottom: 16 },

  ctaButton: { backgroundColor: colors.indigo, borderRadius: 20, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  ctaButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  splitHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  splitLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  splitBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  splitBarLoan: { backgroundColor: colors.blue },
  splitBarInterest: { backgroundColor: colors.gold },

  leaderBadge: { alignSelf: 'center', backgroundColor: colors.green + '22', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  leaderBadgeText: { color: colors.green, fontWeight: '800', fontSize: 12 },

  raceColumn: { flex: 1, alignItems: 'center' },
  raceColumnLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '700', marginTop: 6 },
  raceColumnValue: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 6 },
  legendFooter: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 8 },

  fixedFooter: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg },
  bottomRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  bottomActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  secondaryButtonText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  ctaButtonSmall: { flex: 1.3, backgroundColor: colors.indigo, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  ctaButtonDisabled: { opacity: 0.4 },
  ctaButtonSmallText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  winnerRibbon: { alignSelf: 'center', backgroundColor: colors.gold + '22', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 10 },
  winnerRibbonText: { color: colors.gold, fontWeight: '900', fontSize: 13 },
  heroValue: { color: colors.gold, fontSize: 32, fontWeight: '900', textAlign: 'center' },
  heroSubtext: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2, marginBottom: 16 },

  resultCard: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, alignItems: 'center' },
  resultCardWinner: { borderColor: colors.gold },
  resultCardLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  resultCardValue: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 4 },
  resultCardSub: { color: colors.textFaint, fontSize: 10, marginTop: 4 },

  factsTable: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 20 },
  factsRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  factsLabel: { flex: 1, color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  factsValue: { flex: 1.3, color: colors.text, fontSize: 11 },

  disclaimer: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 16 },

  shareCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.gold + '44', borderRadius: 22, padding: 18, alignItems: 'center', marginBottom: 16 },
  shareBrand: { color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: 8 },
  shareLine: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  shareWinner: { color: colors.gold, fontSize: 14, fontWeight: '800', marginTop: 10 },
  shareDisclaimer: { color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: 10 },
  shareIconsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  shareIconItem: { alignItems: 'center', gap: 4 },
  shareIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  shareIconGlyph: { fontSize: 18 },
  shareIconLabel: { color: colors.textFaint, fontSize: 10 },
});
