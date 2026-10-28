import { JarState, TIER_RADIUS, Ball } from '@/lib/balls/types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface JarBounds {
  /** Jar is modeled as a vertical cylinder: floor at `floorY`, walls at `radius` from (centerX, centerZ). */
  centerX: number;
  centerZ: number;
  radius: number;
  floorY: number;
}

export interface BallPosition {
  id: string;
  tier: Ball['tier'];
  radius: number;
  position: Vec3;
  velocity: Vec3;
  /** True once the ball has come to rest on the jar floor or on other balls. */
  settled: boolean;
}

const GRAVITY = -980; // units/s^2, matches real-world cm/s^2 scale
const RESTITUTION = 0.25;
const SETTLE_VELOCITY = 8;

export class JarScene {
  readonly bounds: JarBounds;
  balls = new Map<string, BallPosition>();
  private rand: () => number;

  constructor(bounds: JarBounds, rand: () => number = Math.random) {
    this.bounds = bounds;
    this.rand = rand;
  }

  /** Spawns a ball above the jar so it can fall in; does nothing if the id is already present. */
  spawn(ball: Ball, spawnHeight = 400): void {
    if (this.balls.has(ball.id)) return;
    const jitterX = (this.rand() - 0.5) * this.bounds.radius;
    const jitterZ = (this.rand() - 0.5) * this.bounds.radius;
    this.balls.set(ball.id, {
      id: ball.id,
      tier: ball.tier,
      radius: TIER_RADIUS[ball.tier],
      position: { x: this.bounds.centerX + jitterX, y: this.bounds.floorY + spawnHeight, z: this.bounds.centerZ + jitterZ },
      velocity: { x: 0, y: 0, z: 0 },
      settled: false,
    });
  }

  remove(ballId: string): void {
    this.balls.delete(ballId);
  }

  /** Adds newly-present balls (spawn above the jar) and drops ones no longer in `jar` (merged/split/transferred away). */
  syncWithJar(jar: JarState): void {
    const presentIds = new Set(jar.balls.map((b) => b.id));
    for (const ball of jar.balls) {
      if (!this.balls.has(ball.id)) this.spawn(ball);
    }
    for (const id of Array.from(this.balls.keys())) {
      if (!presentIds.has(id)) this.remove(id);
    }
  }

  /** Simple gravity + floor-collision integration. Good enough for layout/physics logic tests;
   * the real renderer hands ball-ball collision off to the Filament/Bullet or matter-js world. */
  step(dt: number): void {
    for (const b of this.balls.values()) {
      if (b.settled) continue;
      b.velocity.y += GRAVITY * dt;
      b.position.x += b.velocity.x * dt;
      b.position.y += b.velocity.y * dt;
      b.position.z += b.velocity.z * dt;

      const floor = this.bounds.floorY + b.radius;
      if (b.position.y <= floor) {
        b.position.y = floor;
        if (Math.abs(b.velocity.y) < SETTLE_VELOCITY) {
          b.velocity.y = 0;
          b.settled = true;
        } else {
          b.velocity.y = -b.velocity.y * RESTITUTION;
        }
      }

      const dx = b.position.x - this.bounds.centerX;
      const dz = b.position.z - this.bounds.centerZ;
      const dist = Math.hypot(dx, dz);
      const maxDist = this.bounds.radius - b.radius;
      if (dist > maxDist && maxDist > 0) {
        const scale = maxDist / dist;
        b.position.x = this.bounds.centerX + dx * scale;
        b.position.z = this.bounds.centerZ + dz * scale;
      }
    }
  }

  /** True once nothing is moving — used to pause the render loop. */
  isAtRest(): boolean {
    for (const b of this.balls.values()) {
      if (!b.settled) return false;
    }
    return true;
  }
}

/** Lerps a ball from the top source, through a straight funnel, into the bottom jar's x/z footprint. */
export function funnelPath(
  progress: number, // 0 = at top source, 1 = entering bottom jar
  from: Vec3,
  to: Vec3,
): Vec3 {
  const t = Math.max(0, Math.min(1, progress));
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
}
