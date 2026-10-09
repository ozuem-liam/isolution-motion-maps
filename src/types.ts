export type ActorType =
  | "car" | "van" | "truck" | "bus" | "motorcycle" | "bicycle"
  | "scooter" | "pedestrian" | "human" | "boy" | "girl" | "custom";

export type ActorState = "idle" | "moving" | "stopped" | "offline" | "alert" | "selected";
export type Position = { lng: number; lat: number };
export type Timestamp = string | number | Date;

export type MotionActor = {
  id: string;
  type: ActorType;
  label?: string;
  state?: ActorState;
  style?: { color?: string; asset?: string; size?: number };
  metadata?: Record<string, unknown>;
};

export type LocationObservation = {
  actorId: string;
  position: Position;
  recordedAt: Timestamp;
  bearing?: number;
  speedMps?: number;
  accuracyM?: number;
  source?: "gps" | "manual" | "simulation" | "estimated";
};

export type TimelineEvent = {
  id: string;
  at: Timestamp;
  actorId?: string;
  kind: "stop" | "pickup" | "dropoff" | "incident" | "geofence-enter" | "geofence-exit" | "custom";
  label?: string;
  position?: Position;
  metadata?: Record<string, unknown>;
};

export type Route = {
  id: string;
  actorId?: string;
  kind?: "planned" | "actual";
  coordinates: Position[];
  style?: { color?: string; width?: number; dasharray?: number[] };
};

export type Geofence = {
  id: string;
  type: "circle" | "polygon";
  center?: Position;
  radiusM?: number;
  coordinates?: Position[];
  metadata?: Record<string, unknown>;
};

export type GeofenceEvent = {
  type: "enter" | "exit";
  geofence: Geofence;
  actor: RenderedActor;
  at: string;
};

export type ReplaySession = {
  version: 1;
  startedAt?: Timestamp;
  actors: MotionActor[];
  observations: LocationObservation[];
  events?: TimelineEvent[];
};

export type MotionPreset = "minimal" | "tracking" | "dispatch" | "replay" | "simulation";
export type MotionStatus = "idle" | "playing" | "paused" | "ended" | "error";

export type RenderedActor = MotionActor & {
  renderedPosition?: Position;
  rawPosition?: Position;
  bearing?: number;
  progress?: number;
};

export type MotionMapsSnapshot = {
  status: MotionStatus;
  replayTime?: string;
  actors: RenderedActor[];
  metrics: { distanceM: number; movingMs: number; stoppedMs: number };
  warnings: Array<{ code: string; message: string; actorId?: string }>;
};

export type ActorInfoCardTheme = {
  background?: string;
  color?: string;
  keyColor?: string;
  border?: string;
  borderRadius?: string;
  padding?: string;
  fontSize?: string;
  maxWidth?: string;
  boxShadow?: string;
};

export type MotionMapsConfig = {
  preset?: MotionPreset;
  session?: ReplaySession;
  actors?: MotionActor[];
  observations?: LocationObservation[];
  routes?: Route[];
  geofences?: Geofence[];
  autoplay?: boolean;
  speed?: number;
  loop?: boolean;
  motion?: { interpolation?: "linear" | "none"; tickMs?: number };
  camera?: { follow?: string | "selected"; fitOnStart?: boolean };
  controls?: { replay?: boolean; position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" };
  visuals?: { trail?: boolean; breadcrumbs?: boolean | "auto"; rotateActors?: boolean };
  /** Displays an actor's metadata as a hover card (currently implemented by MapLibre). */
  actorInfoCard?: { enabled?: boolean; maxItems?: number; className?: string; theme?: ActorInfoCardTheme };
  onChange?: (snapshot: MotionMapsSnapshot) => void;
  onActorPress?: (actor: RenderedActor) => void;
  onEvent?: (event: TimelineEvent) => void;
  onReplayChange?: (status: MotionStatus) => void;
  onGeofence?: (event: GeofenceEvent) => void;
  onError?: (error: Error) => void;
};

export type MotionMapsController = {
  play(): void;
  pause(): void;
  restart(): void;
  seek(time: Timestamp): void;
  setSpeed(speed: number): void;
  setData(session: ReplaySession): void;
  appendObservations(observations: LocationObservation[]): void;
  setActors(actors: MotionActor[]): void;
  setOptions(options: Partial<MotionMapsConfig>): void;
  selectActor(id?: string): void;
  getSnapshot(): MotionMapsSnapshot;
  subscribe(listener: (snapshot: MotionMapsSnapshot) => void): () => void;
  exportSession(): ReplaySession;
  destroy(): void;
};
