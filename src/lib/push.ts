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

/** Asks for the notification permission (once; the system never shows the dialog again after a refusal). No-op in Expo Go. */
export async function askNotificationPermission() {
  if (!Notifications) return;
  try {
    if (Platform.OS === 'android') {
      // Android 13+ only shows the permission dialog once a notification channel exists
      await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.MAX });
    }
    const p = await Notifications.getPermissionsAsync();
    if (p.status !== 'granted' && p.canAskAgain) await Notifications.requestPermissionsAsync();
  } catch {
    // Non-fatal.
  }
}

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

/** The server dropped this device's push token (the account signed in elsewhere): register again on the next sign-in. */
export function forgetPushToken() {
  registeredToken = null;
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
    // the id of a tapped action button (e.g. "Start ride") rides along as `__action`
    onTap({ ...((r.notification.request.content.data ?? {}) as Record<string, unknown>), __action: r.actionIdentifier });
  };
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  Notifications.getLastNotificationResponseAsync().then((r) => r && handle(r)).catch(() => {});
  return () => sub.remove();
}

export const RIDE_START_CATEGORY = 'ride_start';

/** Action buttons shown on the "time to start your ride" notification. */
export async function setupRideCategory() {
  if (!Notifications) return;
  try {
    await Notifications.setNotificationCategoryAsync(RIDE_START_CATEGORY, [
      { identifier: 'start', buttonTitle: 'Start ride', options: { opensAppToForeground: true } },
      { identifier: 'route', buttonTitle: 'Start route', options: { opensAppToForeground: true } },
    ]);
  } catch {
    // Non-fatal: the notification still opens the trip screen.
  }
}

export type LocalReminder = { id: string; at: Date; title: string; body: string; data: Record<string, unknown>; category?: string };

/**
 * Makes the phone's scheduled local notifications that start with `prefix` match `wanted` exactly: new ones are scheduled,
 * ones that are no longer wanted (trip changed, cancelled or finished) are cancelled. Local notifications fire on time even
 * when the app is closed or the phone is offline. No-op in Expo Go or without the notification permission.
 */
export async function syncLocalReminders(prefix: string, wanted: LocalReminder[]) {
  if (!Notifications) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    const existing = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) => n.identifier.startsWith(prefix));
    const keep = new Set(wanted.map((w) => w.id));
    await Promise.all(existing.filter((n) => !keep.has(n.identifier)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    const have = new Set(existing.map((n) => n.identifier));
    for (const w of wanted) {
      if (have.has(w.id)) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: w.id,
        content: { title: w.title, body: w.body, data: w.data, sound: 'default', categoryIdentifier: w.category },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: w.at, channelId: 'default' },
      });
    }
  } catch {
    // Non-fatal: reminders are a convenience on top of the in-app prompt.
  }
}
