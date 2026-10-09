import { actorSvg } from "./assets.js";
import { motionMaps } from "./motion-maps.js";
import { toEpochMs } from "./validation.js";
import type { MotionMapsConfig, MotionMapsController, MotionMapsSnapshot, Position, Route } from "./types.js";

type LatLng = { lat: number; lng: number };
type GoogleMarker = { setMap(map: unknown): void; setPosition(position: LatLng): void; setIcon?(icon: unknown): void; setLabel?(label: string): void; addListener(event: string, callback: () => void): { remove(): void } };
type GooglePolyline = { setMap(map: unknown): void; setPath(path: LatLng[]): void; setOptions(options: Record<string, unknown>): void };
type GoogleMapLike = { panTo?(position: LatLng): void; setCenter?(position: LatLng): void; fitBounds?(bounds: unknown): void };
export type GoogleMapsApi = { Marker: new (options: Record<string, unknown>) => GoogleMarker; Polyline: new (options: Record<string, unknown>) => GooglePolyline; LatLngBounds: new () => { extend(position: LatLng): void } };
export type GoogleMapsMotionConfig = MotionMapsConfig & { api: unknown; markerClassName?: string };

/** Attaches replay actors, routes, trails and camera following to a Google Maps JS map. */
export function motionMapsGoogle(map: GoogleMapLike, config: GoogleMapsMotionConfig): MotionMapsController {
  const api = config.api as GoogleMapsApi;
  const markers = new Map<string, GoogleMarker>();
  const markerListeners = new Map<string, { remove(): void }>();
  const lines = new Map<string, GooglePolyline>();
  const routes = new Map<string, GooglePolyline>();
  let options = config, destroyed = false, snapshot: MotionMapsSnapshot | undefined;
  let onChange = config.onChange, onError = config.onError;
  const report = (error: unknown) => { const value = error instanceof Error ? error : new Error(String(error)); onError?.(value); };
  const changed = (next: MotionMapsSnapshot) => { snapshot = next; onChange?.(next); if (!destroyed) try { render(next); } catch (error) { report(error); } };
  const controller = motionMaps(map, { ...config, onChange: changed, onError: report });

  function render(current: MotionMapsSnapshot) {
    const active = new Set(current.actors.map(actor => actor.id));
    for (const [id, marker] of markers) if (!active.has(id)) { marker.setMap(null); markers.delete(id); markerListeners.get(id)?.remove(); markerListeners.delete(id); }
    for (const actor of current.actors) {
      if (!actor.renderedPosition) continue;
      const position = { lat: actor.renderedPosition.lat, lng: actor.renderedPosition.lng };
      let marker = markers.get(actor.id);
      if (!marker) {
        marker = new api.Marker({ map, position, title: actor.label ?? actor.type, icon: googleIcon(api, actor.type, actor.style?.color, actor.style?.asset, actor.bearing) });
        markerListeners.set(actor.id, marker.addListener("click", () => controller.selectActor(actor.id)));
        markers.set(actor.id, marker);
      } else marker.setPosition(position);
      marker.setIcon?.(googleIcon(api, actor.type, actor.style?.color, actor.style?.asset, actor.bearing));
      if (actor.label) marker.setLabel?.(actor.label);
    }
    const session = controller.exportSession();
    const time = current.replayTime ? toEpochMs(current.replayTime) : Infinity;
    syncLineSet(lines, options.visuals?.trail === false ? [] : session.actors.map(actor => {
      const coordinates = session.observations.filter(point => point.actorId === actor.id && toEpochMs(point.recordedAt) <= time).map(point => point.position);
      const rendered = current.actors.find(item => item.id === actor.id)?.renderedPosition;
      if (rendered && coordinates.length) coordinates.push(rendered);
      return { id: actor.id, coordinates, color: actor.style?.color ?? "#2563eb", width: 4, opacity: .75 };
    }));
    syncLineSet(routes, (options.routes ?? []).map(route => ({ id: route.id, actorId: route.actorId, coordinates: route.coordinates, color: route.style?.color ?? "#64748b", width: route.style?.width ?? 3, dasharray: route.style?.dasharray, opacity: .9 })));
    if (!didFit && options.camera?.fitOnStart) { didFit = true; const points = current.actors.map(actor => actor.renderedPosition).filter((point): point is Position => Boolean(point)); if (points.length) { const bounds = new api.LatLngBounds(); points.forEach(point => bounds.extend({ lat: point.lat, lng: point.lng })); map.fitBounds?.(bounds); } }
    const follow = options.camera?.follow;
    if (follow) { const actor = current.actors.find(item => follow === "selected" ? item.state === "selected" : item.id === follow); if (actor?.renderedPosition) (map.panTo ?? map.setCenter)?.call(map, { lat: actor.renderedPosition.lat, lng: actor.renderedPosition.lng }); }
  }
  let didFit = false;
  function syncLineSet(target: Map<string, GooglePolyline>, desired: Array<{ id: string; coordinates: Position[]; color: string; width: number; dasharray?: number[]; opacity: number }>) {
    const active = new Set(desired.map(line => line.id));
    for (const [id, line] of target) if (!active.has(id)) { line.setMap(null); target.delete(id); }
    for (const item of desired) {
      const path = item.coordinates.map(point => ({ lat: point.lat, lng: point.lng }));
      let line = target.get(item.id);
      const style = { strokeColor: item.color, strokeWeight: item.width, strokeOpacity: item.opacity, ...(item.dasharray ? { icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: `${Math.max(4, item.dasharray.reduce((sum, value) => sum + value, 0) * 2)}px` }] } : {}) };
      if (!line) { line = new api.Polyline({ map, path, ...style }); target.set(item.id, line); } else { line.setPath(path); line.setOptions(style); }
    }
  }
  return { ...controller,
    setOptions(next) { options = { ...options, ...next, visuals: { ...options.visuals, ...next.visuals }, camera: { ...options.camera, ...next.camera } }; onChange = next.onChange ?? onChange; onError = next.onError ?? onError; controller.setOptions({ ...next, onChange: changed, onError: report }); if (snapshot) render(snapshot); },
    destroy() { destroyed = true; markers.forEach(marker => marker.setMap(null)); markerListeners.forEach(listener => listener.remove()); lines.forEach(line => line.setMap(null)); routes.forEach(line => line.setMap(null)); controller.destroy(); }
  };
}

function svgUrl(svg: string): string { return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`; }
function googleIcon(api: GoogleMapsApi, type: Parameters<typeof actorSvg>[0], color?: string, asset?: string, bearing = 0): unknown {
  const maybe = api as unknown as { Size?: new (width: number, height: number) => unknown };
  return { url: asset ?? svgUrl(actorSvg(type, color).replace("<svg ", `<svg style="transform:rotate(${bearing}deg)" `)), ...(maybe.Size ? { scaledSize: new maybe.Size(42, 42) } : {}) };
}
