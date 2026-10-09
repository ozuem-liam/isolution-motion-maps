import { actorSvg } from "./assets.js";
import { motionMaps } from "./motion-maps.js";
import { toEpochMs } from "./validation.js";
import type { MotionMapsConfig, MotionMapsController, MotionMapsSnapshot, Position } from "./types.js";

type LeafletMarker = { setLatLng(point: [number, number]): LeafletMarker; setIcon(icon: unknown): LeafletMarker; bindTooltip?(content: string, options?: unknown): LeafletMarker; on(event: string, callback: () => void): LeafletMarker; addTo?(map: unknown): LeafletMarker; remove(): void };
type LeafletLine = { setLatLngs(points: [number, number][]): LeafletLine; setStyle(style: Record<string, unknown>): LeafletLine; addTo?(map: unknown): LeafletLine; remove(): void };
export type LeafletApi = { marker(point: [number, number], options?: unknown): LeafletMarker; polyline(points: [number, number][], options?: unknown): LeafletLine; divIcon(options: Record<string, unknown>): unknown; latLngBounds(points: [number, number][]): unknown };
type LeafletMapLike = { fitBounds?(bounds: unknown, options?: unknown): void; panTo?(point: [number, number]): void; setView?(point: [number, number], zoom?: number, options?: unknown): void; getZoom?(): number };
export type LeafletMotionMapsConfig = MotionMapsConfig & { leaflet: unknown; markerClassName?: string };

/** Adds Motion Maps actor markers, replay trails and routes to an existing Leaflet map. */
export function motionMapsLeaflet(map: LeafletMapLike, config: LeafletMotionMapsConfig): MotionMapsController {
  const leaflet = config.leaflet as LeafletApi;
  const actors = new Map<string, LeafletMarker>(), lines = new Map<string, LeafletLine>(), routes = new Map<string, LeafletLine>();
  let options = config, latest: MotionMapsSnapshot | undefined, destroyed = false, fitted = false;
  let onChange = config.onChange, onError = config.onError;
  const report = (error: unknown) => onError?.(error instanceof Error ? error : new Error(String(error)));
  const changed = (snapshot: MotionMapsSnapshot) => { latest = snapshot; onChange?.(snapshot); if (!destroyed) try { render(snapshot); } catch (error) { report(error); } };
  const controller = motionMaps(map, { ...config, onChange: changed, onError: report });
  function render(snapshot: MotionMapsSnapshot) {
    const session = controller.exportSession(), active = new Set(snapshot.actors.map(actor => actor.id));
    for (const [id, marker] of actors) if (!active.has(id)) { marker.remove(); actors.delete(id); }
    for (const actor of snapshot.actors) {
      if (!actor.renderedPosition) continue;
      const position: [number, number] = [actor.renderedPosition.lat, actor.renderedPosition.lng];
      let marker = actors.get(actor.id);
      if (!marker) {
        marker = leaflet.marker(position, { icon: leaflet.divIcon({ className: options.markerClassName ?? "motion-maps-leaflet-marker", html: markerHtml(actor.type, actor.label, actor.style?.color, actor.style?.asset, actor.bearing), iconSize: [44, 48], iconAnchor: [22, 22] }), title: actor.label ?? actor.type, keyboard: true });
        marker.on("click", () => controller.selectActor(actor.id)); marker.addTo?.(map);
        actors.set(actor.id, marker);
      } else {
        marker.setLatLng(position);
        marker.setIcon(leaflet.divIcon({ className: options.markerClassName ?? "motion-maps-leaflet-marker", html: markerHtml(actor.type, actor.label, actor.style?.color, actor.style?.asset, actor.bearing), iconSize: [44, 48], iconAnchor: [22, 22] }));
      }
    }
    const time = snapshot.replayTime ? toEpochMs(snapshot.replayTime) : Infinity;
    syncLines(lines, options.visuals?.trail === false ? [] : session.actors.map(actor => {
      const points = session.observations.filter(item => item.actorId === actor.id && toEpochMs(item.recordedAt) <= time).map(item => item.position);
      const rendered = snapshot.actors.find(item => item.id === actor.id)?.renderedPosition;
      if (rendered && points.length) points.push(rendered);
      return { id: actor.id, points, color: actor.style?.color ?? "#2563eb", weight: 4, opacity: .75 };
    }));
    syncLines(routes, (options.routes ?? []).map(route => ({ id: route.id, points: route.coordinates, color: route.style?.color ?? "#64748b", weight: route.style?.width ?? 3, dashArray: route.style?.dasharray?.join(" ") ?? (route.kind === "planned" ? "6 6" : undefined), opacity: .9 })));
    if (!fitted && options.camera?.fitOnStart) { fitted = true; const points = snapshot.actors.flatMap(actor => actor.renderedPosition ? [[actor.renderedPosition.lat, actor.renderedPosition.lng] as [number, number]] : []); if (points.length) map.fitBounds?.(leaflet.latLngBounds(points), { padding: [28, 28] }); }
    if (options.camera?.follow) { const actor = snapshot.actors.find(item => options.camera?.follow === "selected" ? item.state === "selected" : item.id === options.camera?.follow); if (actor?.renderedPosition) map.panTo?.([actor.renderedPosition.lat, actor.renderedPosition.lng]); }
  }
  function syncLines(target: Map<string, LeafletLine>, desired: Array<{ id: string; points: Position[]; color: string; weight: number; opacity: number; dashArray?: string }>) {
    const active = new Set(desired.map(item => item.id));
    for (const [id, line] of target) if (!active.has(id)) { line.remove(); target.delete(id); }
    for (const item of desired) {
      const points = item.points.map(point => [point.lat, point.lng] as [number, number]);
      let line = target.get(item.id); const style = { color: item.color, weight: item.weight, opacity: item.opacity, ...(item.dashArray ? { dashArray: item.dashArray } : {}) };
      if (!line) { line = leaflet.polyline(points, style); line.addTo?.(map); target.set(item.id, line); } else line.setLatLngs(points).setStyle(style);
    }
  }
  return { ...controller,
    setOptions(next) { options = { ...options, ...next, visuals: { ...options.visuals, ...next.visuals }, camera: { ...options.camera, ...next.camera } }; onChange = next.onChange ?? onChange; onError = next.onError ?? onError; controller.setOptions({ ...next, onChange: changed, onError: report }); if (latest) render(latest); },
    destroy() { destroyed = true; actors.forEach(marker => marker.remove()); lines.forEach(line => line.remove()); routes.forEach(line => line.remove()); controller.destroy(); }
  };
}

function markerHtml(type: string, label?: string, color?: string, asset?: string, bearing = 0): string {
  const icon = asset ? `<img src="${escapeHtml(asset)}" alt="" width="32" height="32" />` : actorSvg(type as Parameters<typeof actorSvg>[0], color).replace("<svg ", `<svg width="32" height="32" style="transform:rotate(${bearing}deg)" `);
  return `<span style="display:flex;flex-direction:column;align-items:center;gap:2px;color:#07111f;font:700 10px system-ui;white-space:nowrap"><span style="display:grid;place-items:center;width:42px;height:42px;border:3px solid #fff;border-radius:50%;background:#f8fafc;box-shadow:0 3px 12px #07111f99">${icon}</span>${label ? `<span style="padding:2px 5px;border-radius:4px;background:#07111fe8;color:white">${escapeHtml(label)}</span>` : ""}</span>`;
}
function escapeHtml(value: string): string { return value.replace(/[&<>\'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[char]!); }
