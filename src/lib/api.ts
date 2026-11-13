import { getItem, removeItem, setItem } from './storage';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://app.gorides.ca/api';

// ---- token storage (SecureStore on native, localStorage on web) ----
const KEY = 'gorides.token';
const RKEY = 'gorides.refresh';
let token: string | null = null;
let refreshToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

// A button that needs an account was used while signed out: the app shows "log in first" and opens the login page.
let onSignedOutAction: (() => void) | null = null;
export const setSignedOutActionHandler = (fn: (() => void) | null) => {
  onSignedOutAction = fn;
};

export async function loadToken() {
  const [t, r] = await Promise.all([getItem(KEY), getItem(RKEY)]);
  token = t;
  refreshToken = r;
  return token;
}

export const getToken = () => token;

export async function saveToken(t: string | null, refresh?: string | null) {
  token = t;
  if (refresh !== undefined) refreshToken = refresh;
  if (!t) refreshToken = null;
  await Promise.all([t ? setItem(KEY, t) : removeItem(KEY), refreshToken ? setItem(RKEY, refreshToken) : removeItem(RKEY)]);
}

// ---- request helper; every response uses the { success, data, message, error, errors } envelope ----
export const SIGNED_OUT = 'Sign in required';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Opts = { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined>; auth?: boolean; ttl?: number };

// The server rate-limits per IP ("too many requests"), so: identical GETs share one in-flight request, optionally
// stay cached for `ttl` ms, and after a 429 background polling pauses until the server's Retry-After has passed.
let cooldownUntil = 0;
export const isCoolingDown = () => Date.now() < cooldownUntil;
const inflight = new Map<string, { at: number; p: Promise<any> }>();

export function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { method = 'GET', ttl = 0 } = opts;
  if (method !== 'GET') return send<T>(path, opts);
  const key = `${opts.auth === false ? 'p' : token ?? ''}|${path}|${JSON.stringify(opts.query ?? {})}`;
  const hit = inflight.get(key);
  // `at === 0` means still in flight (dedupe concurrent calls to the same
  // GET); once settled, `at` always becomes a real timestamp below, even
  // for ttl=0 -- otherwise a ttl=0 ("always fresh") call that already
  // succeeded once left its entry's `at` stuck at the in-flight sentinel
  // forever (the old `ttl > 0 && ...` guard never updated it), so `at ===
  // 0` kept matching and every later call reused that first stale response
  // for the rest of the app session. Driver/vehicle verification status
  // was exactly this: it only ever changed after a full app restart, which
  // is the only thing that clears this in-memory map.
  if (hit && (hit.at === 0 || Date.now() - hit.at < ttl)) return hit.p;
  const p = send<T>(path, opts);
  inflight.set(key, { at: 0, p });
  p.then(
    () => inflight.set(key, { at: Date.now(), p }),
    () => inflight.delete(key),
  );
  return p;
}

let refreshing: Promise<boolean> | null = null;
/** Swap the refresh token for a new access token (access tokens last 1 hour). Shared so parallel 401s refresh once. */
function refreshSession() {
  refreshing ??= (async () => {
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data?.token) return false;
      await saveToken(json.data.token, json.data.refresh_token ?? refreshToken);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export const UNAVAILABLE = 'This feature is not available on the server yet.';

async function send<T>(path: string, { method = 'GET', body, query, auth = true }: Opts, retried = false): Promise<T> {
  if (auth && !token) {
    if (method !== 'GET') onSignedOutAction?.(); // an action, not a background load
    throw new ApiError(SIGNED_OUT, 401);
  }
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs ? `?${qs}` : ''}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Network error. Check your connection.', 0);
  }
  if (res.status === 429) {
    const wait = Number(res.headers.get('retry-after'));
    cooldownUntil = Date.now() + (wait > 0 ? wait : 60) * 1000;
    throw new ApiError('Too many requests. Please wait a minute and try again.', 429);
  }
  const json = await res.json().catch(() => null);
  if (res.status === 401 && auth && token && !retried && (await refreshSession())) return send<T>(path, { method, body, query, auth }, true);
  // a 404 that is not JSON is the web server's own "page not found": the endpoint is not deployed
  if (res.status === 404 && json === null) throw new ApiError(UNAVAILABLE, 404);
  if (!res.ok || json?.success === false) {
    if (res.status === 401 && auth && token) onUnauthorized?.();
    // the error text is in `error` (or the field map `errors`), never `message`
    const fields = json?.errors ? Object.values(json.errors).join(' ') : '';
    throw new ApiError(json?.error || fields || `Request failed (${res.status})`, res.status);
  }
  return json?.data as T;
}

// ---- types (only the fields the app reads) ----
export type ApiUser = { id: number; email: string; first_name: string; last_name: string; mobile_number: string; avatar_url: string | null; role: string };
export type AuthResult = { user: ApiUser; token: string; refresh_token: string };
export const isUnavailable = (e: unknown) => e instanceof ApiError && e.message === UNAVAILABLE;

// ---- endpoints ----
export const auth = {
  login: (email: string, password: string) => api<AuthResult>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  register: (b: { email: string; password: string; first_name: string; last_name: string; mobile_number: string; profile_type?: 'driver' | 'passenger' }) =>
    api<AuthResult>('/auth/register', { method: 'POST', body: b, auth: false }),
  me: () => api<ApiUser>('/auth/me'),
  logout: () => api('/auth/logout', { method: 'POST' }),
  // OTP signup: send-otp -> verify-otp -> complete-registration. Always pass `email` so delivery works when SMS is off.
  sendOtp: (mobile_number: string, email?: string) => api('/auth/send-otp', { method: 'POST', body: { mobile_number, email, purpose: 'registration' }, auth: false }),
  resendOtp: (mobile_number: string, email?: string) => api('/auth/resend-otp', { method: 'POST', body: { mobile_number, email, purpose: 'registration' }, auth: false }),
  verifyOtp: (mobile_number: string, otp: string) => api('/auth/verify-otp', { method: 'POST', body: { mobile_number, otp }, auth: false }),
  completeRegistration: (b: { mobile_number: string; first_name: string; last_name: string; email: string; password: string; profile_type: 'driver' | 'passenger' }) =>
    api<AuthResult>('/auth/complete-registration', { method: 'POST', body: b, auth: false }),
};

export const users = {
  block: (user_id: number, reason?: string) => api('/users/block', { method: 'POST', body: { user_id, reason } }),
  unblock: (user_id: number) => api('/users/unblock', { method: 'POST', body: { user_id } }),
  blocks: () => api<BlockedUser[]>('/users/blocks'),
  updateAccount: (b: Partial<{ first_name: string; last_name: string; mobile_number: string; city: string; province: string; address: string; postal_code: string }>) => api<ApiUser>('/users/account', { method: 'PUT', body: b }),
  changePassword: (current_password: string, new_password: string) => api('/users/change-password', { method: 'POST', body: { current_password, new_password } }),
  deleteAccount: (password: string) => api('/users/account', { method: 'DELETE', body: { password } }),
  registerDeviceToken: (token: string, platform: 'ios' | 'android') => api('/users/device-token', { method: 'POST', body: { token, platform } }),
  unregisterDeviceToken: (token: string) => api('/users/device-token', { method: 'DELETE', body: { token } }),
  /** Flags another user's profile/behaviour for staff review -- separate from block, which just silences them with no review. */
  report: (reported_user_id: number, reason: ReportReason, details?: string, booking_id?: number) =>
    api('/users/report', { method: 'POST', body: { reported_user_id, reason, details, booking_id } }),
};

export type ReportReason = 'fake_profile' | 'harassment' | 'unsafe_driving' | 'fraud_or_scam' | 'inappropriate_content' | 'other';

export const sos = {
  trigger: (b: { latitude?: number; longitude?: number; booking_id?: number; message?: string }) => api<{ id: number }>('/sos', { method: 'POST', body: b }),
};

export const rides = {
  search: (q: { ride_type?: 'local' | 'intercity'; date_from?: string; date_to?: string; min_seats_available?: number; max_price?: number; start_lat?: number; start_lng?: number; end_lat?: number; end_lng?: number; radius_km?: number }) =>
    api<ApiRide[]>('/rides/search', { query: q, auth: false, ttl: 30000 }),
  get: (id: number | string) => api<ApiRide>(`/rides/${id}`, { auth: false, ttl: 15000 }),
  mine: () => api<ApiRide[]>('/rides/my-rides'),
  /** Driver edits their own ride (title, description, seats, price, booking mode...). */
  update: (id: number, b: Partial<{ title: string; description: string; total_seats: number; price_per_seat: number; booking_mode: 'instant' | 'request'; luggage_size: string; back_seat_max: number; amenities: string[]; vehicle_make: string; vehicle_model: string; vehicle_year: number | null; vehicle_color: string; license_plate: string }>) =>
    api(`/rides/${id}`, { method: 'PUT', body: b }),
  /** Driver deletes their own ride (refused while passengers hold an active booking on it). */
  remove: (id: number) => api(`/rides/${id}`, { method: 'DELETE' }),
  publish: (b: Record<string, unknown>) => api<{ ride_id: number }>('/rides', { method: 'POST', body: b }),
  estimateFare: (b: Record<string, unknown>) => api<{ suggested_price_per_seat: number; price_per_km: number }>('/rides/estimate-fare', { method: 'POST', body: b }),
  /** `instanceId` is a ride_instance id. Read-only preview of the exact charge (fare + 20% service fee + Stripe surcharge if applicable) before booking. */
  quote: (instanceId: number, seats: number) =>
    api<{
      seats_booked: number;
      per_person_cost: number;
      base_amount: number;
      service_fee_percent: number;
      by_payment_method: {
        wallet: { service_fee_amount: number; gst_hst_amount: number; processing_fee_amount: number; total_charged: number };
        stripe: { service_fee_amount: number; gst_hst_amount: number; processing_fee_amount: number; total_charged: number };
      };
    }>(`/rides/${instanceId}/quote`, { query: { seats } }),
  /** `instanceId` is a ride_instance id, not the ride id. */
  book: (
    instanceId: number,
    b: {
      seats_booked: number;
      /** Optional for request-mode rides on servers that take payment only after the driver accepts. */
      payment_method?: 'wallet' | 'stripe';
      special_requests?: string;
      pickup_location?: object;
      dropoff_location?: object;
      trip_type?: 'one_way' | 'round_trip';
      linked_booking_id?: number;
    },
  ) =>
    api<{ booking_id: number; status: string; payment_status: string; stripe_client_secret?: string; trip_type?: string; linked_booking_id?: number | null }>(
      `/rides/${instanceId}/book`,
      { method: 'POST', body: b },
    ),
  /** `instanceId` is a ride_instance id -- driver-only, opens/closes the live-tracking window. */
  startInstance: (instanceId: number) => api(`/rides/instances/${instanceId}/start`, { method: 'POST' }),
  completeInstance: (instanceId: number) => api(`/rides/instances/${instanceId}/complete`, { method: 'POST' }),
};

export const bookings = {
  mine: (role: 'passenger' | 'driver' | 'all' = 'all', status = 'all') => api<ApiBooking[]>('/bookings/my-bookings', { query: { role, status } }),
  get: (id: number) => api<BookingDetail>(`/bookings/${id}`),
  /** Oldest first. Passing `afterId` returns only newer messages; fetching also marks the other side's messages read. */
  messages: (id: number, afterId?: number) => api<ChatMessage[]>(`/bookings/${id}/messages`, { query: { after_id: afterId } }),
  send: (id: number, message: string) => api<ChatMessage>(`/bookings/${id}/messages`, { method: 'POST', body: { message } }),
  cancel: (id: number) => api(`/bookings/${id}/cancel`, { method: 'POST' }),
  accept: (id: number) => api(`/bookings/${id}/accept`, { method: 'POST' }),
  /** Pay a confirmed-but-unpaid booking (the server accepts the wallet here). */
  pay: (id: number, method: 'wallet' | 'stripe' = 'wallet') =>
    api<{ walletBalanceAfter?: number; stripe_client_secret?: string; total_charged?: number }>(`/bookings/${id}/pay`, { method: 'POST', body: { payment_method: method } }),
  decline: (id: number, reason?: string) => api(`/bookings/${id}/decline`, { method: 'POST', body: { reason } }),
  /** null while the ride isn't currently in progress -- that's by design, not an error. */
  tracking: (id: number) => api<{ latitude: number; longitude: number; heading: number | null; speed: number | null; recorded_at: string } | null>(`/bookings/${id}/tracking`),
  /** Fallback for when the Stripe webhook hasn't (or can't) reach the server -- call right after payWithStripe resolves true, so payment_status is correct immediately rather than only whenever/if the webhook arrives. Safe to call repeatedly. */
  syncPayment: (id: number) => api<{ payment_status: string }>(`/bookings/${id}/sync-payment`, { method: 'POST' }),
};

export const faqs = { list: () => api<{ id: number; question: string; answer: string; category: string | null }[]>('/faqs', { auth: false, ttl: 600000 }) };

export const ratings = {
  rate: (booking_id: number, rating: number, comment?: string) => api('/ratings', { method: 'POST', body: { booking_id, rating, comment } }),
  mine: (direction: 'given' | 'received') => api<{ ratings: MyRating[]; averageRating?: number; total?: number }>('/ratings/my-ratings', { query: { direction } }),
};

export const wallet = {
  get: () => api<{ balance: number; transactions: WalletTx[] }>('/wallet'),
  withdrawals: () => api<Withdrawal[]>('/wallet/withdraw'),
  withdraw: (amount: number, bank_account_last4: string, notes?: string) => api('/wallet/withdraw', { method: 'POST', body: { amount, payment_method: 'bank_account', bank_account_last4, notes } }),
  /** Starts a Stripe-only recharge; confirm the returned client_secret with payWithStripe, then the webhook credits the balance. */
  topup: (amount: number) => api<{ stripe_client_secret: string; amount: number }>('/wallet/topup', { method: 'POST', body: { amount } }),
};

export const refunds = {
  list: () => api<RefundRequest[]>('/refund-requests'),
  /** `id` is the refund_requests id, not the booking id. */
  choose: (id: number, b: { method: 'stripe' } | { method: 'bank_account'; bank_account_holder_name: string; bank_institution_number: string; bank_transit_number: string; bank_account_number: string }) =>
    api(`/refund-requests/${id}/choose`, { method: 'POST', body: b }),
};

export const subscriptions = {
  list: () => api<Subscription[]>('/subscriptions'),
  /** pickup/dropoff are `locations` table ids: the ride's start_location_id / end_location_id. */
  create: (ride_id: number, pickup_location_id: number, dropoff_location_id: number, billing_cycle: 'monthly' | 'weekly' = 'monthly') =>
    api('/subscriptions', { method: 'POST', body: { ride_id, pickup_location_id, dropoff_location_id, billing_cycle } }),
  setStatus: (id: number, status: string, reason?: string) => api(`/subscriptions/${id}`, { method: 'PUT', body: { status, reason } }),
};

export const support = {
  list: () => api<Ticket[]>('/support-tickets'),
  get: (id: number) => api<TicketDetail>(`/support-tickets/${id}`),
  open: (subject: string, initial_message?: string, category = 'other', related_booking_id?: number) =>
    api<{ id: number }>('/support-tickets', { method: 'POST', body: { subject, initial_message, category, related_booking_id } }),
  message: (id: number, message: string) => api(`/support-tickets/${id}/messages`, { method: 'POST', body: { message } }),
};

export const drivers = {
  earnings: (period?: 'today' | 'week' | 'month') => api<{ summary: EarningsSummary; earnings: unknown[] }>('/drivers/me/earnings', { query: { period } }),
  payouts: () => api<Payout[]>('/drivers/me/payouts'),
  requestPayout: (b: { amount: number; payment_method: 'bank_transfer' | 'paypal' | 'stripe' | 'cash'; bank_account_last4?: string; paypal_email?: string; notes?: string }) =>
    api('/drivers/me/payouts', { method: 'POST', body: b }),
};

export const vehicles = {
  models: (search?: string) => api<VehicleModel[]>('/vehicle-models', { query: { search }, ttl: 300000 }),
};

export type DriverVehicle = {
  driver_id: number;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  license_plate: string | null;
  photo_urls: string[];
  registration_certificate_url: string | null;
  registration_expiry: string | null;
  insurance_document_url: string | null;
  insurance_expiry: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  rejection_reason: string | null;
};
export type PickedFile = { uri: string; name: string; type: string };

/**
 * Upload one file as multipart/form-data using Expo's native uploader. React Native's own fetch + FormData upload failed on
 * Android with a bare "Network error" for every photo and document; the native uploader reads the file itself and also tells
 * us the real HTTP status and server message. The module is loaded on demand so an older build without it still starts.
 */
async function uploadFile<T>(path: string, file: PickedFile, fields: Record<string, string> = {}, retried = false): Promise<T> {
  if (!token) throw new ApiError(SIGNED_OUT, 401);
  let result: { status: number; body: string };
  try {
    const FS = await import('expo-file-system/legacy');
    result = await FS.uploadAsync(`${API_URL}${path}`, file.uri, {
      httpMethod: 'POST',
      uploadType: FS.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: file.type,
      parameters: fields,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new ApiError(`Could not upload the file${e instanceof Error && e.message ? `: ${e.message}` : '.'} Check your connection and try again.`, 0);
  }
  if (result.status === 401 && token && !retried && (await refreshSession())) return uploadFile<T>(path, file, fields, true);
  let json: { success?: boolean; data?: T; error?: string } | null = null;
  try {
    json = JSON.parse(result.body);
  } catch {
    // not JSON (e.g. a proxy error page)
  }
  if (result.status === 429) throw new ApiError('Too many requests. Please wait a minute and try again.', 429);
  if (result.status < 200 || result.status >= 300 || json?.success === false) {
    throw new ApiError(json?.error || (result.status === 413 ? 'That file is too large.' : `Upload failed (${result.status})`), result.status);
  }
  return json?.data as T;
}

export const driverVehicle = {
  get: () => api<{ vehicle: DriverVehicle | null; is_complete: boolean }>('/drivers/me/vehicle'),
  update: (
    b: Partial<{ make: string; model: string; year: number; color: string; license_plate: string; registration_expiry: string; insurance_expiry: string }>,
  ) => api('/drivers/me/vehicle', { method: 'PUT', body: b }),
  uploadPhoto: (file: PickedFile) => uploadFile<{ url: string }>('/drivers/me/vehicle/photos', file),
  removePhoto: (url: string) => api('/drivers/me/vehicle/photos', { method: 'DELETE', body: { url } }),
  uploadRegistration: (file: PickedFile, expiry?: string) => uploadFile('/drivers/me/vehicle/registration', file, expiry ? { expiry } : {}),
  uploadInsurance: (file: PickedFile, expiry?: string) => uploadFile('/drivers/me/vehicle/insurance', file, expiry ? { expiry } : {}),
};

/** Driving licence + identity documents live on the user record (not the vehicle). */
export const profile = {
  /** Updates `users.avatar_url`/`profile_photo_url` server-side; the response's `url` is the uploaded photo. */
  uploadPhoto: (file: PickedFile) => uploadFile<{ url: string }>('/auth/upload-document', file, { document_type: 'profile_photo' }),
};

export const licence = {
  /** document_type: driving_license_front | driving_license_back (licence number, expiry and province go with the front). */
  upload: (file: PickedFile, documentType: 'driving_license_front' | 'driving_license_back', meta?: { license_number?: string; license_expiry?: string; license_province?: string }) => {
    const fields: Record<string, string> = { document_type: documentType };
    if (meta?.license_number) fields.license_number = meta.license_number;
    if (meta?.license_expiry) fields.license_expiry = meta.license_expiry;
    if (meta?.license_province) fields.license_province = meta.license_province;
    return uploadFile<{ url: string }>('/auth/upload-document', file, fields);
  },
  status: () => api<{ blocked: boolean; license: { required: boolean; verified: boolean } }>('/auth/verification-status'),
  /** The full record (not just verified/required) so the form can show what's on file and lock once it's a complete, unreviewed-or-approved submission. */
  get: () =>
    api<{ license_number: string | null; license_expiry: string | null; license_province: string | null; front_url: string | null; back_url: string | null; verified: boolean; locked: boolean }>(
      '/drivers/me/license',
    ),
};

export type PublicProfile = {
  /** Passenger always; Driver only once the backend team verified the licence and the vehicle. */
  roles?: ('passenger' | 'driver')[];
  user: { id: number; first_name: string; last_name: string; avatar_url: string | null; role: 'driver' | 'passenger'; member_since: string; identity_verified: boolean; license_verified?: boolean };
  stats: { rides_published: number; trips_driven: number; trips_cancelled_as_driver: number; bookings_total: number; bookings_completed: number; bookings_cancelled: number };
  ratings: { average: number; total: number; distribution: Record<'1' | '2' | '3' | '4' | '5', number> };
  reviews: { id: number; rating: number; comment: string | null; rater_role: string; created_at: string; rater_first_name: string; rater_last_initial: string }[];
  vehicle: { make: string | null; model: string | null; year: number | null; color: string | null; license_plate: string | null; photo_urls: string[]; verification_status: string } | null;
};
export const profiles = {
  /** A driver, or the other party of one of your bookings. Needs the server's /users/{id}/public-profile route. */
  get: (id: number) => api<PublicProfile>(`/users/${id}/public-profile`, { ttl: 20000 }),
};

export const chat = {
  unreadCount: () => api<{ unread_count: number }>('/messages/unread-count'),
};

export const settings = {
  app: () => api<{ contact_visibility_mode?: 'public' | 'private' }>('/app-settings', { auth: false, ttl: 600000 }),
  map: () => api<{ mapboxAccessToken: string }>('/map-settings', { auth: false, ttl: 600000 }),
  stripe: () => api<{ publishableKey: string; isTestMode: boolean; configured: boolean }>('/stripe-settings', { auth: false, ttl: 600000 }),
};

export type Notice = {
  id: number;
  image_url: string | null;
  title: string | null;
  subtitle: string | null;
  link_url: string | null;
  sort_order: number;
};

// Admin-managed home-screen notice carousel (Master > Hero Banners &
// Notices) -- shown alongside the fixed legal/how-it-works slides in
// InfoCarousel, not instead of them.
export const notices = {
  list: () => api<Notice[]>('/banners', { query: { platform: 'mobile' }, auth: false, ttl: 600000 }),
};

export type WalletTx = { id: number; amount: number | string; transaction_type: 'credit' | 'debit' | string; description?: string; balance_after?: number | string; created_at?: string };
export type Withdrawal = { id: number; amount: number | string; status: string; requestedDate?: string; bankAccountLast4?: string; rejectionReason?: string };
export type RefundRequest = { id: number; amount?: number | string; status: 'awaiting_choice' | 'processing' | 'pending_verification' | 'completed' | 'failed'; booking_id?: number };
export type Subscription = { id: number; status: string; ride_id?: number; ride_title?: string; billing_cycle?: string; monthly_fee?: number | string; pickup_name?: string; dropoff_name?: string; next_billing_date?: string; driver_first_name?: string; driver_last_name?: string };
export type Ticket = { id: number; subject: string; status?: string; category?: string; created_at?: string; updated_at?: string };
export type TicketMessage = { id: number; message: string; sender_role?: string; sender_id: number; first_name?: string; last_name?: string; created_at?: string };
export type TicketDetail = Ticket & { messages?: TicketMessage[] };
export type Payout = { id: number; amount: number | string; status: string; paymentMethod?: string; requestedDate?: string };
export type VehicleModel = { id: number; make: string; model: string; year?: number; color?: string; seats_capacity?: number };

// Shapes below are inferred from the reference's response notes; fields are optional where it doesn't pin them down.
export type ApiInstance = { id: number; departure_date: string; departure_time?: string; estimated_arrival_time?: string; available_seats?: number; status?: string };
export type PickupSchedule = {
  id: number;
  location_name: string;
  location_address?: string;
  location_latitude?: string;
  location_longitude?: string;
  location_city?: string;
  location_type?: 'pickup' | 'drop' | string;
  sequence_order?: number;
  pickup_time?: string;
};
// Shape of /rides/search and /rides/{id} as the live server returns it (flat location fields, no ride_type).
export type ApiRide = {
  id: number;
  title?: string;
  description?: string | null;
  total_seats: number;
  price_per_seat: number | string;
  total_trip_amount?: number | string;
  /** set only on local commutes (their price is calculated and cost-shared); city-to-city rides have none */
  daily_distance_km?: number | string | null;
  is_round_trip?: boolean;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string | null;
  vehicle_year?: number;
  license_plate?: string | null;
  driver_vehicle_photos?: string[];
  driver_vehicle_license_plate?: string | null;
  driver_member_since?: string | null;
  booking_mode?: 'instant' | 'request';
  amenities?: string[];
  back_seat_max?: number;
  luggage_size?: string;
  start_location_id?: number;
  end_location_id?: number;
  start_location_name?: string;
  start_address?: string;
  start_latitude?: string;
  start_longitude?: string;
  end_location_name?: string;
  end_address?: string;
  end_latitude?: string;
  end_longitude?: string;
  first_name?: string;
  last_name?: string;
  driver_id?: number;
  driver_avatar?: string | null;
  driver_verified?: boolean;
  driver_rating?: number | null;
  driver_rating_count?: number;
  driver_completed_rides?: number;
  instances?: ApiInstance[];
  pickup_schedules?: PickupSchedule[];
  // Present on the outbound leg of a round trip -- the linked return
  // ride's own upcoming departures, so a passenger can pick a specific
  // return date (see GET /rides/[id]).
  return_ride?: { id: number; price_per_seat: number | string; total_seats: number; instances: ApiInstance[] };
};
// GET /bookings/my-bookings and GET /bookings/{id} (see nextjs-server/app/api/bookings)
export type ApiBooking = {
  id: number;
  ride_id?: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  seats_booked: number;
  total_price?: number | string;
  total_charged?: number | string;
  service_fee_amount?: number | string;
  gst_hst_amount?: number | string;
  processing_fee_amount?: number | string;
  payment_method?: string;
  payment_status?: string;
  /** what the driver published for one seat, and the whole trip amount that is cost-shared (booking detail only) */
  ride_price_per_seat?: number | string;
  ride_total_trip_amount?: number | string;
  ride_daily_distance_km?: number | string | null;
  title?: string;
  driver_id?: number;
  passenger_id?: number;
  driver_first_name?: string;
  driver_last_name?: string;
  passenger_first_name?: string;
  passenger_last_name?: string;
  start_name?: string;
  end_name?: string;
  pickup_name?: string | null;
  dropoff_name?: string | null;
  pickup_latitude?: string | number | null;
  pickup_longitude?: string | number | null;
  dropoff_latitude?: string | number | null;
  dropoff_longitude?: string | number | null;
  departure_date?: string;
  departure_time?: string;
  booking_mode?: string;
  ride_instance_id?: number;
  /** The ride_instance's own status -- live tracking is only possible while this is 'in_progress'. */
  instance_status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  trip_type?: 'one_way' | 'round_trip';
  linked_booking_id?: number | null;
};
export type ChatMessage = { id: number; booking_id: number; sender_id: number; sender_role: 'passenger' | 'driver'; message: string; is_read: boolean; created_at: string };
export type BlockedUser = { user_id: number; reason?: string; created_at: string; first_name: string; last_name: string; role: string };
// Detail adds b.* (incl. passenger_id), vehicle fields, and the mobile numbers only when contact mode is 'public'.
export type BookingDetail = ApiBooking & {
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string | null;
  license_plate?: string | null;
  special_requests?: string | null;
  driver_mobile?: string;
  passenger_mobile?: string;
  // From the driver's on-file vehicle compliance record -- the only two
  // fields of it ever exposed publicly.
  driver_vehicle_photos?: string[];
  driver_vehicle_license_plate?: string | null;
};

export type EarningsSummary = { totalRides: number; totalGrossAmount: number; totalCommission: number; totalNetAmount: number; averageCommissionRate: number };
export type MyRating = { id: number; booking_id: number; rater_id: number; ratee_id: number; rater_role: string; rating: number; comment: string | null; created_at: string; updated_at: string | null; rater_first_name: string; rater_last_name: string; ratee_first_name: string; ratee_last_name: string };
