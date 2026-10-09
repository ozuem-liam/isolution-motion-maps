import { toEpochMs, validateSession } from "./validation.js";
import type {
  Geofence, LocationObservation, MotionActor, MotionMapsConfig, MotionMapsController,
  MotionMapsSnapshot, MotionStatus, Position, RenderedActor, ReplaySession, Timestamp
} from "./types.js";

type TimedObservation = LocationObservation & { epoch: number };
const DEFAULT_TICK_MS = 33;

const PRESET_DEFAULTS: Record<NonNullable<MotionMapsConfig["preset"]>, Partial<MotionMapsConfig>> = {
  minimal: { visuals: { trail: false, breadcrumbs: false, rotateActors: true } },
  tracking: { visuals: { trail: true, breadcrumbs: "auto", rotateActors: true }, camera: { follow: "selected" } },
  dispatch: { visuals: { trail: true, breadcrumbs: false, rotateActors: true }, camera: { fitOnStart: true } },
  replay: { controls: { replay: true, position: "bottom-right" }, visuals: { trail: true, breadcrumbs: "auto", rotateActors: true } },
  simulation: { autoplay: true, visuals: { trail: true, breadcrumbs: "auto", rotateActors: true } }
};

const clone = <T>(value: T): T => structuredClone(value);
const iso = (ms: number): string => new Date(ms).toISOString();

function distanceM(a: Position, b: Position): number {
  const radius = 6_371_000;
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function bearing(a: Position, b: Position): number {
  const radians = Math.PI / 180;
  const dLng = (b.lng - a.lng) * radians;
  const y = Math.sin(dLng) * Math.cos(b.lat * radians);
  const x = Math.cos(a.lat * radians) * Math.sin(b.lat * radians) - Math.sin(a.lat * radians) * Math.cos(b.lat * radians) * Math.cos(dLng);
  return (Math.atan2(y, x) / radians + 360) % 360;
}

function interpolate(before: TimedObservation, after: TimedObservation, time: number): Position {
  const ratio = (time - before.epoch) / (after.epoch - before.epoch);
  return {
    lng: before.position.lng + (after.position.lng - before.position.lng) * ratio,
    lat: before.position.lat + (after.position.lat - before.position.lat) * ratio
  };
}

/**
 * Attaches motion state to an existing map. The initial core is renderer-neutral:
 * map rendering adapters can subscribe to snapshots without changing application code.
 */
export function motionMaps(_map: unknown, input: MotionMapsConfig = {}): MotionMapsController {
  let config: MotionMapsConfig = { ...PRESET_DEFAULTS[input.preset ?? "minimal"], ...input };
  let session: ReplaySession = validateSession(clone(input.session ?? { version: 1, actors: input.actors ?? [], observations: input.observations ?? [] }));
  let status: MotionStatus = "idle";
  let currentTime = initialTime(session);
  let speed = input.speed ?? 1;
  let selectedActor: string | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  let lastWallTime = 0;
  let deliveredEvents = new Set<string>();
  const listeners = new Set<(snapshot: MotionMapsSnapshot) => void>();
  const geofenceMembership = new Map<string, boolean>();

  if (!Number.isFinite(speed) || speed <= 0) throw new Error("speed must be greater than zero");

  const emit = () => {
    const value = snapshot();
    processGeofences(value);
    config.onChange?.(value);
    listeners.forEach(listener => listener(clone(value)));
  };
  const setStatus = (next: MotionStatus) => {
    status = next;
    config.onReplayChange?.(status);
    emit();
  };
  const report = (error: unknown) => {
    const normalized = error instanceof Error ? error : new Error(String(error));
    status = "error";
    config.onError?.(normalized);
    emit();
  };
  const stopClock = () => { if (interval) clearInterval(interval); interval = undefined; };
  const finish = () => {
    const end = endTime(session);
    if (config.loop && end !== undefined) { currentTime = initialTime(session); deliveredEvents.clear(); return; }
    stopClock(); setStatus("ended");
  };
  const tick = () => {
    try {
      const now = Date.now();
      currentTime += (now - lastWallTime) * speed;
      lastWallTime = now;
      deliverEvents();
      const end = endTime(session);
      if (end !== undefined && currentTime >= end) { currentTime = end; finish(); }
      else emit();
    } catch (error) { stopClock(); report(error); }
  };
  const play = () => {
    if (!session.observations.length) return report(new Error("Cannot play without observations"));
    if (status === "playing") return;
    if (endTime(session) !== undefined && currentTime >= endTime(session)!) currentTime = initialTime(session);
    lastWallTime = Date.now();
    interval = setInterval(tick, config.motion?.tickMs ?? DEFAULT_TICK_MS);
    setStatus("playing");
  };
  const deliverEvents = () => {
    for (const event of session.events ?? []) {
      if (!deliveredEvents.has(event.id) && toEpochMs(event.at) <= currentTime) {
        deliveredEvents.add(event.id); config.onEvent?.(clone(event));
      }
    }
  };
  const actorAt = (actor: MotionActor): RenderedActor => {
    const points = observationsFor(actor.id);
    const base: RenderedActor = { ...clone(actor) };
    if (!points.length) return base;
    const nextIndex = points.findIndex(point => point.epoch > currentTime);
    const after = nextIndex === -1 ? undefined : points[nextIndex];
    const before = nextIndex === -1 ? points.at(-1) : nextIndex === 0 ? undefined : points[nextIndex - 1];
    const raw = before ?? after!;
    if (!before || !after || config.motion?.interpolation === "none") {
      return { ...base, renderedPosition: clone(raw.position), rawPosition: clone(raw.position), bearing: raw.bearing, progress: progressFor(points) };
    }
    return { ...base, renderedPosition: interpolate(before, after, currentTime), rawPosition: clone(before.position), bearing: before.bearing ?? bearing(before.position, after.position), progress: progressFor(points) };
  };
  const snapshot = (): MotionMapsSnapshot => ({
    status,
    replayTime: session.observations.length ? iso(currentTime) : undefined,
    actors: session.actors.map(actorAt),
    metrics: metrics(),
    warnings: session.observations.length ? [] : [{ code: "NO_OBSERVATIONS", message: "No location observations have been supplied." }]
  });
  const observationsFor = (actorId: string): TimedObservation[] => session.observations
    .filter(observation => observation.actorId === actorId)
    .map(observation => ({ ...observation, epoch: toEpochMs(observation.recordedAt) }));
  const progressFor = (points: TimedObservation[]): number | undefined => {
    if (points.length < 2) return points.length ? 1 : undefined;
    return Math.max(0, Math.min(1, (currentTime - points[0].epoch) / (points.at(-1)!.epoch - points[0].epoch)));
  };
  const metrics = () => {
    let total = 0;
    for (const actor of session.actors) {
      const points = observationsFor(actor.id);
      for (let index = 1; index < points.length; index++) total += distanceM(points[index - 1].position, points[index].position);
    }
    const start = initialTime(session), end = Math.min(currentTime, endTime(session) ?? currentTime);
    return { distanceM: Math.round(total), movingMs: Math.max(0, end - start), stoppedMs: 0 };
  };
  const processGeofences = (value: MotionMapsSnapshot) => {
    for (const fence of config.geofences ?? []) {
      for (const actor of value.actors) {
        if (!actor.renderedPosition) continue;
        const key = `${fence.id}:${actor.id}`;
        const inside = contains(fence, actor.renderedPosition);
        const wasInside = geofenceMembership.get(key);
        geofenceMembership.set(key, inside);
        if (wasInside !== undefined && wasInside !== inside) {
          config.onGeofence?.({ type: inside ? "enter" : "exit", geofence: clone(fence), actor: clone(actor), at: value.replayTime ?? iso(Date.now()) });
        }
      }
    }
  };

  if (config.autoplay) play(); else emit();
  return {
    play,
    pause: () => { if (status === "playing") { stopClock(); setStatus("paused"); } },
    restart: () => { stopClock(); currentTime = initialTime(session); deliveredEvents.clear(); setStatus("idle"); },
    seek: (time) => { currentTime = toEpochMs(time); deliveredEvents = new Set((session.events ?? []).filter(event => toEpochMs(event.at) <= currentTime).map(event => event.id)); emit(); },
    setSpeed: (next) => { if (!Number.isFinite(next) || next <= 0) return report(new Error("speed must be greater than zero")); speed = next; emit(); },
    setData: (next) => { stopClock(); session = validateSession(clone(next)); currentTime = initialTime(session); deliveredEvents.clear(); setStatus("idle"); },
    appendObservations: (next) => { session = validateSession({ ...session, observations: [...session.observations, ...clone(next)] }); emit(); },
    setActors: (actors) => { session = validateSession({ ...session, actors: clone(actors) }); emit(); },
    setOptions: (options) => { config = { ...config, ...options, visuals: { ...config.visuals, ...options.visuals }, camera: { ...config.camera, ...options.camera }, controls: { ...config.controls, ...options.controls }, motion: { ...config.motion, ...options.motion } }; emit(); },
    selectActor: (id) => { selectedActor = id; session = { ...session, actors: session.actors.map(actor => ({ ...actor, state: actor.id === id ? "selected" : actor.state === "selected" ? "idle" : actor.state })) }; const actor = snapshot().actors.find(item => item.id === id); if (actor) config.onActorPress?.(actor); emit(); },
    getSnapshot: () => clone(snapshot()),
    subscribe: (listener) => { listeners.add(listener); listener(clone(snapshot())); return () => listeners.delete(listener); },
    exportSession: () => clone(session),
    destroy: () => { stopClock(); status = "idle"; }
  };
}

function initialTime(session: ReplaySession): number { return session.observations.length ? Math.min(...session.observations.map(item => toEpochMs(item.recordedAt))) : Date.now(); }
function endTime(session: ReplaySession): number | undefined { return session.observations.length ? Math.max(...session.observations.map(item => toEpochMs(item.recordedAt))) : undefined; }

function contains(fence: Geofence, position: Position): boolean {
  if (fence.type === "circle") return Boolean(fence.center && fence.radiusM !== undefined && distanceM(fence.center, position) <= fence.radiusM);
  const points = fence.coordinates ?? [];
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.lat > position.lat) !== (b.lat > position.lat) && position.lng < ((b.lng - a.lng) * (position.lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}
