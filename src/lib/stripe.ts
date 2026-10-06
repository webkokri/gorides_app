import { initPaymentSheet, initStripe, presentPaymentSheet } from '@stripe/stripe-react-native';
import { settings } from './api';

let ready = false;

/** Collect payment for a PaymentIntent client secret with Stripe's PaymentSheet. Resolves true if paid, false if the user closed it. */
export async function payWithStripe(clientSecret: string): Promise<boolean> {
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

export const stripeSupported = true;
