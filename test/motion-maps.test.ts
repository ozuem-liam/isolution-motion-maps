import assert from "node:assert/strict";
import test from "node:test";
import { motionMaps, validateSession, type ReplaySession } from "../src/index.js";

const session: ReplaySession = {
  version: 1,
  actors: [{ id: "bike-1", type: "bicycle", label: "Bike 1" }],
  observations: [
    { actorId: "bike-1", position: { lng: 3, lat: 6 }, recordedAt: "2026-01-01T00:00:00.000Z" },
    { actorId: "bike-1", position: { lng: 5, lat: 8 }, recordedAt: "2026-01-01T00:00:10.000Z" }
  ]
};

test("interpolates actor positions at a replay time", () => {
  const controller = motionMaps({}, { session, preset: "replay" });
  controller.seek("2026-01-01T00:00:05.000Z");
  const actor = controller.getSnapshot().actors[0];
  assert.deepEqual(actor.renderedPosition, { lng: 4, lat: 7 });
  assert.equal(actor.progress, 0.5);
  assert.ok(actor.bearing !== undefined);
});

test("returns snapshots and rejects invalid sessions", () => {
  const snapshots: number[] = [];
  const controller = motionMaps({}, { session, onChange: snapshot => snapshots.push(snapshot.actors.length) });
  controller.appendObservations([{ actorId: "bike-1", position: { lng: 6, lat: 9 }, recordedAt: "2026-01-01T00:00:20.000Z" }]);
  assert.equal(controller.getSnapshot().actors.length, 1);
  assert.ok(snapshots.length > 0);
  assert.throws(() => validateSession({ ...session, actors: [] }), /Unknown actor/);
});

test("selects an actor and safely cleans up", () => {
  const selected: string[] = [];
  const controller = motionMaps({}, { session, onActorPress: actor => selected.push(actor.id) });
  controller.selectActor("bike-1");
  assert.equal(controller.getSnapshot().actors[0].state, "selected");
  assert.deepEqual(selected, ["bike-1"]);
  controller.destroy();
});

test("emits configured geofence transitions", () => {
  const transitions: string[] = [];
  const controller = motionMaps({}, {
    session,
    geofences: [{ id: "arrival", type: "circle", center: { lng: 5, lat: 8 }, radiusM: 100 }],
    onGeofence: event => transitions.push(event.type)
  });
  controller.seek("2026-01-01T00:00:10.000Z");
  assert.deepEqual(transitions, ["enter"]);
});

test("restart returns to idle and can be played again", () => {
  const controller = motionMaps({}, { session });
  controller.play();
  controller.restart();
  assert.equal(controller.getSnapshot().status, "idle");
  assert.equal(controller.getSnapshot().replayTime, "2026-01-01T00:00:00.000Z");
  controller.play();
  assert.equal(controller.getSnapshot().status, "playing");
  controller.destroy();
});
