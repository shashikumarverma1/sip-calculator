# jar3d

Filament-backed renderer for the two-jar flow. **Not yet verified on-device** — see below.

## What's here

- `sceneState.ts` — renderer-agnostic: maps `JarState` (from `/lib/balls`) to 3D positions for the
  top source, funnel, and bottom jar, plus simple fall/settle physics stepping. No native deps, unit tested.
- `Scene.tsx` — the actual `react-native-filament` wiring: loads the jar/funnel/ball models, creates
  rigid bodies, and renders ball positions each frame from `sceneState`.

## Known gaps you need to close before this runs

1. **No `.glb` assets exist yet.** `Scene.tsx` expects `assets/models/jar.glb`, `assets/models/funnel.glb`,
   and `assets/models/ball.glb` (Draco-compressed, with a collider mesh on the jar/funnel). These need to
   be authored/sourced and dropped in. Until then the scene has nothing to load.
2. **`react-native-filament`'s exact API wasn't verified against the installed version.** I don't have
   network access in this environment to check the current API, so `Scene.tsx` is written against the
   general shape of the library (a `<FilamentScene>`/`<FilamentView>` root, `useFilamentContext` or similar
   for the engine, `Model`/`Camera`/`Light` components, and a physics world from the Bullet bindings) but
   the exact hook/component names may differ from what's actually installed. Treat it as a structural
   starting point, not working code — expect to fix import names and prop shapes against
   `node_modules/react-native-filament`'s type definitions once it's installed.
3. **Native build required.** This can't run in Expo Go. After adding the dependency:
   ```
   npx expo prebuild --clean
   npx expo run:android
   ```
4. **Performance target (60fps on mid-range Android, pause when idle) is unverified** — there's no way
   to profile this without a device. Once it builds, check Android GPU profiler / `adb shell dumpsys gfxinfo`.
5. **Dependency isn't installed yet.** Run `npx expo install react-native-filament` (not added to
   `package.json` here deliberately, so Expo resolves a version compatible with this SDK) then re-check
   `Scene.tsx` against its types.

## Suggested path if `Scene.tsx` doesn't match the installed API

Run `rg "export" node_modules/react-native-filament/src` (or check its `.d.ts`) to see the real exports,
then adjust `Scene.tsx`'s imports and physics-body creation calls accordingly — the ball position/event
plumbing from `sceneState.ts` should stay the same either way.
