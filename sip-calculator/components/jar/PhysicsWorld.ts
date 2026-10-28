import Matter from 'matter-js';
import { findMergeBatch, centroidOf } from './mergeEngine';

export type BallColor = 'blue' | 'gold' | 'red';

export interface BallMeta {
  id: number;
  tier: number;
  color: BallColor;
  createdAt: number;
}

export type BallBody = Matter.Body & { meta: BallMeta };

export interface TierDef {
  radius: number;
  /** Rupee value a single ball of this tier represents. */
  value: number;
  label: string;
}

export const TIERS: TierDef[] = [
  { radius: 8, value: 1_000, label: '1K' },
  { radius: 14, value: 10_000, label: '10K' },
  { radius: 22, value: 100_000, label: '1L' },
  { radius: 32, value: 1_000_000, label: '10L' },
  { radius: 44, value: 10_000_000, label: '1Cr' },
];

export const MAX_BODIES = 180;

export interface BallSnapshot {
  id: number;
  x: number;
  y: number;
  angle: number;
  tier: number;
  color: BallColor;
}

let nextBallId = 1;

export class PhysicsWorld {
  engine: Matter.Engine;
  world: Matter.World;
  jarWidth: number;
  jarHeight: number;
  ballBodies: Map<number, BallBody> = new Map();
  onMerge?: (tier: number, color: BallColor) => void;

  constructor(jarWidth: number, jarHeight: number) {
    this.jarWidth = jarWidth;
    this.jarHeight = jarHeight;
    this.engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0015 } });
    this.world = this.engine.world;
    this.createWalls();
  }

  private createWalls() {
    const w = this.jarWidth;
    const h = this.jarHeight;
    const t = 24;
    const opts: Matter.IChamferableBodyDefinition = { isStatic: true, friction: 0.5, restitution: 0.1 };
    Matter.World.add(this.world, [
      Matter.Bodies.rectangle(-t / 2, h / 2, t, h, opts),
      Matter.Bodies.rectangle(w + t / 2, h / 2, t, h, opts),
      Matter.Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, opts),
    ]);
  }

  count(tier: number, color: BallColor): number {
    let c = 0;
    this.ballBodies.forEach((b) => {
      if (b.meta.tier === tier && b.meta.color === color) c++;
    });
    return c;
  }

  private createBallBody(tier: number, color: BallColor, x: number, y: number): BallBody {
    const radius = TIERS[Math.min(tier, TIERS.length - 1)].radius;
    const body = Matter.Bodies.circle(x, y, radius, {
      restitution: 0.15,
      friction: 0.4,
      frictionAir: 0.012,
      density: 0.0012,
    }) as BallBody;
    body.meta = { id: nextBallId++, tier, color, createdAt: Date.now() };
    Matter.World.add(this.world, body);
    this.ballBodies.set(body.id, body);
    return body;
  }

  /** Adds one ball of a tier at the top of the jar (or a given x), then checks for a merge. */
  addBall(tier: number, color: BallColor, x?: number): BallBody | null {
    if (this.ballBodies.size >= MAX_BODIES) return null;
    const radius = TIERS[Math.min(tier, TIERS.length - 1)].radius;
    const px = x ?? radius + Math.random() * Math.max(this.jarWidth - radius * 2, 1);
    const body = this.createBallBody(tier, color, px, -radius * 2);
    this.checkMerge(tier, color);
    return body;
  }

  private checkMerge(tier: number, color: BallColor) {
    if (tier >= TIERS.length - 1) return;
    const batch = findMergeBatch(Array.from(this.ballBodies.values()), tier, color);
    if (!batch) return;
    const { x, y } = centroidOf(batch);
    batch.forEach((b) => {
      Matter.World.remove(this.world, b);
      this.ballBodies.delete(b.id);
    });
    this.onMerge?.(tier, color);
    const nextTier = tier + 1;
    if (this.ballBodies.size < MAX_BODIES) {
      this.createBallBody(nextTier, color, x, y);
      this.checkMerge(nextTier, color);
    }
  }

  /** Converts a rupee amount into balls across tiers (base-10 digit decomposition in ₹1000 units) and drops them in. */
  dropAmount(amount: number, color: BallColor) {
    if (amount <= 0) return;
    let units = Math.round(amount / TIERS[0].value);
    const counts: number[] = new Array(TIERS.length).fill(0);
    for (let t = 0; t < TIERS.length; t++) {
      counts[t] = units % 10;
      units = Math.floor(units / 10);
    }
    if (units > 0) counts[TIERS.length - 1] += units;

    for (let t = TIERS.length - 1; t >= 0; t--) {
      for (let i = 0; i < counts[t]; i++) {
        this.addBall(t, color);
      }
    }
  }

  /** Removes balls of a color whose combined value covers `amount`, largest tiers first (reverse of dropAmount). */
  removeAmount(amount: number, color: BallColor) {
    let remaining = amount;
    for (let t = TIERS.length - 1; t >= 0 && remaining >= TIERS[0].value / 2; t--) {
      const value = TIERS[t].value;
      while (remaining >= value) {
        const ball = this.findBallOfTier(t, color);
        if (!ball) break;
        Matter.World.remove(this.world, ball);
        this.ballBodies.delete(ball.id);
        remaining -= value;
      }
    }
  }

  private findBallOfTier(tier: number, color: BallColor): BallBody | null {
    let found: BallBody | null = null;
    this.ballBodies.forEach((b) => {
      if (!found && b.meta.tier === tier && b.meta.color === color) found = b;
    });
    return found;
  }

  reset() {
    this.ballBodies.forEach((b) => Matter.World.remove(this.world, b));
    this.ballBodies.clear();
  }

  step(deltaMs: number) {
    Matter.Engine.update(this.engine, Math.min(deltaMs, 32));
  }

  shake(strength = 6) {
    this.ballBodies.forEach((b) => {
      Matter.Body.applyForce(b, b.position, {
        x: (Math.random() - 0.5) * strength * 0.002,
        y: -Math.random() * strength * 0.002,
      });
    });
  }

  getSnapshot(): BallSnapshot[] {
    const out: BallSnapshot[] = [];
    this.ballBodies.forEach((b) => {
      out.push({ id: b.meta.id, x: b.position.x, y: b.position.y, angle: b.angle, tier: b.meta.tier, color: b.meta.color });
    });
    return out;
  }
}
