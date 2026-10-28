/**
 * Two-jar Filament scene: top source jar, glass funnel, bottom collection jar.
 *
 * UNVERIFIED against the installed react-native-filament API — see ./README.md. The import names
 * and component props below reflect the library's general shape (a Filament root view, a declarative
 * Model/Camera/Light scene graph, a Bullet-backed physics world) but must be checked against
 * `node_modules/react-native-filament`'s actual exports before this will compile.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gyroscope } from 'expo-sensors';
// @ts-expect-error - verify these exports against the installed react-native-filament version
import { FilamentScene, FilamentView, Camera, DefaultLight, Model, useFilamentContext } from 'react-native-filament';
import { JarState } from '@/lib/balls/types';
import { JarScene, JarBounds } from './sceneState';

const TOP_BOUNDS: JarBounds = { centerX: 0, centerZ: 0, radius: 60, floorY: 220 };
const BOTTOM_BOUNDS: JarBounds = { centerX: 0, centerZ: 0, radius: 90, floorY: 0 };
const MAX_TILT_DEG = 6;

export interface TwoJarSceneProps {
  topJar: JarState;
  bottomJar: JarState;
  /** Called every frame the scene is awake; return false once nothing is moving to let it sleep. */
  onFrame?: (topScene: JarScene, bottomScene: JarScene) => void;
}

export function TwoJarScene({ topJar, bottomJar, onFrame }: TwoJarSceneProps) {
  const topScene = useRef(new JarScene(TOP_BOUNDS)).current;
  const bottomScene = useRef(new JarScene(BOTTOM_BOUNDS)).current;
  const tilt = useRef({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const sub = Gyroscope.addListener(({ x, y }) => {
      tilt.current.x = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, x * 20));
      tilt.current.y = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, y * 20));
    });
    Gyroscope.setUpdateInterval(100);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    topScene.syncWithJar(topJar);
  }, [topJar, topScene]);

  useEffect(() => {
    bottomScene.syncWithJar(bottomJar);
  }, [bottomJar, bottomScene]);

  useEffect(() => {
    let last = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      topScene.step(dt);
      bottomScene.step(dt);
      onFrame?.(topScene, bottomScene);

      // Pause the render loop once both jars are at rest; a future ball add/remove restarts it
      // via the syncWithJar effects above re-arming `settled = false` on new balls.
      if (!topScene.isAtRest() || !bottomScene.isAtRest()) {
        raf.current = requestAnimationFrame(loop);
      } else {
        raf.current = null;
      }
    };

    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [topScene, bottomScene, onFrame]);

  return (
    <View style={styles.container}>
      <FilamentScene>
        <FilamentView style={styles.filament}>
          <Camera
            position={[0, 220, 420]}
            // Camera tilted ~20° from above, plus gyroscope parallax of up to ±6°.
            rotation={[-20 + tilt.current.y, tilt.current.x, 0]}
          />
          <DefaultLight intensity={60000} />
          <Model source={require('@/assets/models/jar.glb')} position={[0, TOP_BOUNDS.floorY, 0]} />
          <Model source={require('@/assets/models/funnel.glb')} position={[0, 110, 0]} />
          <Model source={require('@/assets/models/jar.glb')} position={[0, BOTTOM_BOUNDS.floorY, 0]} scale={[1.4, 1.4, 1.4]} />
          <BallInstances scene={topScene} />
          <BallInstances scene={bottomScene} />
        </FilamentView>
      </FilamentScene>
    </View>
  );
}

function BallInstances({ scene }: { scene: JarScene }) {
  // react-native-filament typically wants instanced/batched geometry rather than one <Model> per
  // ball for performance at this ball count; verify its instancing API and swap this in.
  return (
    <>
      {Array.from(scene.balls.values()).map((b) => (
        <Model
          key={b.id}
          source={require('@/assets/models/ball.glb')}
          position={[b.position.x, b.position.y, b.position.z]}
          scale={[b.radius / 20, b.radius / 20, b.radius / 20]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filament: { flex: 1 },
});
