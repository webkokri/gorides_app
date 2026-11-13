// Static content (FAQ, popular routes). Rides, places, messages and activity come from the API.

export type Ride = {
  id: string;
  dep: string;
  arr: string;
  dur: string;
  from: string;
  fromS: string;
  to: string;
  toS: string;
  stop?: string;
  price: number;
  seats: number;
  of: number;
  driver: string;
  rating: number;
  rev: number;
  car: string;
  instant: boolean;
  pets: boolean;
  tags: string[];
  away?: string;
  /** API ride_instance id to book (absent on sample data). */
  instanceId?: number;
  rideId?: number;
  /** the publishing driver's user id (a driver cannot book their own ride) */
  driverId?: number;
  /** calendar date of this trip, yyyy-mm-dd */
  day?: string;
  /** whole-trip amount the passengers and driver split (total_trip_amount) */
  tripTotal?: number;
  /** city-to-city: the driver's own per-seat price is charged as is (local commutes cost-share the trip instead) */
  fixedPrice?: boolean;
  avatar?: string | null;
  verified?: boolean;
  stops?: { time: string; place: string; sub: string }[];
  description?: string;
};

export const POPULAR: { from: string; to: string; price: number; time: string; count: string }[] = [
  { from: 'Toronto, ON', to: 'Ottawa, ON', price: 38, time: '4h 20m', count: '24 rides today' },
  { from: 'Toronto, ON', to: 'Montréal, QC', price: 52, time: '5h 40m', count: '17 rides today' },
  { from: 'Brampton, ON', to: 'Waterloo, ON', price: 18, time: '1h 10m', count: '31 rides today' },
  { from: 'Ottawa, ON', to: 'Montréal, QC', price: 24, time: '2h 05m', count: '19 rides today' },
  { from: 'Toronto, ON', to: 'Niagara Falls, ON', price: 20, time: '1h 30m', count: '12 rides today' },
];

export const FAQ: { cat: string; q: string; a: string }[] = [
  { cat: 'book', q: 'How do I book a seat?', a: 'Search your route on Home, pick a ride, check the driver, their profile and the pickup point, then tap Book. Instant booking rides are confirmed as soon as you pay. For request rides the driver reviews your request first.' },
  { cat: 'pay', q: 'When am I charged?', a: 'Instant booking rides are paid when you book. For request rides you pay after the driver accepts. Always pay inside the app: payments made outside GORIDES cannot be tracked or protected.' },
  { cat: 'pay', q: 'What fees are there?', a: 'The trip cost is split equally between everyone in the car, driver included. GORIDES adds a service fee on each passenger share, card and bank payments include a payment processing fee from Stripe, and taxes may apply. The full amount is shown before you pay.' },
  { cat: 'cancel', q: 'Can I cancel a booking?', a: 'Open the trip from My rides, then Trip details, and use Cancel this booking at the bottom. Refunds follow the policy shown when you booked and the Terms of Service.' },
  { cat: 'pub', q: 'How do I publish a ride as a driver?', a: 'Add your car details, photos, registration, insurance and driving licence in your profile, then tap the orange plus button, enter your route, date, seats and price, and publish.' },
  { cat: 'safe', q: 'How can I stay safe?', a: 'Check the driver profile, reviews, car and licence plate before you get in, keep your chat and payment inside GORIDES, and use the SOS button or call 911 in an emergency.' },
  { cat: 'pub', q: 'How is the price per seat decided?', a: 'The trip cost is shared equally, so each passenger pays less as more people join. When you publish we suggest a price based on distance and your car.' },
  { cat: 'acct', q: 'How do I update my profile?', a: 'Go to Profile, then Account settings, to change your name, phone number or password.' },
];
