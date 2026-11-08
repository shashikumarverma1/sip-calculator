import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SubscriptionProvider } from '@/lib/subscription/SubscriptionContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SubscriptionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0b0f1a' },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="sip" />
          <Stack.Screen name="emi" />
          <Stack.Screen name="lumpsum" />
          <Stack.Screen name="compare" />
          <Stack.Screen name="goal" />
          <Stack.Screen name="freedom" />
          <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
          <Stack.Screen name="debug" />
        </Stack>
      </SubscriptionProvider>
    </SafeAreaProvider>
  );
}
