import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Baloo2_700Bold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold } from '@expo-google-fonts/figtree';
import { AuthProvider } from '../auth';
import { BookingEvents } from '../components/BookingEvents';
import { TripBroadcaster } from '../components/TripBroadcaster';
import { StoreProvider } from '../store';
import { C } from '../theme';

// Keep the native splash (plain dark, same as the animated one) up until the fonts are ready, so there is never a blank or placeholder frame.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded] = useFonts({ Baloo2_700Bold, Baloo2_800ExtraBold, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold });
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  // Phones stay in portrait; tablets and foldables (shortest side 600dp or more) may rotate and resize freely, as Android's
  // large-screen guidance asks. The manifest itself no longer carries an orientation restriction.
  const { width, height } = useWindowDimensions();
  const largeScreen = Math.min(width, height) >= 600;
  useEffect(() => {
    (largeScreen ? ScreenOrientation.unlockAsync() : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)).catch(() => {});
  }, [largeScreen]);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
      <StoreProvider>
        <StatusBar style="auto" />
        <BookingEvents />
        <TripBroadcaster />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: C.bg } }}>
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="home" options={{ animation: 'fade' }} />
          <Stack.Screen name="my-rides" options={{ animation: 'fade' }} />
          <Stack.Screen name="inbox" options={{ animation: 'fade' }} />
          <Stack.Screen name="profile" options={{ animation: 'fade' }} />
          <Stack.Screen name="booked" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="published" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack>
      </StoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
