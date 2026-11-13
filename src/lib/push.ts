import { Platform } from 'react-native';
import * as Device from 'expo-device';
import type * as NotificationsType from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { users } from './api';
import { getItem, setItem } from './storage';

// Expo Go on Android throws as soon as expo-notifications is imported (push was removed from Expo Go in SDK 53), which
// crashed the whole app at start. Only load it in real builds; in Expo Go push is simply skipped.
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications: typeof NotificationsType | null = inExpoGo ? null : (require('expo-notifications') as typeof NotificationsType);

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let registeredToken: string | null = null;

/** Call once the user is signed in. Safe to call repeatedly (e.g. on every app start) -- no-ops if already registered this session. */
export async function registerForPushNotifications() {
  if (!Notifications || !Device.isDevice) return; // Expo Go, simulators and emulators have no push capability
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token || token === registeredToken) return;

    await users.registerDeviceToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
    registeredToken = token;
  } catch {
    // Non-fatal -- the app works fine without push, just without instant background alerts.
  }
}

/** Fires `onReceived` the moment a push arrives (foreground) or is tapped (background/killed), so callers can react instantly instead of waiting on their own poll. No-op in Expo Go. Returns an unsubscribe function. */
export function addPushListener(onReceived: (data: Record<string, any>) => void): () => void {
  if (!Notifications) return () => {};
  const sub1 = Notifications.addNotificationReceivedListener((n) => onReceived(n.request.content.data ?? {}));
  const sub2 = Notifications.addNotificationResponseReceivedListener((r) => onReceived(r.notification.request.content.data ?? {}));
  return () => {
    sub1.remove();
    sub2.remove();
  };
}

/** Call on sign-out so this device stops getting pushes for the account that just signed out. */
export async function unregisterPushNotifications() {
  if (!registeredToken) return;
  try {
    await users.unregisterDeviceToken(registeredToken);
  } catch {
    // Non-fatal.
  } finally {
    registeredToken = null;
  }
}

/**
 * Calls `onTap` when the person taps a push notification (also when it is what opened the app). Skips Expo Go.
 * The last handled notification is remembered so a cold start doesn't replay an old tap.
 */
export function listenForPushTaps(onTap: (data: Record<string, unknown>) => void): () => void {
  if (!Notifications) return () => {};
  let handledId = '';
  const handle = async (r: NotificationsType.NotificationResponse) => {
    const id = r.notification.request.identifier;
    if (id === handledId) return;
    handledId = id;
    const last = await getItem('gorides.push.last');
    if (last === id) return;
    await setItem('gorides.push.last', id);
    onTap((r.notification.request.content.data ?? {}) as Record<string, unknown>);
  };
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  Notifications.getLastNotificationResponseAsync().then((r) => r && handle(r)).catch(() => {});
  return () => sub.remove();
}
