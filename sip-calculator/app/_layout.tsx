import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f1420' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: '#0f1420' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'JarUp' }} />
        <Stack.Screen name="sip" options={{ title: 'SIP Calculator' }} />
        <Stack.Screen name="emi" options={{ title: 'EMI Calculator' }} />
        <Stack.Screen name="lumpsum" options={{ title: 'Lumpsum' }} />
        <Stack.Screen name="compare" options={{ title: 'Compare' }} />
        <Stack.Screen name="goal" options={{ title: 'Goal Mode' }} />
      </Stack>
    </>
  );
}
