import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Small key-value store: SecureStore on native, localStorage on web. Failures are ignored on purpose.
export async function getItem(key: string): Promise<string | null> {
  try {
    return Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {}
}

export async function removeItem(key: string) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {}
}
