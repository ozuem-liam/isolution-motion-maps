import type { LocationObservation, ReplaySession, Timestamp } from "./types.js";

export function toEpochMs(value: Timestamp): number {
  const result = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(result)) throw new Error(`Invalid timestamp: ${String(value)}`);
  return result;
}

function assertObservation(observation: LocationObservation): void {
  if (!observation.actorId.trim()) throw new Error("Observation actorId is required");
  const { lng, lat } = observation.position;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error(`Invalid longitude for ${observation.actorId}`);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(`Invalid latitude for ${observation.actorId}`);
  toEpochMs(observation.recordedAt);
}

/** Validates a portable session without mutating user data. */
export function validateSession(session: ReplaySession): ReplaySession {
  if (session.version !== 1) throw new Error(`Unsupported replay session version: ${session.version}`);
  const actorIds = new Set<string>();
  for (const actor of session.actors) {
    if (!actor.id.trim()) throw new Error("Actor id is required");
    if (actorIds.has(actor.id)) throw new Error(`Duplicate actor id: ${actor.id}`);
    actorIds.add(actor.id);
  }
  const lastTime = new Map<string, number>();
  for (const observation of session.observations) {
    assertObservation(observation);
    if (!actorIds.has(observation.actorId)) throw new Error(`Unknown actor: ${observation.actorId}`);
    const time = toEpochMs(observation.recordedAt);
    const previous = lastTime.get(observation.actorId);
    if (previous !== undefined && time <= previous) {
      throw new Error(`Observations for ${observation.actorId} must be strictly ordered by recordedAt`);
    }
    lastTime.set(observation.actorId, time);
  }
  return session;
}
