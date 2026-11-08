const { withGradleProperties } = require('expo/config-plugins');

// Keeps the Gradle daemon from being OOM-killed on EAS when R8 and the native
// CMake builds (worklets, reanimated, skia) run at the same time. One worker
// serialises them; RevenueCat (Compose + Amazon SDK) made R8 much heavier.
const PROPERTIES = {
  'org.gradle.jvmargs': '-Xmx3g -XX:MaxMetaspaceSize=768m',
  'org.gradle.parallel': 'false',
  'org.gradle.workers.max': '1',
  // Compile Kotlin inside the Gradle daemon instead of a separate Kotlin daemon JVM.
  'kotlin.compiler.execution.strategy': 'in-process',
};

function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const keys = Object.keys(PROPERTIES);
    // Drop existing entries for these keys so each one appears exactly once.
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && keys.includes(item.key))
    );
    for (const key of keys) {
      cfg.modResults.push({ type: 'property', key, value: PROPERTIES[key] });
    }
    return cfg;
  });
}

module.exports = withGradleMemory;
