import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../auth';
import '../background'; // registers the background booking check at startup
import { useNotificationRouting } from '../notifications';
import { colors } from '../theme';

// Keep the native splash up until the fonts are ready (called at module scope, as the docs recommend).
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Opens the ticket when a booking notification is tapped (only once someone is logged in). */
function NotificationRouter() {
  const { user } = useAuth();
  useNotificationRouting(!!user);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Fonts failing to load is not fatal: the app falls back to the system font.
  if (!ready) return null;

  return (
    <AuthProvider>
      <NotificationRouter />
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" options={{ title: 'Home' }} />
        <Stack.Screen name="results" options={{ title: 'Available trips' }} />
        <Stack.Screen name="seats/[tripId]" options={{ title: 'Select seats' }} />
        <Stack.Screen name="rentals" options={{ title: 'Choose a vehicle' }} />
        <Stack.Screen name="passenger" options={{ title: 'Review & pay' }} />
        <Stack.Screen name="booking/[id]" options={{ title: 'Booking' }} />
        <Stack.Screen name="login" options={{ title: 'Log in', presentation: 'modal' }} />
        <Stack.Screen name="register" options={{ title: 'Create account', presentation: 'modal' }} />
      </Stack>
    </AuthProvider>
  );
}
