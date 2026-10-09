import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { actorSvg } from "./assets.js";
import { motionMaps } from "./motion-maps.js";
import { toEpochMs } from "./validation.js";
import type {
  MotionMapsConfig,
  MotionMapsController,
  MotionMapsSnapshot,
  Position,
  Route,
} from "./types.js";

export type MapLibreMotionMapsConfig = MotionMapsConfig & {
  markerClassName?: string;
};
let instanceNumber = 0;

/** MapLibre renderer with isolated layer IDs, lifecycle recovery and safe updates. */
export function motionMapsMapLibre(
  map: MapLibreMap,
  initialOptions: MapLibreMotionMapsConfig = {},
): MotionMapsController {
  const prefix = `isolution-motion-maps-${++instanceNumber}`;
  const markers = new globalThis.Map<string, Marker>();
  const trailIds = new globalThis.Map<string, string>();
  const routeIds = new globalThis.Map<string, string>();
  let options = initialOptions,
    latestSnapshot: MotionMapsSnapshot | undefined,
    ready = false,
    destroyed = false,
    didInitialFit = false;
  let externalChange = initialOptions.onChange,
    externalError = initialOptions.onError;
  const report = (error: unknown) => {
    const normalized =
      error instanceof Error ? error : new Error(String(error));
    console.error("Motion Maps MapLibre render error", normalized);
    externalError?.(normalized);
  };
  const changed = (snapshot: MotionMapsSnapshot) => {
    latestSnapshot = snapshot;
    externalChange?.(snapshot);
    if (ready && !destroyed)
      try {
        render(snapshot);
      } catch (error) {
        report(error);
      }
  };
  const controller = motionMaps(map, {
    ...initialOptions,
    onChange: changed,
    onError: report,
  });
  const initialise = () => {
    if (!destroyed) {
      ready = true;
      if (latestSnapshot) render(latestSnapshot);
    }
  };
  map.once("load", initialise);
  map.on("style.load", initialise);
  if (map.loaded()) initialise();

  function render(snapshot: MotionMapsSnapshot): void {
    syncMarkers(snapshot);
    syncTrails(snapshot);
    syncRoutes(options.routes ?? []);
    if (!didInitialFit && options.camera?.fitOnStart) {
      didInitialFit = true;
      fitActors(
        map,
        snapshot.actors
          .map((a) => a.renderedPosition)
          .filter((p): p is Position => Boolean(p)),
      );
    }
    followActor(map, snapshot, options.camera?.follow);
  }
  function syncMarkers(snapshot: MotionMapsSnapshot): void {
    const active = new Set(snapshot.actors.map((actor) => actor.id));
    markers.forEach((marker, id) => {
      if (!active.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    });
    for (const actor of snapshot.actors) {
      if (!actor.renderedPosition) continue;
      let marker = markers.get(actor.id);
      if (!marker) {
        const element = document.createElement("button");
        element.type = "button";
        element.className = options.markerClassName ?? "ismm-actor";
        element.style.zIndex = "5";
        element.setAttribute("aria-label", actor.label ?? actor.type);
        element.innerHTML = markerMarkup(
          actor.type,
          actor.label,
          actor.style?.color,
          actor.style?.asset,
        );
        element.addEventListener("click", () =>
          controller.selectActor(actor.id),
        );
        marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat([actor.renderedPosition.lng, actor.renderedPosition.lat])
          .addTo(map);
        markers.set(actor.id, marker);
      }
      marker.setLngLat([
        actor.renderedPosition.lng,
        actor.renderedPosition.lat,
      ]);
      const icon = marker
        .getElement()
        .querySelector<HTMLElement>(".ismm-actor__icon");
      if (icon && options.visuals?.rotateActors !== false)
        icon.style.transform = `rotate(${actor.bearing ?? 0}deg)`;
      marker
        .getElement()
        .classList.toggle("is-selected", actor.state === "selected");
    }
  }
  function syncTrails(snapshot: MotionMapsSnapshot): void {
    const session = controller.exportSession(),
      active = new Set(session.actors.map((actor) => actor.id));
    trailIds.forEach((id, actorId) => {
      if (!active.has(actorId)) {
        remove(map, id);
        trailIds.delete(actorId);
      }
    });
    if (options.visuals?.trail === false) {
      trailIds.forEach((id) => remove(map, id));
      trailIds.clear();
      return;
    }
    const time = snapshot.replayTime
      ? toEpochMs(snapshot.replayTime)
      : Number.POSITIVE_INFINITY;
    for (const actor of session.actors) {
      const id = trailIds.get(actor.id) ?? `${prefix}-trail-${actor.id}`;
      ensureLine(map, id, actor.style?.color ?? "#2563eb", 4, 0.72);
      trailIds.set(actor.id, id);
      const points = session.observations
        .filter(
          (item) =>
            item.actorId === actor.id && toEpochMs(item.recordedAt) <= time,
        )
        .map(
          (item) => [item.position.lng, item.position.lat] as [number, number],
        );
      const rendered = snapshot.actors.find(
        (item) => item.id === actor.id,
      )?.renderedPosition;
      if (rendered && points.length) points.push([rendered.lng, rendered.lat]);
      (map.getSource(id) as GeoJSONSource).setData(lineFeature(points));
    }
  }
  function syncRoutes(routes: Route[]): void {
    const active = new Set(routes.map((route) => route.id));
    routeIds.forEach((id, routeId) => {
      if (!active.has(routeId)) {
        remove(map, id);
        routeIds.delete(routeId);
      }
    });
    for (const route of routes) {
      const id = routeIds.get(route.id) ?? `${prefix}-route-${route.id}`;
      ensureLine(
        map,
        id,
        route.style?.color ?? "#64748b",
        route.style?.width ?? 3,
        0.9,
        route.style?.dasharray ??
          (route.kind === "planned" ? [2, 2] : undefined),
      );
      routeIds.set(route.id, id);
      (map.getSource(id) as GeoJSONSource).setData(
        lineFeature(route.coordinates.map((point) => [point.lng, point.lat])),
      );
    }
  }
  return {
    ...controller,
    setOptions(next) {
      options = {
        ...options,
        ...next,
        visuals: { ...options.visuals, ...next.visuals },
        camera: { ...options.camera, ...next.camera },
      };
      externalChange = next.onChange ?? externalChange;
      externalError = next.onError ?? externalError;
      controller.setOptions({ ...next, onChange: changed, onError: report });
      if (ready && latestSnapshot) render(latestSnapshot);
    },
    destroy() {
      destroyed = true;
      map.off("load", initialise);
      map.off("style.load", initialise);
      markers.forEach((marker) => marker.remove());
      trailIds.forEach((id) => remove(map, id));
      routeIds.forEach((id) => remove(map, id));
      controller.destroy();
    },
  };
}

function ensureLine(
  map: MapLibreMap,
  id: string,
  color: string,
  width: number,
  opacity: number,
  dasharray?: number[],
): void {
  if (!map.getSource(id))
    map.addSource(id, { type: "geojson", data: lineFeature([]) });
  if (!map.getLayer(id))
    map.addLayer({
      id,
      type: "line",
      source: id,
      paint: {
        "line-color": color,
        "line-width": width,
        "line-opacity": opacity,
        ...(dasharray ? { "line-dasharray": dasharray } : {}),
      },
    });
}
function fitActors(map: MapLibreMap, positions: Position[]): void {
  if (!positions.length) return;
  const center = positions.reduce(
    (total, position) => ({
      lng: total.lng + position.lng / positions.length,
      lat: total.lat + position.lat / positions.length,
    }),
    { lng: 0, lat: 0 },
  );
  map.jumpTo({
    center: [center.lng, center.lat],
    zoom: Math.max(map.getZoom(), 14),
  });
}
function followActor(
  map: MapLibreMap,
  snapshot: MotionMapsSnapshot,
  follow?: string | "selected",
): void {
  if (!follow) return;
  const actor = snapshot.actors.find((item) =>
    follow === "selected" ? item.state === "selected" : item.id === follow,
  );
  if (actor?.renderedPosition)
    map.jumpTo({
      center: [actor.renderedPosition.lng, actor.renderedPosition.lat],
    });
}
function lineFeature(
  coordinates: [number, number][],
): GeoJSON.Feature<GeoJSON.LineString> | GeoJSON.FeatureCollection {
  return coordinates.length < 2
    ? { type: "FeatureCollection", features: [] }
    : {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates },
      };
}
function remove(map: MapLibreMap, id: string): void {
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
}
function markerMarkup(
  type: any,
  label?: string,
  color?: string,
  asset?: string,
): string {
  const visual = asset
    ? `<img src="${escapeHtml(asset)}" alt="" />`
    : actorSvg(type, color);
  return `<span class="ismm-actor__icon" aria-hidden="true">${visual}</span><span class="ismm-actor__label">${escapeHtml(label ?? type)}</span>`;
}
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ]!,
  );
}
