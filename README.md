# iSolution Motion Maps

Plug-and-play movement, tracking and replay state for map applications, with a renderer-neutral core and a MapLibre visual adapter.

Motion Maps is designed for logistics, delivery, mobility, field-service and route-story experiences. It is map-provider-neutral at the core and keeps location data under the application's control.

Start with the [integration guide](docs/GETTING_STARTED.md) or run the local MapLibre demo with `npm run demo`.

## Install

```bash
npm install motion-maps
```

## Core quick start

```ts
import { motionMaps } from "motion-maps";

const motion = motionMaps(existingMap, {
  preset: "replay",
  session,
  controls: { replay: true },
  onChange: snapshot => setJourney(snapshot),
  onActorPress: actor => openDetails(actor)
});

motion.play();
motion.setSpeed(4);
motion.seek("2026-09-29T09:15:00Z");
```

## MapLibre quick start

The MapLibre adapter renders vehicle/person markers and growing trails on an existing MapLibre map.

```ts
import { motionMapsMapLibre } from "motion-maps/maplibre";

const motion = motionMapsMapLibre(map, {
  preset: "replay",
  session,
  camera: { follow: "selected" },
  onChange: snapshot => setJourney(snapshot)
});
```

## Google Maps and Leaflet

The provider adapters are available as independent subpaths. Pass the provider namespace/API to avoid loading either library unless your application uses it:

```ts
import { motionMapsGoogle } from "motion-maps/google-maps";
const motion = motionMapsGoogle(googleMap, { api: google.maps, session, preset: "replay" });
```

```ts
import * as L from "leaflet";
import { motionMapsLeaflet } from "motion-maps/leaflet";
const motion = motionMapsLeaflet(leafletMap, { leaflet: L, session, preset: "replay" });
```

Install and configure the provider library in your application. Google Maps still requires your Google Maps JavaScript API setup and credentials; Leaflet still needs its CSS and a configured tile layer. See the [getting-started guide](docs/GETTING_STARTED.md).

Run the included visual demo with `npm run demo`; it uses an OpenFreeMap MapLibre street style and sample Lagos coordinates. The command prints a local address to open in a browser. It requires an active internet connection; configure a suitable tile provider or self-hosted style for production. [OpenFreeMap’s MapLibre quick start](https://openfreemap.org/quick_start/).

## PostgreSQL storage

The optional PostgreSQL module creates a versioned, isolated schema for replay sessions, actors, location observations and timeline events. It never creates or changes tables outside its configured schema.

```ts
import { createMotionMapsPostgresStore } from "motion-maps/postgres";

const store = createMotionMapsPostgresStore({
  connection: process.env.DATABASE_URL!,
  schema: "motion_maps" // optional; this is the default
});

await store.migrate();             // run once during deployment
await store.createSession("trip-42", session);
await store.appendObservations("trip-42", nextLocations);

const replaySession = await store.loadSession("trip-42");
```

The database account needs permission to create/use the selected schema during `migrate()`. In production, call migrations from a controlled deployment job—not from every browser or application request. Pass an existing `pg` pool with `pool` when your host application manages connection pooling.

## Routes and geofences

```ts
const motion = motionMaps(map, {
  session,
  routes: [{ id: "planned-trip", kind: "planned", coordinates: plannedCoordinates }],
  geofences: [{ id: "depot", type: "circle", center: { lng: 3.3792, lat: 6.5244 }, radiusM: 100 }],
  onGeofence: ({ type, actor, geofence }) => {
    console.log(`${actor.id} did ${type} ${geofence.id}`);
  }
});
```

Circle and polygon geofences run locally using rendered actor positions. Applications should treat them as helpful operational signals, not safety-critical truth when GPS data is sparse.

### MapLibre geofence UI

The MapLibre adapter can render configured geofences, show a popup when an actor enters or exits, and provide a radius control for a circle:

```ts
const motion = motionMapsMapLibre(map, {
  session,
  geofences: [{ id: "depot", type: "circle", center: { lng: 3.3792, lat: 6.5244 }, radiusM: 250 }],
  geofencePopup: { enabled: true },
  geofenceRadiusControl: { geofenceId: "depot", min: 50, max: 1_000, step: 50 },
});
```

Use `geofencePopup.render(event)` when you need custom popup HTML. The radius control updates the configured geofence and its rendered circle immediately.

## React and React Native

```tsx
import { MotionMaps, ReplayControls } from "motion-maps/react";

<MotionMaps map={map} preset="replay" session={session}>
  {(snapshot, controller) => <><ReplayControls controller={controller} /><Journey state={snapshot} /></>}
</MotionMaps>
```

For React Native, `MotionMapsNative` from `motion-maps/react-native` renders markers and polylines through provider components supplied by the host application. It works with component-compatible providers such as `react-native-maps` and also exports `useMotionMapsNative` for custom renderers. See the [React Native replay example](examples/react-native-replay.tsx).

## What works today

- Typed actor, location observation, event and replay-session data.
- Session validation, coordinate validation and ordered observations.
- Deterministic `seek`, linear interpolation, bearing and progress calculations.
- Playback controls, live observation append, actor updates and serialisable snapshots.
- Plug-and-play callbacks: `onChange`, `onActorPress`, `onEvent`, `onReplayChange`, `onError`.
- MapLibre, Google Maps JavaScript and Leaflet adapters with moving actors, routes, replay trails, actor selection and camera follow.
- Optional PostgreSQL persistence with safe, idempotent migrations and indexed session/actor/time history.
- Circle/polygon geofences, typed enter/exit callbacks, React wrapper, React Native renderer and hook, and accessible React replay controls.

## Current boundary

The SDK does not create map tiles. It accepts an existing map reference; the core remains renderer-neutral and SSR-safe, while browser rendering lives in explicit adapter subpaths. Google Maps and Leaflet are JavaScript adapters. Native rendering uses provider components supplied by the host application.

Coordinates use `{ lng, lat }`; timestamps accept ISO UTC strings, epoch milliseconds or `Date` values. Source replay data remains in the host application unless it deliberately exports a session. Native rendering depends on map components supplied by the host provider; verify provider-specific camera and marker behavior on target devices.
# isolution-motion-maps
