# GORIDES (React Native, Expo)

A React Native version of the GORIDES rideshare design. Passengers book seats and drivers publish rides. It is built with Expo SDK 57 and Expo Router, and all data is sample data.

## Run it

```bash
npm install
npx expo start
```

Then scan the QR code with **Expo Go** on Android or iOS, or press `a` for an Android emulator, `i` for the iOS simulator, or `w` for the web.

Checks:

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
```

## What's inside

| Screen | File |
| --- | --- |
| Animated splash (an orange car drives up the road from the bottom, kicks up dust, and the GO logo fades in out of the dust; letters rise) | `src/app/index.tsx` |
| Welcome slider: city drive, pickup scene, fair cost split, 20 s video slide; loops forever, with the car driving between slides | `src/app/onboarding.tsx` |
| Sign in with phone code or email | `src/app/signin.tsx` |
| Help centre with FAQ and contact | `src/app/help.tsx` |
| Home: live digital map header, Local ride and Long route search | `src/app/home.tsx` |
| Search results as ride cards, with filters | `src/app/results.tsx` |
| Ride details with animated route map | `src/app/ride.tsx` |
| Booking, then confirmation with confetti | `src/app/book.tsx`, `src/app/booked.tsx` |
| Publish a ride (5 steps), then confirmation | `src/app/publish.tsx`, `src/app/published.tsx` |
| My rides, Inbox, Chat, Profile, Notifications | `src/app/*.tsx` |

Shared code:

- `src/components/Logo.tsx` is the animated round GO logo. It is built from three transparent layers in `assets/images` (`logo-disc.png`, `logo-g.png`, `logo-o.png`). Use `motion="intro"` for an entrance, `"idle"` (default) for the O rolling a turn every few seconds, or `"none"`. `logo.png` is the full transparent logo; `icon.png` and `adaptive-icon.png` are the app icons.
- `src/components/cars.tsx` holds the SVG cars. `TopCar` is the map view; its nose points along +x, so it always faces its direction of travel. `SideCar` has spinning wheels, LED lights, brake glow and an opening rear door. `Person` is the passenger.
- `src/components/scenes/` holds the animated scenes. `Slides.tsx` has the onboarding scenes and `Maps.tsx` has the home map and the ride map.
- `src/lib/anim.ts` has `useTicker`, a frame clock that drives the scenes, plus bezier helpers for position and heading.
- `src/store.tsx` holds app state (search, selected ride, bookings) and toasts.
- `src/data.ts` holds sample rides, places, FAQ and conversations. Replace it with API calls.
- `src/theme.ts` holds colours (brand orange `#F47A20`) and fonts (Baloo 2 and Figtree).

## Notes

- Scene animation runs on the JS thread through `react-native-svg`, and each scene only ticks while it is on screen. For production, consider moving the heavier scenes to `react-native-reanimated` or Skia.
- The app icon (`assets/images/icon.png`, 1024×1024) is the round GO logo on white, since iOS icons cannot be transparent.
- Build for the stores with EAS: `npx eas-cli@latest build`.
