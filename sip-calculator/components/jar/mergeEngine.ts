import Matter from 'matter-js';
import type { BallBody, BallColor } from './PhysicsWorld';

export const MERGE_THRESHOLD = 10;

/** Finds the oldest `MERGE_THRESHOLD` bodies of a given tier+color, if enough exist. */
export function findMergeBatch(
  bodies: BallBody[],
  tier: number,
  color: BallColor,
): BallBody[] | null {
  const matching = bodies.filter((b) => b.meta.tier === tier && b.meta.color === color);
  if (matching.length < MERGE_THRESHOLD) return null;
  matching.sort((a, b) => a.meta.createdAt - b.meta.createdAt);
  return matching.slice(0, MERGE_THRESHOLD);
}

export function centroidOf(bodies: Matter.Body[]): { x: number; y: number } {
  const sum = bodies.reduce(
    (acc, b) => ({ x: acc.x + b.position.x, y: acc.y + b.position.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / bodies.length, y: sum.y / bodies.length };
}
