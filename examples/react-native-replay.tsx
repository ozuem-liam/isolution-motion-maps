/**
 * Copy this component into an Expo or React Native application.
 *
 * Install the host renderer separately:
 *   npx expo install react-native-maps
 *   npm install motion-maps
 */
import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { MotionMapsNative } from "motion-maps/react-native";
import type { MotionMapsController, MotionMapsSnapshot, ReplaySession } from "motion-maps";

const session: ReplaySession = {
  version: 1,
  actors: [{ id: "courier-1", type: "motorcycle", label: "Courier 1", style: { color: "#f97316" } }],
  observations: [
    { actorId: "courier-1", position: { lng: 3.3792, lat: 6.5244 }, recordedAt: "2026-09-29T09:00:00Z" },
    { actorId: "courier-1", position: { lng: 3.384, lat: 6.527 }, recordedAt: "2026-09-29T09:00:15Z" },
    { actorId: "courier-1", position: { lng: 3.391, lat: 6.522 }, recordedAt: "2026-09-29T09:00:30Z" }
  ]
};

export function NativeReplayExample() {
  const [controller, setController] = useState<MotionMapsController>();
  const [status, setStatus] = useState("idle");
  const onSnapshot = (snapshot: MotionMapsSnapshot) => setStatus(snapshot.status);
  return <View style={styles.screen}>
    <MotionMapsNative components={{ MapView, Marker, Polyline, View, Text }} preset="replay" session={session} speed={2} camera={{ fitOnStart: true }} onSnapshot={onSnapshot} onController={setController} mapProps={{ style: styles.map, initialRegion: { latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.03, longitudeDelta: 0.03 } }} />
    <View style={styles.controls}>
      <Text accessibilityLiveRegion="polite">{status}</Text>
      <Button title="Play" onPress={() => controller?.play()} />
      <Button title="Pause" onPress={() => controller?.pause()} />
      <Button title="Restart" onPress={() => controller?.restart()} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, map: { flex: 1 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", padding: 12 }
});
