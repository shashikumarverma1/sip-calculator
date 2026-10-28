import { Ball, Family, JarState, TIERS } from './types';
import { countsToUnits, unitsToCounts } from './decompose';

export type BallEventType = 'merge' | 'split';

export interface BallEvent {
  type: BallEventType;
  family: Family;
  /** The tier a merge consumed 10 of, or a split produced 10 of. */
  tier: number;
}

let nextId = 0;
function genId(): string {
  nextId += 1;
  return `ball_${nextId}`;
}

/** Exposed for tests that need deterministic ids across runs. */
export function resetIdCounter(): void {
  nextId = 0;
}

function countsOfFamily(jar: JarState, family: Family): number[] {
  return TIERS.map((tier) => jar.balls.filter((b) => b.family === family && b.tier === tier).length);
}

function applyCountDiff(
  jar: JarState,
  family: Family,
  oldCounts: number[],
  newCounts: number[],
  year: number,
  mode: 'add' | 'remove',
): BallEvent[] {
  const events: BallEvent[] = [];
  for (let i = 0; i < TIERS.length; i++) {
    const diff = newCounts[i] - oldCounts[i];
    const tier = TIERS[i];
    if (diff > 0) {
      for (let k = 0; k < diff; k++) {
        jar.balls.push({ id: genId(), tier, value: tier, family, sourceYear: year, jarId: jar.jarId });
      }
    } else if (diff < 0) {
      let toRemove = -diff;
      const remaining: Ball[] = [];
      for (const b of jar.balls) {
        if (toRemove > 0 && b.family === family && b.tier === tier) {
          toRemove -= 1;
          continue;
        }
        remaining.push(b);
      }
      jar.balls = remaining;
      events.push({ type: mode === 'add' ? 'merge' : 'split', family, tier });
    }
  }
  return events;
}

/**
 * Adds `amount` of `family` money to the jar. New balls are minted at the 1K tier and carried
 * upward (10 same-tier same-family balls merge into 1 of the next tier), mirroring how the
 * ball counts would look if the whole family total were freshly decomposed.
 */
export function addValue(jar: JarState, amount: number, family: Family, year: number): BallEvent[] {
  if (amount <= 0) return [];
  const combined = jar.partial[family] + amount;
  const wholeThousands = Math.floor(combined / 1000);
  jar.partial[family] = combined - wholeThousands * 1000;
  if (wholeThousands <= 0) return [];

  const oldCounts = countsOfFamily(jar, family);
  const newUnits = countsToUnits(oldCounts) + wholeThousands;
  const newCounts = unitsToCounts(newUnits);
  return applyCountDiff(jar, family, oldCounts, newCounts, year, 'add');
}

/**
 * Removes `amount` of `family` money from the jar. When the exact tier needed is empty, the
 * smallest larger ball is cracked into 10 of the tier below (and so on down) until there is
 * enough to remove — mirrored here as a single counts-level subtraction with borrowing.
 */
export function removeValue(jar: JarState, amount: number, family: Family, year: number): BallEvent[] {
  if (amount <= 0) return [];
  const combinedNeeded = amount - jar.partial[family];
  if (combinedNeeded <= 0) {
    jar.partial[family] -= amount;
    return [];
  }
  jar.partial[family] = 0;
  const wholeThousandsNeeded = Math.ceil(combinedNeeded / 1000);
  const excess = wholeThousandsNeeded * 1000 - combinedNeeded;

  const oldCounts = countsOfFamily(jar, family);
  const oldUnits = countsToUnits(oldCounts);
  const newUnits = oldUnits - wholeThousandsNeeded;
  if (newUnits < 0) {
    throw new Error(`Cannot remove ${amount} of ${family} from jar ${jar.jarId}: only ${oldUnits * 1000} available`);
  }
  const newCounts = unitsToCounts(newUnits);
  const events = applyCountDiff(jar, family, oldCounts, newCounts, year, 'remove');
  jar.partial[family] += excess;
  return events;
}

/** Moves `amount` of `family` money from one jar to another (e.g. through the funnel). */
export function transfer(from: JarState, to: JarState, amount: number, family: Family, year: number): BallEvent[] {
  const removeEvents = removeValue(from, amount, family, year);
  const addEvents = addValue(to, amount, family, year);
  return [...removeEvents, ...addEvents];
}
