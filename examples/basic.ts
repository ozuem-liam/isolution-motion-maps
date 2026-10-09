import { motionMaps, type ReplaySession } from "motion-maps";

declare const existingMap: unknown; // A MapLibre/Google/Leaflet adapter will use this map.

const session: ReplaySession = {
  version: 1,
  actors: [{ id: "driver-7", type: "car", label: "Driver 7" }],
  observations: [
    { actorId: "driver-7", position: { lng: 3.3792, lat: 6.5244 }, recordedAt: "2026-09-29T09:00:00Z" },
    { actorId: "driver-7", position: { lng: 3.384, lat: 6.528 }, recordedAt: "2026-09-29T09:05:00Z" }
  ]
};

const motion = motionMaps(existingMap, {
  preset: "replay",
  session,
  controls: { replay: true, position: "bottom-right" },
  onChange: snapshot => console.log(snapshot.replayTime, snapshot.actors),
  onActorPress: actor => console.log("Selected", actor.label)
});

motion.setSpeed(4);
motion.play();
