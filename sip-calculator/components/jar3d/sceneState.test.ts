import { JarScene, funnelPath } from './sceneState';
import { createJar } from '@/lib/balls/types';
import { addValue } from '@/lib/balls/engine';

const bounds = { centerX: 0, centerZ: 0, radius: 60, floorY: 0 };

describe('JarScene', () => {
  it('spawns a ball above the jar and settles it on the floor under gravity', () => {
    const scene = new JarScene(bounds, () => 0.5);
    const jar = createJar('bottom');
    addValue(jar, 1_000, 'principal', 1);
    scene.syncWithJar(jar);
    expect(scene.balls.size).toBe(1);

    for (let i = 0; i < 200; i++) scene.step(1 / 60);

    const ball = Array.from(scene.balls.values())[0];
    expect(ball.settled).toBe(true);
    expect(ball.position.y).toBeCloseTo(ball.radius, 0);
  });

  it('keeps balls within the jar radius', () => {
    const scene = new JarScene(bounds, () => 1); // worst-case jitter toward the wall
    const jar = createJar('bottom');
    addValue(jar, 1_000, 'principal', 1);
    scene.syncWithJar(jar);
    for (let i = 0; i < 60; i++) scene.step(1 / 60);
    const ball = Array.from(scene.balls.values())[0];
    const dist = Math.hypot(ball.position.x, ball.position.z);
    expect(dist).toBeLessThanOrEqual(bounds.radius - ball.radius + 0.01);
  });

  it('removes balls that disappear from the jar (merge/split/transfer)', () => {
    const scene = new JarScene(bounds);
    const jar = createJar('bottom');
    for (let i = 0; i < 10; i++) addValue(jar, 1_000, 'principal', 1); // triggers a merge to 10K
    scene.syncWithJar(jar);
    expect(scene.balls.size).toBe(jar.balls.length);
  });

  it('reports isAtRest only once everything has settled', () => {
    const scene = new JarScene(bounds);
    const jar = createJar('bottom');
    addValue(jar, 1_000, 'principal', 1);
    scene.syncWithJar(jar);
    expect(scene.isAtRest()).toBe(false);
    for (let i = 0; i < 200; i++) scene.step(1 / 60);
    expect(scene.isAtRest()).toBe(true);
  });
});

describe('funnelPath', () => {
  it('interpolates linearly between the source and the jar entry point', () => {
    const from = { x: 0, y: 100, z: 0 };
    const to = { x: 0, y: 0, z: 0 };
    expect(funnelPath(0, from, to)).toEqual(from);
    expect(funnelPath(1, from, to)).toEqual(to);
    expect(funnelPath(0.5, from, to)).toEqual({ x: 0, y: 50, z: 0 });
  });

  it('clamps progress outside [0, 1]', () => {
    const from = { x: 0, y: 100, z: 0 };
    const to = { x: 0, y: 0, z: 0 };
    expect(funnelPath(-1, from, to)).toEqual(from);
    expect(funnelPath(2, from, to)).toEqual(to);
  });
});
