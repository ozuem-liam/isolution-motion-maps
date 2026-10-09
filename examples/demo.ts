import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "./demo.css";
import { motionMapsMapLibre } from "../src/maplibre.js";
import type { ReplaySession } from "../src/index.js";

const app = document.querySelector<HTMLDivElement>("#app")!;
// MapLibre v6 needs an explicit worker URL when bundled by Vite.
maplibregl.setWorkerUrl(workerUrl);
app.innerHTML = `<section class="panel"><div><p class="eyebrow">iSolution Media</p><h1>Motion Maps replay</h1><p id="status" aria-live="polite">Loading map…</p><p id="map-status" class="hint" role="status">Drag to pan · scroll/pinch to zoom · use Focus journey to reset the view</p></div><div class="controls"><button id="play" disabled>Play</button><button id="pause" disabled>Pause</button><button id="restart" disabled>Restart</button><button id="fit" disabled>Focus journey</button><button id="zoom-in" disabled aria-label="Zoom in">Zoom +</button><button id="zoom-out" disabled aria-label="Zoom out">Zoom −</button><button id="north" disabled>North up</button><button id="follow" disabled aria-pressed="false">Follow courier</button><label>Speed <select id="speed" disabled><option value="1">1×</option><option value="2">2×</option><option value="4" selected>4×</option><option value="8">8×</option></select></label><label class="timeline-label">Journey <input id="timeline" disabled type="range" min="0" max="1000" value="0" aria-label="Replay timeline" /></label><button id="retry" hidden>Retry map</button></div></section><div id="map"></div>`;

// OpenFreeMap provides a MapLibre-ready street style. Production users should
// configure their own provider or self-hosted style according to their needs.
const styleUrl = "https://tiles.openfreemap.org/styles/liberty";
const map = new maplibregl.Map({
  container: "map", style: styleUrl, center: [3.3792, 6.5244], zoom: 13,
  dragPan: true, scrollZoom: true, doubleClickZoom: true, boxZoom: true, keyboard: true, touchZoomRotate: true
});
map.addControl(new maplibregl.FullscreenControl(), "bottom-right");
const controls = Array.from(document.querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLInputElement>(".controls button:not(#retry), .controls select, .controls input"));
const mapStatus = document.querySelector<HTMLParagraphElement>("#map-status")!;
const retryButton = document.querySelector<HTMLButtonElement>("#retry")!;
const setMapReady = () => { controls.forEach(control => control.disabled = false); retryButton.hidden = true; mapStatus.textContent = "Drag to pan · scroll/pinch to zoom · use Fit journey to reset the view"; };
map.on("load", setMapReady);
map.on("style.load", setMapReady);
map.on("error", event => {
  const error = event.error instanceof Error ? event.error.message : "Map tiles could not be loaded.";
  mapStatus.textContent = `Basemap warning: ${error}`;
  retryButton.hidden = false;
});
retryButton.onclick = () => { retryButton.hidden = true; mapStatus.textContent = "Retrying map…"; map.setStyle(styleUrl); };
const at = (seconds: number) => new Date(Date.UTC(2026, 8, 29, 9, 0, seconds)).toISOString();
const session: ReplaySession = {
  version: 1,
  actors: [
    { id: "courier-1", type: "motorcycle", label: "Courier 1", style: { color: "#f97316" } },
    { id: "rider-2", type: "bicycle", label: "Rider 2", style: { color: "#0ea5e9" } }
  ],
  observations: [
    { actorId: "courier-1", position: { lng: 3.3792, lat: 6.5244 }, recordedAt: at(0) }, { actorId: "courier-1", position: { lng: 3.386, lat: 6.528 }, recordedAt: at(20) }, { actorId: "courier-1", position: { lng: 3.391, lat: 6.522 }, recordedAt: at(40) },
    { actorId: "rider-2", position: { lng: 3.37, lat: 6.518 }, recordedAt: at(0) }, { actorId: "rider-2", position: { lng: 3.378, lat: 6.521 }, recordedAt: at(20) }, { actorId: "rider-2", position: { lng: 3.384, lat: 6.53 }, recordedAt: at(40) }
  ]
};
const journeyStart = Math.min(...session.observations.map(point => new Date(point.recordedAt).getTime()));
const journeyEnd = Math.max(...session.observations.map(point => new Date(point.recordedAt).getTime()));
const timeline = document.querySelector<HTMLInputElement>("#timeline")!;

const fitJourney = (duration = 550) => {
  const positions = session.observations.map(point => point.position);
  const center = positions.reduce((total, point) => ({ lng: total.lng + point.lng / positions.length, lat: total.lat + point.lat / positions.length }), { lng: 0, lat: 0 });
  map.easeTo({ center: [center.lng, center.lat], zoom: 14, duration });
};
const addJourneyPoint = (position: { lng: number; lat: number }, label: string, className: string, color: string) => {
  const element = document.createElement("div");
  element.className = `journey-point ${className}`;
  element.style.zIndex = "1";
  element.style.setProperty("--journey-color", color);
  element.textContent = label;
  new maplibregl.Marker({ element, anchor: "bottom" }).setLngLat([position.lng, position.lat]).addTo(map);
};
map.once("load", () => {
  fitJourney(0);
  // A session may contain several independent journeys.  Start/end markers
  // must therefore be calculated per actor, not from the first and last
  // observation in the entire session.
  for (const actor of session.actors) {
    const observations = session.observations.filter(point => point.actorId === actor.id);
    const first = observations.at(0), last = observations.at(-1);
    if (!first || !last) continue;
    const color = actor.style?.color ?? "#2563eb";
    addJourneyPoint(first.position, `${actor.label ?? actor.id} · Start`, "journey-point--start", color);
    addJourneyPoint(last.position, `${actor.label ?? actor.id} · End`, "journey-point--end", color);
  }
});

let following = false;
const followButton = document.querySelector<HTMLButtonElement>("#follow")!;
const stopFollowing = () => {
  if (!following) return;
  following = false;
  followButton.textContent = "Follow courier";
  followButton.setAttribute("aria-pressed", "false");
};
map.on("dragstart", stopFollowing);
map.on("zoomstart", stopFollowing);

const routes = session.actors.map(actor => ({ id: `${actor.id}-journey`, actorId: actor.id, kind: "planned" as const, coordinates: session.observations.filter(item => item.actorId === actor.id).map(item => item.position), style: { color: actor.style?.color ?? "#5eead4", width: 3, dasharray: [2, 2] } }));
const motion = motionMapsMapLibre(map, { preset: "replay", session, speed: 4, routes, onChange: state => {
  document.querySelector("#status")!.textContent = `${state.status} · ${state.replayTime?.slice(11, 19) ?? "waiting"}`;
  if (state.replayTime) timeline.value = String(((new Date(state.replayTime).getTime() - journeyStart) / (journeyEnd - journeyStart)) * 1000);
  const courier = state.actors.find(actor => actor.id === "courier-1");
  if (following && courier?.renderedPosition) map.easeTo({ center: [courier.renderedPosition.lng, courier.renderedPosition.lat], duration: 180, essential: true });
} });
document.querySelector<HTMLButtonElement>("#play")!.onclick = () => { fitJourney(180); motion.play(); };
document.querySelector<HTMLButtonElement>("#pause")!.onclick = () => motion.pause();
document.querySelector<HTMLButtonElement>("#restart")!.onclick = () => motion.restart();
document.querySelector<HTMLButtonElement>("#fit")!.onclick = fitJourney;
const changeZoom = (amount: number) => {
  if (!map.isStyleLoaded()) { mapStatus.textContent = "Map is still loading. Please wait a moment and try again."; return; }
  map.setZoom(Math.max(2, Math.min(18, map.getZoom() + amount)));
};
document.querySelector<HTMLButtonElement>("#zoom-in")!.onclick = () => changeZoom(1);
document.querySelector<HTMLButtonElement>("#zoom-out")!.onclick = () => changeZoom(-1);
document.querySelector<HTMLButtonElement>("#north")!.onclick = () => map.easeTo({ bearing: 0, pitch: 0, duration: 180 });
followButton.onclick = () => {
  following = !following;
  followButton.textContent = following ? "Free view" : "Follow courier";
  followButton.setAttribute("aria-pressed", String(following));
  if (following) motion.play();
};
document.querySelector<HTMLSelectElement>("#speed")!.onchange = event => motion.setSpeed(Number((event.target as HTMLSelectElement).value));
timeline.oninput = event => motion.seek(journeyStart + ((Number((event.target as HTMLInputElement).value) / 1000) * (journeyEnd - journeyStart)));
