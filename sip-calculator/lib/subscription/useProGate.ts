import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useSubscription } from './SubscriptionContext';

/**
 * Wraps a PRO-tagged action. Pro users get the action; everyone else goes straight to the paywall.
 * While the launch status check is still running, the tap waits for it instead of guessing.
 *
 *   const { locked, requirePro } = useProGate();
 *   {locked && <ProTag />}
 *   <Pressable onPress={() => requirePro('Step-up SIP', () => ...)} />
 *
 * `feature` names the Pro feature at the call site (kept for readability and future analytics).
 */
export function useProGate() {
  const { isPro, loading, whenReady } = useSubscription();

  const requirePro = useCallback(
    (_feature: string, action: () => void) => {
      const go = (pro: boolean) => (pro ? action() : router.push('/paywall'));
      // isPro can already be true from the cached status: no need to wait for the launch check.
      if (isPro) action();
      else if (loading) whenReady().then(go);
      else go(isPro);
    },
    [isPro, loading, whenReady]
  );

  /** Show PRO tags / locked UI only once we know the user isn't Pro (never while loading). */
  const locked = !loading && !isPro;

  return { isPro, loading, locked, requirePro };
}

/** For Pro features that aren't built yet: Pro users see this instead of a dead button. */
export function showComingSoon(feature: string) {
  Alert.alert('Coming soon', `${feature} is on its way. It will unlock automatically for you as a Pro user.`);
}
