import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../auth';
import { DutiesProvider } from '../duties';
import '../location'; // registers the background location task at startup
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack({ fontsReady }: { fontsReady: boolean }) {
  const { ready, user, access } = useAuth();
  const show = ready && fontsReady;
  useEffect(() => {
    if (show) SplashScreen.hideAsync().catch(() => {});
  }, [show]);
  // The native splash stays up until auth is restored and the Inter fonts are loaded.
  if (!show) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
      {/* Routing by account status (see Access in auth.tsx). Guards switch in one state update, so
          expo-router moves straight to the first allowed screen without flashing anything else. */}
      <Stack.Protected guard={!!user && access === 'driver' && user.role === 'DRIVER'}>
        <Stack.Screen name="(tabs)" options={{ title: 'Duties' }} />
        <Stack.Screen name="trip/[id]" options={{ title: 'Shared trip' }} />
        <Stack.Screen name="rental/[id]" options={{ title: 'Full cab' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!user && (access === 'pending' || access === 'rejected' || access === 'unknown')}>
        <Stack.Screen name="status" options={{ title: 'Application status', animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!user && (access === 'apply' || access === 'rejected')}>
        <Stack.Screen name="apply" options={{ title: 'Apply to drive', animation: access === 'apply' ? 'fade' : 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  return (
    <AuthProvider>
      <DutiesProvider>
        <StatusBar style="light" />
        {/* If the fonts fail to load, carry on with the system font rather than hang on the splash. */}
        <RootStack fontsReady={loaded || !!fontError} />
      </DutiesProvider>
    </AuthProvider>
  );
}
