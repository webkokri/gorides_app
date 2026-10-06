import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Baloo2_700Bold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold } from '@expo-google-fonts/figtree';
import { AuthProvider } from '../auth';
import { StoreProvider } from '../store';
import { C } from '../theme';

export default function RootLayout() {
  const [loaded] = useFonts({ Baloo2_700Bold, Baloo2_800ExtraBold, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.o }} />;
  return (
    <SafeAreaProvider>
      <AuthProvider>
      <StoreProvider>
        <StatusBar style="auto" />
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
