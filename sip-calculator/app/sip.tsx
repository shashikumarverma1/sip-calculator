import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/components/ui/theme';
import { BallGrid, TIER_LABEL, FAMILY_COLOR } from '@/components/jar/BallGrid';
import { CustomValueKeypad } from '@/components/ui/CustomValueKeypad';
import { computeSipYearly, computeSipFV, type YearBreakdown } from '@/lib/finance/sip';
import { createJar, jarTotal, familyTotal, TIERS, type JarState, type Ball } from '@/lib/balls/types';
import { addValue } from '@/lib/balls/engine';
import { formatINR } from '@/lib/format';

type Phase = 'setup' | 'playing' | 'result' | 'share';

const MONTHLY_PRESETS = [1000, 2000, 5000, 10000];
const RETURN_PRESETS = [7, 11, 14];
const DURATION_PRESETS = [5, 10, 20, 30];

type CustomField = 'monthly' | 'return' | 'duration' | null;

function buildJar(breakdown: YearBreakdown[]): JarState {
  const jar = createJar('sip');
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

export default function SipScreen() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [monthly, setMonthly] = useState(5000);
  const [ratePct, setRatePct] = useState(11);
  const [years, setYears] = useState(10);
  const [currentYear, setCurrentYear] = useState(0);
  const [selectedBall, setSelectedBall] = useState<Ball | null>(null);
  const [customField, setCustomField] = useState<CustomField>(null);
  const insets = useSafeAreaInsets();
  const [shareTheme, setShareTheme] = useState<'Night' | 'Gold vault' | 'Galaxy'>('Night');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const breakdown = useMemo(() => computeSipYearly(monthly, ratePct, years), [monthly, ratePct, years]);
  const finalJar = useMemo(() => buildJar(breakdown), [breakdown]);
  const finalTotal = jarTotal(finalJar);
  const finalInvested = familyTotal(finalJar, 'principal');
  const finalReturns = familyTotal(finalJar, 'returns');
  const growthMultiple = finalInvested > 0 ? finalTotal / finalInvested : 1;

  const previewFV = useMemo(() => computeSipFV(monthly, ratePct, years), [monthly, ratePct, years]);

  const current = currentYear === 0 ? { invested: 0, returns: 0, total: 0 } : breakdown[currentYear - 1];
  const previous = currentYear <= 1 ? { total: 0 } : breakdown[currentYear - 2];
  // Balls only resolve to the nearest ₹1K; whatever's left over needs its own faint "partial"
  // ball so the sum of everything drawn always equals the exact total shown in text.
  const remainder = (amount: number) => amount - Math.floor(amount / 1000) * 1000;
  const currentPartials = [
    { family: 'principal' as const, amount: remainder(current.invested) },
    { family: 'returns' as const, amount: remainder(current.returns) },
  ];
  const finalPartials = [
    { family: 'principal' as const, amount: remainder(finalInvested) },
    { family: 'returns' as const, amount: remainder(finalReturns) },
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
            <Text style={styles.title}>New SIP Jar</Text>
            <Text style={styles.stepLabel}>Step 1 of 2 · Set your plan</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>I will invest every month</Text>
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
            {MONTHLY_PRESETS.map((v) => (
              <Pressable key={v} style={[styles.chip, monthly === v && styles.chipActive]} onPress={() => setMonthly(v)}>
                <Text style={[styles.chipText, monthly === v && styles.chipTextActive]}>
                  {v >= 1000 ? `${v / 1000}K` : v}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.chip, !MONTHLY_PRESETS.includes(monthly) && styles.chipActive]}
              onPress={() => setCustomField('monthly')}
            >
              <Text style={[styles.chipText, !MONTHLY_PRESETS.includes(monthly) && styles.chipTextActive]}>
                {!MONTHLY_PRESETS.includes(monthly) ? formatINR(monthly) : 'Other'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.dropPreviewRow}>
            {Array.from({ length: Math.min(Math.max(Math.round(monthly / 1000), 1), 8) }).map((_, i) => (
              <View key={i} style={styles.dropDot} />
            ))}
          </View>
          <Text style={styles.dropHint}>{Math.max(Math.round(monthly / 1000), 1)} × ₹1K balls drop every month</Text>
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
            <Text style={styles.cardLabel}>For how long</Text>
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
            <Text style={styles.proRowTitle}>Step-up every year</Text>
            <Text style={styles.proRowSubtitle}>Grow your SIP with your salary</Text>
          </View>
          <View style={styles.proBadgeSmall}>
            <Text style={styles.proBadgeSmallText}>🔒 PRO</Text>
          </View>
        </Pressable>

        <Text style={styles.previewHint}>Jar will hold about {formatINR(previewFV.total)} — watch it fill</Text>

        <Pressable style={styles.ctaButton} onPress={dropItIn}>
          <Text style={styles.ctaButtonText}>▶ Drop it in the jar</Text>
        </Pressable>

        {customField === 'monthly' && (
          <CustomValueKeypad
            title="Monthly investment"
            suffix="₹"
            initialValue={monthly}
            min={500}
            max={500000}
            allowDecimal={false}
            onCancel={() => setCustomField(null)}
            onSet={(v) => {
              setMonthly(Math.round(v));
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

          <View style={[styles.resultPanel, styles.resultPanelGrow]}>
            <Text style={styles.resultEyebrow}>In the jar</Text>
            <Text style={styles.resultValue}>{formatINR(current.total)}</Text>
            {delta > 0 && <Text style={styles.resultDelta}>+{formatINR(delta)} this year</Text>}

            <View style={styles.jarWrap}>
              <BallGrid width={320} height={300} balls={visibleBalls} partials={currentPartials} />
            </View>

            <View style={styles.legendRow}>
              <Legend color={colors.blue} label="Invested" value={formatINR(current.invested)} />
              <Legend color={colors.gold} label="Returns" value={formatINR(current.returns)} />
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
            My {formatINR(monthly)} monthly SIP becomes{'\n'}
            <Text style={styles.shareValue}>{formatINR(finalTotal)}</Text> in {years} years
          </Text>
          <View style={styles.jarWrap}>
            <BallGrid width={220} height={170} balls={finalJar.balls} partials={finalPartials} />
          </View>
          <View style={styles.legendRow}>
            <Legend color={colors.blue} label="Invested" value={formatINR(finalInvested)} />
            <Legend color={colors.gold} label="Earned" value={formatINR(finalReturns)} />
          </View>
          <Text style={styles.shareDisclaimer}>Returns are assumed for illustration. Not financial advice.</Text>
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
          <Text style={styles.subtitle}>{formatINR(monthly)} / mo · {ratePct}% · {years} yrs</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={goSetup} hitSlop={10}>
          <Text style={styles.iconText}>✎</Text>
        </Pressable>
      </View>

      <Text style={styles.heroEyebrow}>In {years} years your jar holds 🎉</Text>
      <Text style={styles.heroValue}>{formatINR(finalTotal)}</Text>
      <Text style={styles.heroSubtext}>Your money grew {growthMultiple.toFixed(1)}×</Text>

      <View style={styles.jarWrap}>
        <BallGrid
          width={300}
          height={240}
          balls={finalJar.balls}
          partials={finalPartials}
          hint="Tap a ball"
          onBallPress={(b) => setSelectedBall(b)}
        />
      </View>

      <View style={styles.legendRow}>
        <Legend color={colors.blue} label="You put in" value={formatINR(finalInvested)} />
        <Legend color={colors.gold} label="Jar earned" value={formatINR(finalReturns)} />
      </View>

      <View style={styles.yearChartHeader}>
        <Text style={styles.yearChartLabel}>Year by year</Text>
        <Text style={styles.exploreLink}>Explore years →</Text>
      </View>
      <View style={styles.yearChart}>
        {breakdown.map((row) => (
          <View
            key={row.year}
            style={[styles.yearBar, { height: 8 + (row.total / finalTotal) * 50 }]}
          />
        ))}
      </View>

      <View style={styles.proActionsRow}>
        <Pressable style={styles.proActionButton}>
          <Text style={styles.proActionText}>💾 Save plan</Text>
        </Pressable>
        <Pressable style={styles.proActionButton} onPress={() => router.push('/paywall')}>
          <Text style={styles.proActionText}>⇄ vs FD · PRO</Text>
        </Pressable>
        <Pressable style={styles.proActionButton} onPress={() => router.push('/paywall')}>
          <Text style={styles.proActionText}>📈 Step-up · PRO</Text>
        </Pressable>
      </View>

      <Pressable style={styles.ctaButton} onPress={() => setPhase('share')}>
        <Text style={styles.ctaButtonText}>⬆ Share my jar</Text>
      </Pressable>

      <Text style={styles.disclaimer}>Returns are assumed for illustration and are not guaranteed. Not financial advice.</Text>

      {selectedBall != null && (
        <BallDetail ball={selectedBall} total={finalTotal} onClose={() => setSelectedBall(null)} />
      )}
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

function BallDetail({ ball, total, onClose }: { ball: Ball; total: number; onClose: () => void }) {
  const tierIndex = TIERS.indexOf(ball.tier);
  const prevTier = tierIndex > 0 ? TIERS[tierIndex - 1] : null;
  const label = TIER_LABEL[ball.tier] ?? `₹${ball.tier >= 1000 ? `${ball.tier / 1000}K` : ball.tier}`;
  const prevLabel = prevTier != null ? (TIER_LABEL[prevTier] ?? `₹${prevTier / 1000}K`) : null;
  const familyLabel = ball.family === 'principal' ? 'Invested' : 'Returns';
  const share = ((ball.value / total) * 100).toFixed(1);
  const size = 90;

  return (
    <View style={styles.overlay}>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={onClose} hitSlop={10}>
          <Text style={styles.iconText}>‹</Text>
        </Pressable>
      </View>

      <View style={styles.detailBallWrap}>
        <View style={[styles.detailBall, { width: size, height: size, borderRadius: size / 2, backgroundColor: FAMILY_COLOR[ball.family] }]}>
          {TIER_LABEL[ball.tier] != null && <Text style={styles.detailBallLabel}>{TIER_LABEL[ball.tier]}</Text>}
        </View>
      </View>

      <Text style={styles.detailEyebrow}>{familyLabel.toUpperCase()} BALL</Text>
      <Text style={styles.detailValue}>{formatINR(ball.value)}</Text>
      <Text style={styles.detailDescription}>
        {ball.family === 'returns'
          ? 'Money your money made — you never put this in.'
          : 'Money you actually put in.'}
      </Text>

      <View style={styles.detailRow}>
        <Text style={styles.detailRowLabel}>Formed in</Text>
        <Text style={styles.detailRowValue}>Year {ball.sourceYear}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailRowLabel}>Tier</Text>
        <Text style={styles.detailRowValue}>{label} · glass with glow</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailRowLabel}>Share of your jar</Text>
        <Text style={styles.detailRowValue}>{share}%</Text>
      </View>

      {prevLabel != null && (
        <View style={styles.mergeBox}>
          <View style={styles.mergeRow}>
            {Array.from({ length: 10 }).map((_, i) => (
              <View key={i} style={[styles.mergeDot, { backgroundColor: FAMILY_COLOR[ball.family] }]} />
            ))}
            <Text style={styles.mergeArrow}>→</Text>
            <View style={[styles.mergeBig, { backgroundColor: FAMILY_COLOR[ball.family] }]}>
              <Text style={styles.detailBallLabel}>{TIER_LABEL[ball.tier]}</Text>
            </View>
          </View>
          <Text style={styles.mergeCaption}>10 × {prevLabel} {familyLabel.toLowerCase()} balls became one {label} ball</Text>
        </View>
      )}

      <Pressable style={styles.ctaButton} onPress={onClose}>
        <Text style={styles.ctaButtonText}>Back to my jar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  title: { color: colors.text, fontSize: 18, fontWeight: '900' },
  titleFaint: { color: colors.textFaint, fontWeight: '700', fontSize: 14 },
  stepLabel: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  subtitle: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },

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
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginVertical: 10 },
  stepperButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  stepperText: { color: colors.text, fontSize: 20, fontWeight: '900' },
  stepperValue: { color: colors.text, fontSize: 26, fontWeight: '900' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { backgroundColor: colors.cardAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#1a1200' },
  dropPreviewRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 },
  dropDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue },
  dropHint: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 8 },
  fineSlider: { marginTop: 4, height: 24 },

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
  resultEyebrow: { color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  resultValue: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 4 },
  resultDelta: { color: colors.green, fontSize: 12, fontWeight: '700', marginTop: 2 },
  jarWrap: { alignItems: 'center', marginVertical: 12 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.textFaint, fontSize: 12 },
  legendValue: { color: colors.text, fontSize: 12, fontWeight: '800' },

  flexScreen: { flex: 1, backgroundColor: colors.bg },
  resultPanelGrow: { flex: 1, justifyContent: 'center' },
  fixedFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.bg,
  },
  bottomRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  secondaryButtonText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  ctaButtonSmall: { flex: 1.3, backgroundColor: colors.gold, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  ctaButtonDisabled: { opacity: 0.4 },
  ctaButtonSmallText: { color: '#1a1200', fontWeight: '900', fontSize: 14 },

  heroEyebrow: { color: colors.textFaint, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  heroValue: { color: colors.gold, fontSize: 32, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  heroSubtext: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2, marginBottom: 12 },

  yearChartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  yearChartLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  exploreLink: { color: colors.link, fontSize: 12, fontWeight: '700' },
  yearChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 60, marginBottom: 16 },
  yearBar: { flex: 1, backgroundColor: colors.indigo, borderRadius: 3 },

  proActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  proActionButton: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  proActionText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },

  disclaimer: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 16 },

  shareCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    borderRadius: 22,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  shareBrand: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 8 },
  shareLine: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  shareValue: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  shareDisclaimer: { color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: 10 },
  shareIconsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  shareIconItem: { alignItems: 'center', gap: 4 },
  shareIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  shareIconGlyph: { fontSize: 18 },
  shareIconLabel: { color: colors.textFaint, fontSize: 10 },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, padding: 16, paddingTop: 56 },
  detailBallWrap: { alignItems: 'center', marginVertical: 20 },
  detailBall: { alignItems: 'center', justifyContent: 'center', shadowColor: colors.gold, shadowOpacity: 0.5, shadowRadius: 20 },
  detailBallLabel: { color: '#fff', fontWeight: '900', fontSize: 12 },
  detailEyebrow: { color: colors.textFaint, fontSize: 11, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 },
  detailValue: { color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  detailDescription: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 20, paddingHorizontal: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailRowLabel: { color: colors.textFaint, fontSize: 13 },
  detailRowValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  mergeBox: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginTop: 20, marginBottom: 20 },
  mergeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  mergeDot: { width: 10, height: 10, borderRadius: 5 },
  mergeArrow: { color: colors.textMuted, fontSize: 16, marginHorizontal: 6 },
  mergeBig: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mergeCaption: { color: colors.textFaint, fontSize: 11, marginTop: 10 },
});
