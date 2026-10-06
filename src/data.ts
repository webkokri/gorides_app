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
  /** calendar date of this trip, yyyy-mm-dd */
  day?: string;
  /** whole-trip amount the passengers and driver split (total_trip_amount) */
  tripTotal?: number;
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
  { cat: 'book', q: 'How do I book a seat?', a: 'Search your route on Home, pick a ride card, check the driver and pickup point, then tap Book. Instant booking rides are confirmed right away.' },
  { cat: 'pay', q: 'When am I charged?', a: 'Your card is charged when the booking is confirmed. For request rides you are only charged if the driver accepts.' },
  { cat: 'cancel', q: 'Can I cancel and get a refund?', a: 'Cancel from My rides. It is free up to 24 hours before departure. After that, the service fee is kept.' },
  { cat: 'pub', q: 'How do I publish a ride as a driver?', a: 'Tap the orange plus button, enter your route, date, seats and price, then publish. You need a verified ID and licence.' },
  { cat: 'safe', q: 'How does GORIDES keep rides safe?', a: 'Drivers verify ID and licence, everyone is rated after each trip, and you can share your live trip with trusted contacts.' },
  { cat: 'pay', q: 'How much should I charge per seat?', a: 'We recommend a price range for every route based on distance, fuel and tolls. Prices far above it get fewer bookings.' },
  { cat: 'acct', q: 'How do I verify my profile?', a: 'Go to Profile and add a government ID. Verification usually takes a few minutes.' },
];
