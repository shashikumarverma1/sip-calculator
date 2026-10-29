import { useEffect } from 'react';
import { router } from 'expo-router';
import { useProStore } from '@/store/proStore';

/**
 * Bounces non-Pro users to the paywall if a Pro-only screen is reached directly (deep link, back
 * button, etc.) rather than through an already-gated tile. Waits for the store's initial
 * entitlement fetch (`ready`) before deciding, so a Pro user isn't bounced during the brief
 * window where `isPro` still reads false while RevenueCat is loading.
 */
export function useRequirePro(): boolean {
  const isPro = useProStore((s) => s.isPro);
  const ready = useProStore((s) => s.ready);

  useEffect(() => {
    if (ready && !isPro) router.replace('/paywall');
  }, [ready, isPro]);

  return isPro;
}
