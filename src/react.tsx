import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motionMaps } from "./motion-maps.js";
import type { MotionMapsConfig, MotionMapsController, MotionMapsSnapshot } from "./types.js";

export type MotionMapsProps = MotionMapsConfig & {
  map: unknown;
  children?: (snapshot: MotionMapsSnapshot, controller: MotionMapsController) => ReactNode;
};

/** Declarative wrapper for applications that already own their map renderer. */
export function MotionMaps({ map, children, ...config }: MotionMapsProps): ReactNode {
  const controller = useMemo(() => motionMaps(map, config), [map]);
  const [snapshot, setSnapshot] = useState(() => controller.getSnapshot());
  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    return () => { unsubscribe(); controller.destroy(); };
  }, [controller]);
  return children ? <>{children(snapshot, controller)}</> : null;
}

export function ReplayControls({ controller }: { controller: MotionMapsController }): ReactNode {
  const [snapshot, setSnapshot] = useState(() => controller.getSnapshot());
  const [speed, setSpeed] = useState(1);
  useEffect(() => controller.subscribe(setSnapshot), [controller]);
  const points = controller.exportSession().observations.map(item => new Date(item.recordedAt).getTime());
  const start = Math.min(...points), end = Math.max(...points);
  const value = snapshot.replayTime && end > start ? ((new Date(snapshot.replayTime).getTime() - start) / (end - start)) * 1000 : 0;
  return <div role="group" aria-label="Replay controls">
    <button type="button" onClick={() => controller.play()}>Play</button>
    <button type="button" onClick={() => controller.pause()}>Pause</button>
    <button type="button" onClick={() => controller.restart()}>Restart</button>
    <input aria-label="Replay timeline" type="range" min="0" max="1000" value={value} onChange={event => controller.seek(start + ((Number(event.target.value) / 1000) * (end - start)))} />
    <select aria-label="Replay speed" value={speed} onChange={event => { const next = Number(event.target.value); setSpeed(next); controller.setSpeed(next); }}>
      {[0.25, 0.5, 1, 2, 4, 8].map(option => <option key={option} value={option}>{option}×</option>)}
    </select>
  </div>;
}
