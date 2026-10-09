import { Pool, type PoolConfig, type PoolClient } from "pg";
import { toEpochMs, validateSession } from "./validation.js";
import type { LocationObservation, MotionActor, ReplaySession, TimelineEvent } from "./types.js";

export type PostgresMotionMapsConfig = {
  connection?: string | PoolConfig;
  pool?: Pool;
  /** Isolated PostgreSQL schema; defaults to `motion_maps`. */
  schema?: string;
};

export type MotionMapsPostgresStore = {
  migrate(): Promise<void>;
  createSession(id: string, session: ReplaySession): Promise<void>;
  saveActors(sessionId: string, actors: MotionActor[]): Promise<void>;
  appendObservations(sessionId: string, observations: LocationObservation[]): Promise<void>;
  appendEvents(sessionId: string, events: TimelineEvent[]): Promise<void>;
  loadSession(sessionId: string): Promise<ReplaySession | null>;
  deleteSession(sessionId: string): Promise<boolean>;
  close(): Promise<void>;
};

/** Optional PostgreSQL persistence. `migrate()` creates only Motion Maps tables in its own schema. */
export function createMotionMapsPostgresStore(config: PostgresMotionMapsConfig): MotionMapsPostgresStore {
  if (!config.pool && !config.connection) throw new Error("Provide a PostgreSQL pool or connection configuration");
  const schema = identifier(config.schema ?? "motion_maps");
  const ownPool = !config.pool;
  const pool = config.pool ?? new Pool(typeof config.connection === "string" ? { connectionString: config.connection } : config.connection);
  const table = (name: string) => `"${schema}"."${name}"`;

  async function migrate(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      await client.query(`CREATE TABLE IF NOT EXISTS ${table("schema_migrations")} (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
      const applied = await client.query(`SELECT 1 FROM ${table("schema_migrations")} WHERE version = 1`);
      if (!applied.rowCount) {
        await client.query(`
          CREATE TABLE ${table("sessions")} (id text PRIMARY KEY, version integer NOT NULL DEFAULT 1, started_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
          CREATE TABLE ${table("actors")} (session_id text NOT NULL REFERENCES ${table("sessions")}(id) ON DELETE CASCADE, actor_id text NOT NULL, type text NOT NULL, label text, state text, style jsonb NOT NULL DEFAULT '{}'::jsonb, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (session_id, actor_id));
          CREATE TABLE ${table("observations")} (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, session_id text NOT NULL, actor_id text NOT NULL, recorded_at timestamptz NOT NULL, lng double precision NOT NULL, lat double precision NOT NULL, bearing double precision, speed_mps double precision, accuracy_m double precision, source text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, FOREIGN KEY (session_id, actor_id) REFERENCES ${table("actors")}(session_id, actor_id) ON DELETE CASCADE, UNIQUE (session_id, actor_id, recorded_at));
          CREATE INDEX ${q(`${schema}_observations_session_time_idx`)} ON ${table("observations")} (session_id, recorded_at);
          CREATE INDEX ${q(`${schema}_observations_actor_time_idx`)} ON ${table("observations")} (session_id, actor_id, recorded_at);
          CREATE TABLE ${table("events")} (session_id text NOT NULL REFERENCES ${table("sessions")}(id) ON DELETE CASCADE, event_id text NOT NULL, at timestamptz NOT NULL, actor_id text, kind text NOT NULL, label text, lng double precision, lat double precision, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, PRIMARY KEY (session_id, event_id));
          CREATE INDEX ${q(`${schema}_events_session_time_idx`)} ON ${table("events")} (session_id, at);
        `);
        await client.query(`INSERT INTO ${table("schema_migrations")} (version) VALUES (1)`);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async function createSession(id: string, session: ReplaySession): Promise<void> {
    required(id, "session id"); validateSession(session);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO ${table("sessions")} (id,version,started_at) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET version=EXCLUDED.version,started_at=EXCLUDED.started_at,updated_at=now()`, [id, session.version, session.startedAt ? new Date(toEpochMs(session.startedAt)) : null]);
      await saveActorsWith(client, id, session.actors);
      await appendObservationsWith(client, id, session.observations);
      await appendEventsWith(client, id, session.events ?? []);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async function saveActors(sessionId: string, actors: MotionActor[]): Promise<void> { const c = await pool.connect(); try { await saveActorsWith(c, sessionId, actors); } finally { c.release(); } }
  async function appendObservations(sessionId: string, observations: LocationObservation[]): Promise<void> { const c = await pool.connect(); try { await appendObservationsWith(c, sessionId, observations); } finally { c.release(); } }
  async function appendEvents(sessionId: string, events: TimelineEvent[]): Promise<void> { const c = await pool.connect(); try { await appendEventsWith(c, sessionId, events); } finally { c.release(); } }

  async function saveActorsWith(client: PoolClient, sessionId: string, actors: MotionActor[]): Promise<void> {
    required(sessionId, "session id");
    for (const actor of actors) {
      required(actor.id, "actor id");
      await client.query(`INSERT INTO ${table("actors")} (session_id,actor_id,type,label,state,style,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (session_id,actor_id) DO UPDATE SET type=EXCLUDED.type,label=EXCLUDED.label,state=EXCLUDED.state,style=EXCLUDED.style,metadata=EXCLUDED.metadata,updated_at=now()`, [sessionId, actor.id, actor.type, actor.label ?? null, actor.state ?? null, actor.style ?? {}, actor.metadata ?? {}]);
    }
  }
  async function appendObservationsWith(client: PoolClient, sessionId: string, observations: LocationObservation[]): Promise<void> {
    required(sessionId, "session id");
    for (const item of observations) {
      validObservation(item);
      await client.query(`INSERT INTO ${table("observations")} (session_id,actor_id,recorded_at,lng,lat,bearing,speed_mps,accuracy_m,source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (session_id,actor_id,recorded_at) DO UPDATE SET lng=EXCLUDED.lng,lat=EXCLUDED.lat,bearing=EXCLUDED.bearing,speed_mps=EXCLUDED.speed_mps,accuracy_m=EXCLUDED.accuracy_m,source=EXCLUDED.source`, [sessionId, item.actorId, new Date(toEpochMs(item.recordedAt)), item.position.lng, item.position.lat, item.bearing ?? null, item.speedMps ?? null, item.accuracyM ?? null, item.source ?? null]);
    }
  }
  async function appendEventsWith(client: PoolClient, sessionId: string, events: TimelineEvent[]): Promise<void> {
    required(sessionId, "session id");
    for (const event of events) {
      required(event.id, "event id");
      await client.query(`INSERT INTO ${table("events")} (session_id,event_id,at,actor_id,kind,label,lng,lat,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (session_id,event_id) DO UPDATE SET at=EXCLUDED.at,actor_id=EXCLUDED.actor_id,kind=EXCLUDED.kind,label=EXCLUDED.label,lng=EXCLUDED.lng,lat=EXCLUDED.lat,metadata=EXCLUDED.metadata`, [sessionId, event.id, new Date(toEpochMs(event.at)), event.actorId ?? null, event.kind, event.label ?? null, event.position?.lng ?? null, event.position?.lat ?? null, event.metadata ?? {}]);
    }
  }

  async function loadSession(sessionId: string): Promise<ReplaySession | null> {
    const session = await pool.query<{ version: 1; started_at: Date | null }>(`SELECT version,started_at FROM ${table("sessions")} WHERE id=$1`, [sessionId]);
    if (!session.rowCount) return null;
    const [actors, observations, events] = await Promise.all([
      pool.query<any>(`SELECT actor_id,type,label,state,style,metadata FROM ${table("actors")} WHERE session_id=$1 ORDER BY actor_id`, [sessionId]),
      pool.query<any>(`SELECT actor_id,recorded_at,lng,lat,bearing,speed_mps,accuracy_m,source FROM ${table("observations")} WHERE session_id=$1 ORDER BY actor_id,recorded_at`, [sessionId]),
      pool.query<any>(`SELECT event_id,at,actor_id,kind,label,lng,lat,metadata FROM ${table("events")} WHERE session_id=$1 ORDER BY at`, [sessionId])
    ]);
    return { version: session.rows[0].version, startedAt: session.rows[0].started_at?.toISOString(), actors: actors.rows.map(r => ({ id: r.actor_id, type: r.type, label: r.label ?? undefined, state: r.state ?? undefined, style: r.style, metadata: r.metadata })), observations: observations.rows.map(r => ({ actorId: r.actor_id, position: { lng: r.lng, lat: r.lat }, recordedAt: r.recorded_at.toISOString(), bearing: r.bearing ?? undefined, speedMps: r.speed_mps ?? undefined, accuracyM: r.accuracy_m ?? undefined, source: r.source ?? undefined })), events: events.rows.map(r => ({ id: r.event_id, at: r.at.toISOString(), actorId: r.actor_id ?? undefined, kind: r.kind, label: r.label ?? undefined, position: r.lng === null ? undefined : { lng: r.lng, lat: r.lat }, metadata: r.metadata })) };
  }

  return { migrate, createSession, saveActors, appendObservations, appendEvents, loadSession, deleteSession: async id => ((await pool.query(`DELETE FROM ${table("sessions")} WHERE id=$1`, [id])).rowCount ?? 0) > 0, close: async () => { if (ownPool) await pool.end(); } };
}

function identifier(value: string): string { if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error("schema must be a simple PostgreSQL identifier"); return value; }
function q(value: string): string { return `"${value}"`; }
function required(value: string, name: string): void { if (!value?.trim()) throw new Error(`${name} is required`); }
function validObservation(item: LocationObservation): void { if (!item.actorId.trim() || !Number.isFinite(item.position.lng) || item.position.lng < -180 || item.position.lng > 180 || !Number.isFinite(item.position.lat) || item.position.lat < -90 || item.position.lat > 90) throw new Error("Invalid location observation"); toEpochMs(item.recordedAt); }
