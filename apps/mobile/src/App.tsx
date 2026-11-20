import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initAds } from '@/components/admob';
import { ApiError } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { flushPendingNavigation, navigationRef, router } from '@/lib/nav';
import { onNotificationOpened, registerForPush, routeForNotification } from '@/lib/push';
import { disconnectSocket } from '@/lib/socket';
import { C } from '@/lib/theme';
import { linking, RootNavigator } from '@/navigation/RootNavigator';

const navTheme = {
  dark: false,
  colors: { primary: C.teal, background: C.mint, card: C.white, text: C.text, border: C.border, notification: C.bad },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '800' as const },
  },
};

/** Session side-effects: push registration + notification taps, socket teardown on sign-out. */
function SessionEffects() {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== 'signedIn') {
      disconnectSocket();
      return;
    }
    registerForPush();
    return onNotificationOpened((data) => {
      const route = routeForNotification(data);
      if (route) router.push(route);
    });
  }, [status]);
  return null;
}

export default function App() {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: (n, e) => !(e instanceof ApiError && e.status > 0 && e.status < 500) && n < 2 },
        },
      }),
  );
  useEffect(() => {
    initAds();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={qc}>
          <I18nProvider>
            <AuthProvider>
              <StatusBar barStyle="light-content" />
              <NavigationContainer ref={navigationRef} linking={linking} theme={navTheme} onReady={flushPendingNavigation}>
                <SessionEffects />
                <RootNavigator />
              </NavigationContainer>
            </AuthProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
