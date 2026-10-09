# Motion Maps: getting started

Motion Maps owns replay state and movement calculations. Your application owns the map provider, map credentials, visual design and location data.

## 1. Install

```bash
npm install motion-maps maplibre-gl
```

React projects also need `react`. React Native projects install their map renderer separately, such as `react-native-maps`.

## 2. Prepare a replay session

Use longitude first in map-renderer APIs, but Motion Maps positions are always named `{ lng, lat }`. Observations must be in chronological order for each actor.

```ts
const session = {
  version: 1,
  actors: [{ id: "driver-1", type: "car", label: "Ada", style: { color: "#2563eb" } }],
  observations: [
    { actorId: "driver-1", position: { lng: 3.3792, lat: 6.5244 }, recordedAt: "2026-09-29T09:00:00Z" },
    { actorId: "driver-1", position: { lng: 3.3840, lat: 6.5280 }, recordedAt: "2026-09-29T09:01:00Z" }
  ]
};
```

## 3. Attach it to MapLibre

Create your MapLibre map first, then attach Motion Maps once the map style has loaded.

```ts
import { motionMapsMapLibre } from "motion-maps/maplibre";

const motion = motionMapsMapLibre(map, {
  preset: "replay",
  session,
  routes: [{
    id: "driver-1-plan",
    actorId: "driver-1",
    kind: "planned",
    coordinates: session.observations.map(item => item.position),
    style: { color: "#2563eb", width: 3, dasharray: [2, 2] }
  }],
  visuals: { trail: true, rotateActors: true },
  onChange: snapshot => console.log(snapshot.status, snapshot.actors)
});

motion.play();
```

Call `motion.destroy()` when your page or component unmounts.

## 4. Choose a map provider for production

Motion Maps does not provide tiles or map credentials. For production, supply a provider style URL and follow that provider’s authentication, attribution, quota and caching requirements. Do not depend on the public demo style for commercial traffic. A self-hosted MapLibre-compatible style is also supported.

For MapLibre bundled with Vite, configure the MapLibre worker according to your bundler before creating the map. The included demo shows the Vite pattern.

## React Native

`MotionMapsNative` renders motion state using map components supplied by your chosen provider. For `react-native-maps`, import `MapView`, `Marker`, and `Polyline` and pass them as `components`; optionally pass React Native `View` and `Text` to get SDK-created actor glyphs. Or use `useMotionMapsNative` and build custom native UI from `snapshot.actors[n].renderedPosition`. See [`examples/react-native-replay.tsx`](../examples/react-native-replay.tsx) for a complete component.

Use a stable config object with `useMemo`; recreate the hook only when you intentionally replace the map/session. For live GPS data, use `controller.appendObservations(newPoints)`.

## Google Maps JavaScript

Install and load the Google Maps JavaScript API using your preferred loader, then provide its `google.maps` namespace:

```ts
import { motionMapsGoogle } from "motion-maps/google-maps";
const motion = motionMapsGoogle(map, { api: google.maps, session, preset: "replay" });
```

Use `routes` for planned paths. Set `visuals.trail` to `false` to hide replay trails. The host application is responsible for API credentials, loading the API, map styling and attribution.

## Leaflet

Install Leaflet and its CSS, create a map and add a tile layer, then attach the adapter:

```ts
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motionMapsLeaflet } from "motion-maps/leaflet";
const motion = motionMapsLeaflet(map, { leaflet: L, session, preset: "replay" });
```

The host application provides the tile layer, provider attribution and any CSS customizations.

## Validation checklist

- Keep actor IDs unique.
- Give every observation an existing `actorId`.
- Use valid longitude (`-180..180`) and latitude (`-90..90`) values.
- Send timestamps in chronological order per actor.
- For multiple journeys, calculate routes and endpoint labels per actor—not from the whole session.
- Verify `play`, `pause`, `restart`, `seek` and `destroy` in your host application.
