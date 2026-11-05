import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useSubscription } from './SubscriptionContext';

/**
 * Wraps a PRO-tagged action. Pro users get the action; everyone else goes straight to the paywall.
 *
 *   const { requirePro } = useProGate();
 *   <Pressable onPress={() => requirePro('Step-up SIP', () => ...)} />
 *
 * `feature` names the Pro feature at the call site (kept for readability and future analytics).
 */
export function useProGate() {
  const { isPro } = useSubscription();

  const requirePro = useCallback(
    (_feature: string, action: () => void) => {
      if (isPro) action();
      else router.push('/paywall');
    },
    [isPro]
  );

  return { isPro, requirePro };
}

/** For Pro features that aren't built yet: Pro users see this instead of a dead button. */
export function showComingSoon(feature: string) {
  Alert.alert('Coming soon', `${feature} is on its way. It will unlock automatically for you as a Pro user.`);
}
