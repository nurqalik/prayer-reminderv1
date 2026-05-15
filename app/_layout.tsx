import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/theme/colors';
import { ThemeProvider } from '@/theme/theme-provider';
import { osName } from 'expo-device';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack, useRouter, useSegments, useLocalSearchParams } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { setBackgroundColorAsync } from 'expo-system-ui';
import React, { useEffect, useState } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { ToastProvider } from '@/components/ui/toast';
import { TRPCProvider } from '@/providers/trpc-provider';
import { AuthProvider, useAuthContext } from '@/providers/auth-provider';

SplashScreen.setOptions({
  duration: 200,
  fade: true,
});

function RootLayoutNav() {
  const colorScheme = useColorScheme() || 'light';
  const { userId, isLoading, isGuest } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync(
        colorScheme === 'light' ? 'dark' : 'light'
      );
    }
  }, [colorScheme]);

  // Handle authentication gating
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isUpgrading = params.upgrade === 'true';

    if (!userId && !inAuthGroup) {
      // Redirect to login if not authenticated and not in auth group
      router.replace('/(auth)/login');
    } else if (userId && inAuthGroup) {
      // Redirect to home if authenticated and in auth group
      // UNLESS we are a guest who is explicitly upgrading
      if (isGuest && isUpgrading) {
        // Stay on login screen for upgrading
        return;
      }
      router.replace('/(tabs)/(home)');
    }
    
    setIsReady(true);
  }, [userId, isLoading, segments, isGuest, params.upgrade]);

  if (isLoading || !isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background }}>
        <ActivityIndicator size="large" color={Colors.light.blue} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      <Stack.Screen
        name='sheet'
        options={{
          headerShown: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.4, 0.7, 1],
          contentStyle: {
            backgroundColor: isLiquidGlassAvailable()
              ? 'transparent'
              : colorScheme === 'dark'
              ? Colors.dark.card
              : Colors.light.card,
          },
          headerTransparent: Platform.OS === 'ios' ? true : false,
          headerLargeTitle: false,
          title: '',
          presentation:
            Platform.OS === 'ios'
              ? isLiquidGlassAvailable() && osName !== 'iPadOS'
                ? 'formSheet'
                : 'modal'
              : 'modal',
          sheetInitialDetentIndex: 0,
          headerStyle: {
            backgroundColor:
              Platform.OS === 'ios'
                ? 'transparent'
                : colorScheme === 'dark'
                ? Colors.dark.card
                : Colors.light.card,
          },
          headerBlurEffect: isLiquidGlassAvailable()
            ? undefined
            : colorScheme === 'dark'
            ? 'dark'
            : 'light',
        }}
      />
      <Stack.Screen name='+not-found' />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme() || 'light';

  // Keep the root view background color in sync with the current theme
  useEffect(() => {
    setBackgroundColorAsync(
      colorScheme === 'dark' ? Colors.dark.background : Colors.light.background
    );
  }, [colorScheme]);

  return (
    <TRPCProvider>
      <AuthProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ToastProvider>
            <ThemeProvider>
              <StatusBar
                style={colorScheme === 'dark' ? 'light' : 'dark'}
                animated
              />
              <RootLayoutNav />
            </ThemeProvider>
          </ToastProvider>
        </GestureHandlerRootView>
      </AuthProvider>
    </TRPCProvider>
  );
}
