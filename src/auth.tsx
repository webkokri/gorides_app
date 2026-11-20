import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { ApiUser, AuthResult, auth, loadToken, saveToken, setUnauthorizedHandler } from './lib/api';
import { addPushListener, forgetPushToken, registerForPushNotifications, unregisterPushNotifications } from './lib/push';

type Ctx = {
  user: ApiUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (b: Parameters<typeof auth.completeRegistration>[0]) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: ApiUser) => void;
};
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [ready, setReady] = useState(false);

  const clear = useCallback(async () => {
    await saveToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    // one device per account: when the account is signed in somewhere else this device is signed out at once, with the reason
    let told = false;
    const signedOutElsewhere = () => {
      forgetPushToken();
      clear();
      router.replace('/signin');
      if (!told) {
        told = true;
        Alert.alert('Signed out', 'Your account was signed in on another device, so you were signed out here.', [{ text: 'OK', onPress: () => (told = false) }]);
      }
    };
    setUnauthorizedHandler((replaced) => {
      if (replaced) return signedOutElsewhere();
      clear();
      router.replace('/signin');
    });
    // a background device is told by push straight away
    const stopPush = addPushListener((d) => d?.type === 'session_replaced' && signedOutElsewhere());
    (async () => {
      if (await loadToken()) {
        try {
          setUser(await auth.me());
          registerForPushNotifications();
        } catch {
          await clear();
        }
      }
      setReady(true);
    })();
    return () => {
      setUnauthorizedHandler(null);
      stopPush();
    };
  }, [clear]);

  const accept = useCallback(async (r: AuthResult) => {
    await saveToken(r.token, r.refresh_token);
    setUser(r.user);
    registerForPushNotifications();
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      ready,
      signIn: async (email, password) => accept(await auth.login(email.trim(), password)),
      // call after /auth/verify-otp succeeded for the same mobile number
      signUp: async (b) => accept(await auth.completeRegistration(b)),
      setUser,
      signOut: async () => {
        await unregisterPushNotifications();
        await auth.logout().catch(() => {});
        await clear();
      },
    }),
    [user, ready, accept, clear],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be inside AuthProvider');
  return c;
}
