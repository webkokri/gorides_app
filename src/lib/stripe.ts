import Constants, { ExecutionEnvironment } from 'expo-constants';
import { settings } from './api';

// Expo Go doesn't ship this app's Stripe version, so load it only in a real build and hide card payments in Expo Go.
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stripe = (): typeof import('@stripe/stripe-react-native') => require('@stripe/stripe-react-native');

let ready = false;

/** Collect payment for a PaymentIntent client secret with Stripe's PaymentSheet. Resolves true if paid, false if the user closed it. */
export async function payWithStripe(clientSecret: string): Promise<boolean> {
  if (inExpoGo) throw new Error('Card payments need the installed app. Use your wallet in Expo Go.');
  const { initPaymentSheet, initStripe, presentPaymentSheet } = stripe();
  if (!ready) {
    const cfg = await settings.stripe();
    if (!cfg.configured || !cfg.publishableKey) throw new Error('Card payments are not available yet. Use your wallet instead.');
    await initStripe({ publishableKey: cfg.publishableKey });
    ready = true;
  }
  const init = await initPaymentSheet({ paymentIntentClientSecret: clientSecret, merchantDisplayName: 'GORIDES', returnURL: 'gorides://stripe-redirect' });
  if (init.error) throw new Error(init.error.message);
  const res = await presentPaymentSheet();
  if (res.error) {
    if (res.error.code === 'Canceled') return false;
    throw new Error(res.error.message);
  }
  return true;
}

export const stripeSupported = !inExpoGo;
