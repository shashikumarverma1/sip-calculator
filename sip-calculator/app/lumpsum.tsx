import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/components/ui/theme';
import { BallGrid } from '@/components/jar/BallGrid';
import { CustomValueKeypad } from '@/components/ui/CustomValueKeypad';
import { computeLumpsumYearly, computeLumpsumFV, type LumpsumResult } from '@/lib/finance/lumpsum';
import { computeSipFV } from '@/lib/finance/sip';
import { createJar, jarTotal, familyTotal, type JarState } from '@/lib/balls/types';
import { addValue } from '@/lib/balls/engine';
import { formatINR, formatCompactINR } from '@/lib/format';

type Phase = 'setup' | 'playing' | 'result' | 'share';

const AMOUNT_PRESETS = [50000, 100000, 500000, 1000000];
const RETURN_PRESETS = [7, 12, 15];
const DURATION_PRESETS = [5, 10, 15, 20];

type CustomField = 'amount' | 'return' | 'duration' | null;

function buildJar(principal: number, yearly: LumpsumResult[]): JarState {
  const jar = createJar('lumpsum');
  addValue(jar, principal, 'principal', 1);
  let prevReturns = 0;
  yearly.forEach((row, i) => {
    addValue(jar, row.returns - prevReturns, 'returns', i + 1);
    prevReturns = row.returns;
  });
  return jar;
}

const remainder = (amount: number) => amount - Math.floor(amount / 1000) * 1000;

export default function LumpsumScreen() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [principal, setPrincipal] = useState(100000);
  const [ratePct, setRatePct] = useState(12);
  const [years, setYears] = useState(10);
  const [currentYear, setCurrentYear] = useState(0);
  const [customField, setCustomField] = useState<CustomField>(null);
  const [shareTheme, setShareTheme] = useState<'Night' | 'Gold vault' | 'Galaxy'>('Night');

  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const yearly = useMemo(() => computeLumpsumYearly(principal, ratePct, years), [principal, ratePct, years]);
  const finalJar = useMemo(() => buildJar(principal, yearly), [principal, yearly]);
  const finalTotal = jarTotal(finalJar);
  const finalInvested = familyTotal(finalJar, 'principal');
  const finalReturns = familyTotal(finalJar, 'returns');
  const growthMultiple = finalInvested > 0 ? finalTotal / finalInvested : 1;
  const finalPartials = [
    { family: 'principal' as const, amount: remainder(finalInvested) },
    { family: 'returns' as const, amount: remainder(finalReturns) },
  ];

  const previewFV = useMemo(() => computeLumpsumFV(principal, ratePct, years), [principal, ratePct, years]);
  const doublingYears = 72 / ratePct;

  const doubleYear = yearly.findIndex((r) => r.total >= principal * 2) + 1;
  const tripleYear = yearly.findIndex((r) => r.total >= principal * 3) + 1;

  const monthlyEquiv = principal / (years * 12);
  const sipEquivTotal = useMemo(() => computeSipFV(monthlyEquiv, ratePct, years).total, [monthlyEquiv, ratePct, years]);
  const lumpsumWins = finalTotal >= sipEquivTotal;

  const current = currentYear === 0 ? { invested: 0, returns: 0, total: 0 } : yearly[currentYear - 1];
  const previous = currentYear <= 1 ? { total: 0 } : yearly[currentYear - 2];
  const currentPartials = [
    { family: 'principal' as const, amount: remainder(current.invested) },
    { family: 'returns' as const, amount: remainder(current.returns) },
  ];
  const visibleBalls = useMemo(() => finalJar.balls.filter((b) => b.sourceYear <= currentYear), [finalJar, currentYear]);

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

  const dropItIn = () => setPhase('playing');

  const seeMyJar = () => {
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
            <Text style={styles.title}>New Lumpsum Jar</Text>
            <Text style={styles.stepLabel}>One-time drop · Tap any number to type it</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>I will invest once</Text>
          <Text style={styles.stepperValue}>{formatINR(principal)}</Text>
          <View style={styles.chipRow}>
            {AMOUNT_PRESETS.map((v) => (
              <Pressable key={v} style={[styles.chip, principal === v && styles.chipActive]} onPress={() => setPrincipal(v)}>
                <Text style={[styles.chipText, principal === v && styles.chipTextActive]}>{formatCompactINR(v).replace('₹', '')}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.chip, !AMOUNT_PRESETS.includes(principal) && styles.chipActive]}
              onPress={() => setCustomField('amount')}
            >
              <Text style={[styles.chipText, !AMOUNT_PRESETS.includes(principal) && styles.chipTextActive]}>
                {!AMOUNT_PRESETS.includes(principal) ? formatCompactINR(principal) : 'Other'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.dropPreviewRow}>
            <BallGrid width={60} height={60} balls={finalJar.balls.filter((b) => b.family === 'principal')} />
          </View>
          <Text style={styles.dropHint}>Drops in as 1 × {formatCompactINR(principal)}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Expected return</Text>
            <Pressable onPress={() => setCustomField('return')}>
              <Text style={styles.cardLabelValue}>{ratePct}% p.a. ✎</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {RETURN_PRESETS.map((v) => (
              <Pressable key={v} style={[styles.chip, ratePct === v && styles.chipActive]} onPress={() => setRatePct(v)}>
                <Text style={[styles.chipText, ratePct === v && styles.chipTextActive]}>{v}%</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.chip, !RETURN_PRESETS.includes(ratePct) && styles.chipActive]}
              onPress={() => setCustomField('return')}
            >
              <Text style={[styles.chipText, !RETURN_PRESETS.includes(ratePct) && styles.chipTextActive]}>
                {!RETURN_PRESETS.includes(ratePct) ? `${ratePct}%` : 'Custom'}
              </Text>
            </Pressable>
          </View>
          <Slider minimumValue={0.1} maximumValue={50} step={0.1} value={ratePct} minimumTrackTintColor={colors.gold} onValueChange={setRatePct} style={styles.fineSlider} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Keep it for</Text>
            <Pressable onPress={() => setCustomField('duration')}>
              <Text style={styles.cardLabelValue}>{years} years ✎</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {DURATION_PRESETS.map((y) => (
              <Pressable key={y} style={[styles.chip, years === y && styles.chipActive]} onPress={() => setYears(y)}>
                <Text style={[styles.chipText, years === y && styles.chipTextActive]}>{y}y</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.chip, !DURATION_PRESETS.includes(years) && styles.chipActive]}
              onPress={() => setCustomField('duration')}
            >
              <Text style={[styles.chipText, !DURATION_PRESETS.includes(years) && styles.chipTextActive]}>
                {!DURATION_PRESETS.includes(years) ? `${years}y` : 'Other'}
              </Text>
            </Pressable>
          </View>
          <Slider minimumValue={1} maximumValue={50} step={1} value={years} minimumTrackTintColor={colors.gold} onValueChange={setYears} style={styles.fineSlider} />
        </View>

        <Pressable style={styles.proRow} onPress={() => router.push('/paywall')}>
          <View>
            <Text style={styles.proRowTitle}>Add yearly top-ups</Text>
            <Text style={styles.proRowSubtitle}>Drop extra money every year (bonus, savings)</Text>
          </View>
          <View style={styles.proBadgeSmall}>
            <Text style={styles.proBadgeSmallText}>🔒 PRO</Text>
          </View>
        </Pressable>

        <Text style={styles.previewHint}>
          Grows to about {formatINR(previewFV.total)} · doubles every ~{doublingYears.toFixed(1)} yrs
        </Text>

        <Pressable style={styles.ctaButton} onPress={dropItIn}>
          <Text style={styles.ctaButtonText}>⬇ Drop it in one go</Text>
        </Pressable>

        {customField === 'amount' && (
          <CustomValueKeypad
            title="One-time amount"
            suffix="₹"
            initialValue={principal}
            min={1000}
            max={100000000}
            allowDecimal={false}
            doubleZero
            previewFormatter={formatCompactINR}
            hint="Allowed: ₹1,000 to ₹10 Cr"
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setPrincipal(Math.round(v));
              setCustomField(null);
            }}
          />
        )}
        {customField === 'return' && (
          <CustomValueKeypad
            title="Expected yearly return"
            suffix="%"
            initialValue={ratePct}
            min={0.1}
            max={50}
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setRatePct(v);
              setCustomField(null);
            }}
          />
        )}
        {customField === 'duration' && (
          <CustomValueKeypad
            title="Investment duration"
            suffix="y"
            initialValue={years}
            min={1}
            max={50}
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
    const delta = current.total - previous.total;
    return (
      <View style={styles.flexScreen}>
        <Screen contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}>
          <Text style={styles.subtitle}>{formatINR(principal)} once · {ratePct}%</Text>
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

          <View style={styles.chipRow}>
            {doubleYear > 0 && <Badge label={`2× Year ${doubleYear}`} />}
            {tripleYear > 0 && <Badge label={`3× Year ${tripleYear}`} />}
            <Badge label={`~${doublingYears.toFixed(0)} yrs to double`} />
          </View>
          <Text style={styles.dropHint}>Gold balls grow on their own every year</Text>

          <View style={[styles.resultPanel, styles.resultPanelGrow]}>
            <Text style={styles.resultEyebrow}>In the jar</Text>
            <Text style={styles.resultValue}>{formatINR(current.total)}</Text>
            {delta > 0 && <Text style={styles.resultDelta}>+{formatINR(delta)} this year</Text>}

            <View style={styles.jarWrap}>
              <BallGrid width={320} height={280} balls={visibleBalls} partials={currentPartials} />
            </View>

            <View style={styles.legendRow}>
              <Legend color={colors.blue} label="Your drop stays" value={formatINR(current.invested)} />
              <Legend color={colors.gold} label="Grown" value={formatINR(current.returns)} />
            </View>
          </View>
        </Screen>

        <View style={[styles.fixedFooter, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.bottomRow}>
            <Pressable style={styles.secondaryButton} onPress={play}>
              <Text style={styles.secondaryButtonText}>Replay</Text>
            </Pressable>
            <Pressable style={[styles.ctaButtonSmall, !animationDone && styles.ctaButtonDisabled]} disabled={!animationDone} onPress={seeMyJar}>
              <Text style={styles.ctaButtonSmallText}>See my jar →</Text>
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
          <Text style={[styles.title, { flex: 1, textAlign: 'center' }]}>Share my jar</Text>
          <Pressable style={styles.iconButton} onPress={() => setPhase('result')} hitSlop={10}>
            <Text style={styles.iconText}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.chipRow}>
          {(['Night', 'Gold vault', 'Galaxy'] as const).map((t) => (
            <Pressable key={t} style={[styles.chip, shareTheme === t && styles.chipActive]} onPress={() => setShareTheme(t)}>
              <Text style={[styles.chipText, shareTheme === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.shareCard}>
          <Text style={styles.shareBrand}>🫙 JarUp</Text>
          <Text style={styles.shareLine}>
            I dropped {formatINR(principal)} once. In {years} years it becomes{'\n'}
            <Text style={styles.shareValue}>{formatINR(finalTotal)}</Text>
          </Text>
          <Text style={styles.shareMultiple}>{growthMultiple.toFixed(1)}× · no extra money added</Text>
          <View style={styles.jarWrap}>
            <BallGrid width={220} height={170} balls={finalJar.balls} partials={finalPartials} />
          </View>
          <View style={styles.legendRow}>
            <Legend color={colors.blue} label="Invested" value={formatINR(finalInvested)} />
            <Legend color={colors.gold} label="Grew" value={formatINR(finalReturns)} />
          </View>
          <Text style={styles.shareDisclaimer}>Assumes {ratePct}% yearly return · Illustration only</Text>
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
          <Text style={styles.subtitle}>{formatINR(principal)} once · {ratePct}% · {years} yrs</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={goSetup} hitSlop={10}>
          <Text style={styles.iconText}>✎</Text>
        </Pressable>
      </View>

      <Text style={styles.heroEyebrow}>Your one drop became 🎉</Text>
      <Text style={styles.heroValue}>{formatINR(finalTotal)}</Text>
      <Text style={styles.heroSubtext}>{growthMultiple.toFixed(1)}× your money — without adding a rupee</Text>

      <View style={styles.jarWrap}>
        <BallGrid width={300} height={240} balls={finalJar.balls} partials={finalPartials} />
      </View>

      <View style={styles.legendRow}>
        <Legend color={colors.blue} label="Your drop" value={formatINR(finalInvested)} />
        <Legend color={colors.gold} label="Grew" value={formatINR(finalReturns)} />
      </View>

      <View style={styles.yearChartHeader}>
        <Text style={styles.yearChartLabel}>Growth curve</Text>
        {doubleYear > 0 && <Text style={styles.exploreLink}>2× in year {doubleYear}</Text>}
      </View>
      <View style={styles.yearChart}>
        {yearly.map((row, i) => (
          <View key={i} style={[styles.yearBar, { height: 8 + (row.total / finalTotal) * 50 }]} />
        ))}
      </View>

      <View style={styles.compareCard}>
        <Text style={styles.compareEyebrow}>Same {formatCompactINR(principal)}, but as SIP of {formatINR(Math.round(monthlyEquiv))}/mo</Text>
        <View style={styles.compareRow}>
          <View>
            <Text style={styles.compareLabel}>Lumpsum</Text>
            <Text style={[styles.compareValue, lumpsumWins && styles.compareValueWinner]}>{formatCompactINR(finalTotal)}</Text>
          </View>
          <View>
            <Text style={styles.compareLabel}>SIP</Text>
            <Text style={[styles.compareValue, !lumpsumWins && styles.compareValueWinner]}>{formatCompactINR(sipEquivTotal)}</Text>
          </View>
        </View>
        <Text style={styles.compareCaption}>
          {lumpsumWins
            ? 'Lumpsum wins when markets rise steadily. SIP spreads your entry and lowers timing risk.'
            : 'SIP wins here — spreading your entry evens out a bumpier ride than one big drop.'}
        </Text>
      </View>

      <View style={styles.proActionsRow}>
        <Pressable style={styles.proActionButton}>
          <Text style={styles.proActionText}>💾 Save plan</Text>
        </Pressable>
        <Pressable style={styles.proActionButton} onPress={() => router.push('/paywall')}>
          <Text style={styles.proActionText}>⇄ vs FD · PRO</Text>
        </Pressable>
        <Pressable style={styles.proActionButton} onPress={() => router.push('/paywall')}>
          <Text style={styles.proActionText}>➕ Top-ups · PRO</Text>
        </Pressable>
      </View>

      <Pressable style={styles.ctaButton} onPress={() => setPhase('share')}>
        <Text style={styles.ctaButtonText}>⬆ Share my jar</Text>
      </Pressable>

      <Text style={styles.disclaimer}>Returns are assumed for illustration and are not guaranteed. Not financial advice.</Text>
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

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
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
  subtitle: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 4 },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  cardLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  cardLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabelValue: { color: colors.gold, fontWeight: '800', fontSize: 13 },
  stepperValue: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center', marginVertical: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { backgroundColor: colors.cardAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#1a1200' },
  dropPreviewRow: { alignItems: 'center', marginTop: 14 },
  dropHint: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 8, marginBottom: 12 },

  badge: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.gold + '55', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: colors.gold, fontSize: 11, fontWeight: '800' },

  proRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  proRowTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  proRowSubtitle: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  proBadgeSmall: { backgroundColor: colors.gold + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  proBadgeSmallText: { color: colors.gold, fontSize: 11, fontWeight: '800' },

  previewHint: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginBottom: 12 },
  ctaButton: { backgroundColor: colors.gold, borderRadius: 20, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  ctaButtonText: { color: '#1a1200', fontWeight: '900', fontSize: 16 },

  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.gold },

  resultPanel: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  resultPanelGrow: { flex: 1, justifyContent: 'center' },
  resultEyebrow: { color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  resultValue: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 4 },
  resultDelta: { color: colors.green, fontSize: 12, fontWeight: '700', marginTop: 2 },
  jarWrap: { alignItems: 'center', marginVertical: 12 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.textFaint, fontSize: 12 },
  legendValue: { color: colors.text, fontSize: 12, fontWeight: '800' },

  fixedFooter: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg },
  bottomRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  secondaryButtonText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  ctaButtonSmall: { flex: 1.3, backgroundColor: colors.gold, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  ctaButtonDisabled: { opacity: 0.4 },
  ctaButtonSmallText: { color: '#1a1200', fontWeight: '900', fontSize: 14 },

  heroEyebrow: { color: colors.textFaint, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  heroValue: { color: colors.gold, fontSize: 32, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  heroSubtext: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2, marginBottom: 12 },

  yearChartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 },
  yearChartLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  exploreLink: { color: colors.link, fontSize: 12, fontWeight: '700' },
  yearChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 60, marginBottom: 16 },
  yearBar: { flex: 1, backgroundColor: colors.indigo, borderRadius: 3 },

  compareCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginBottom: 16 },
  compareEyebrow: { color: colors.textFaint, fontSize: 11, fontWeight: '700', marginBottom: 10 },
  compareRow: { flexDirection: 'row', gap: 32, marginBottom: 10 },
  compareLabel: { color: colors.textFaint, fontSize: 11 },
  compareValue: { color: colors.textMuted, fontSize: 18, fontWeight: '800', marginTop: 2 },
  compareValueWinner: { color: colors.gold },
  compareCaption: { color: colors.textFaint, fontSize: 11, lineHeight: 16 },

  proActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  proActionButton: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  proActionText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },

  disclaimer: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 16 },
  fineSlider: { marginTop: 4, height: 24 },

  shareCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.gold + '44', borderRadius: 22, padding: 18, alignItems: 'center', marginBottom: 16 },
  shareBrand: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 8 },
  shareLine: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  shareValue: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  shareMultiple: { color: colors.green, fontSize: 12, fontWeight: '700', marginTop: 6 },
  shareDisclaimer: { color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: 10 },
  shareIconsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  shareIconItem: { alignItems: 'center', gap: 4 },
  shareIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  shareIconGlyph: { fontSize: 18 },
  shareIconLabel: { color: colors.textFaint, fontSize: 10 },
});
