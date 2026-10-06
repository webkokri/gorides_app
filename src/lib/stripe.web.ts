export const stripeSupported = false;

export async function payWithStripe(_clientSecret: string): Promise<boolean> {
  throw new Error('Card payments are only available in the mobile app. Use your wallet instead.');
}
