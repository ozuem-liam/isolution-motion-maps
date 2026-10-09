import { createElement, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { motionMaps } from "./motion-maps.js";
import type { MotionActor, MotionMapsConfig, MotionMapsController, MotionMapsSnapshot, Position } from "./types.js";

/** Renderer-neutral hook for native applications. */
export function useMotionMapsNative(map: unknown, config: MotionMapsConfig): { controller: MotionMapsController; snapshot: MotionMapsSnapshot } {
  const controller = useMemo(() => motionMaps(map, config), [map]);
  const [snapshot, setSnapshot] = useState(() => controller.getSnapshot());
  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    return () => { unsubscribe(); controller.destroy(); };
  }, [controller]);
  useEffect(() => { controller.setOptions(config); if (config.session) controller.setData(config.session); }, [controller, config]);
  return { controller, snapshot };
}

export type NativeMapComponentSet = {
  MapView: ComponentType<any>;
  Marker: ComponentType<any>;
  Polyline: ComponentType<any>;
  View?: ComponentType<any>;
  Text?: ComponentType<any>;
};
export type MotionMapsNativeProps = MotionMapsConfig & {
  components: NativeMapComponentSet;
  mapProps?: Record<string, unknown>;
  actorMarker?: (actor: MotionActor & { renderedPosition?: Position; bearing?: number }) => ReactNode;
  onSnapshot?: (snapshot: MotionMapsSnapshot) => void;
  onController?: (controller: MotionMapsController) => void;
};

/**
 * Native renderer for component-compatible APIs such as react-native-maps.
 * Pass MapView, Marker, Polyline and (optionally) View/Text from your provider.
 */
export function MotionMapsNative(props: MotionMapsNativeProps): ReactNode {
  const { components, mapProps = {}, actorMarker, onSnapshot, onController, ...config } = props;
  const mapRef = useRef<{ animateToRegion?(region: Record<string, number>, duration?: number): void; fitToCoordinates?(coordinates: Array<{ latitude: number; longitude: number }>, options?: Record<string, unknown>): void } | null>(null);
  const stableConfig = useMemo(() => config, [config.session, config.actors, config.observations, config.preset, config.speed, config.loop, config.motion, config.routes, config.geofences]);
  const { controller, snapshot } = useMotionMapsNative(null, stableConfig);
  const didInitialFit = useRef(false);
  useEffect(() => { onSnapshot?.(snapshot); }, [snapshot, onSnapshot]);
  useEffect(() => { onController?.(controller); }, [controller, onController]);
  useEffect(() => {
    const follow = config.camera?.follow;
    if (!follow) return;
    const actor = snapshot.actors.find(item => follow === "selected" ? item.state === "selected" : item.id === follow);
    if (actor?.renderedPosition) mapRef.current?.animateToRegion?.(region(actor.renderedPosition), 250);
  }, [snapshot, config.camera?.follow]);
  useEffect(() => {
    if (didInitialFit.current || !config.camera?.fitOnStart) return;
    const points = snapshot.actors.flatMap(actor => actor.renderedPosition ? [actor.renderedPosition] : []);
    if (points.length) { didInitialFit.current = true; mapRef.current?.fitToCoordinates?.(points.map(toNativePoint), { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: false }); }
  }, [snapshot.actors, config.camera?.fitOnStart]);

  const routeElements = (config.routes ?? []).map(route => createElement(components.Polyline, { key: `route:${route.id}`, coordinates: route.coordinates.map(toNativePoint), strokeColor: route.style?.color ?? "#64748b", strokeWidth: route.style?.width ?? 3, lineDashPattern: route.style?.dasharray ?? (route.kind === "planned" ? [6, 6] : undefined) }));
  const trailElements = config.visuals?.trail === false ? [] : snapshot.actors.flatMap(actor => {
    const session = controller.exportSession();
    const upto = snapshot.replayTime ? new Date(snapshot.replayTime).getTime() : Infinity;
    const positions = session.observations.filter(item => item.actorId === actor.id && new Date(item.recordedAt).getTime() <= upto).map(item => item.position);
    if (actor.renderedPosition && positions.length) positions.push(actor.renderedPosition);
    return positions.length > 1 ? [createElement(components.Polyline, { key: `trail:${actor.id}`, coordinates: positions.map(toNativePoint), strokeColor: actor.style?.color ?? "#2563eb", strokeWidth: 4 })] : [];
  });
  const actorElements = snapshot.actors.flatMap(actor => {
    if (!actor.renderedPosition) return [];
    const children = actorMarker?.(actor) ?? defaultNativeMarker(components, actor);
    return [createElement(components.Marker, { key: actor.id, coordinate: toNativePoint(actor.renderedPosition), title: actor.label ?? actor.type, description: actor.state ?? "", pinColor: actor.style?.color ?? "#2563eb", tracksViewChanges: true, onPress: () => controller.selectActor(actor.id) }, children)];
  });
  const MapView = components.MapView;
  return createElement(MapView, { ...mapProps, ref: mapRef, initialRegion: mapProps.initialRegion ?? defaultRegion(snapshot), onMapReady: mapProps.onMapReady }, ...routeElements, ...trailElements, ...actorElements);
}

function defaultNativeMarker(components: NativeMapComponentSet, actor: MotionActor & { bearing?: number }): ReactNode {
  if (!components.View || !components.Text) return undefined;
  const color = actor.style?.color ?? "#2563eb";
  const glyph: Record<string, string> = { car: "🚗", van: "🚐", truck: "🚚", bus: "🚌", motorcycle: "🏍️", bicycle: "🚲", scooter: "🛵", pedestrian: "🚶", human: "🧍", boy: "🧒", girl: "👧" };
  return createElement(components.View, { style: { alignItems: "center", backgroundColor: "white", borderColor: color, borderWidth: 3, borderRadius: 24, width: 46, height: 46, justifyContent: "center" } },
    createElement(components.Text, { style: { fontSize: 22, transform: [{ rotate: `${actor.bearing ?? 0}deg` }] } }, glyph[actor.type] ?? "📍"));
}
function toNativePoint(position: Position) { return { latitude: position.lat, longitude: position.lng }; }
function region(position: Position) { return { ...toNativePoint(position), latitudeDelta: 0.02, longitudeDelta: 0.02 }; }
function defaultRegion(snapshot: MotionMapsSnapshot) { const point = snapshot.actors.find(actor => actor.renderedPosition)?.renderedPosition ?? { lat: 0, lng: 0 }; return region(point); }
