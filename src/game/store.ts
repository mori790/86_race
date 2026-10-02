import { create } from "zustand";

export type Telemetry = {
  speed: number; rpm: number; gear: number; slip: number; g: number;
  suspension: number[]; grounded: number; fps: number;
};
type GameState = {
  mode: "ready" | "driving" | "paused";
  camera: "chase" | "cockpit";
  muted: boolean;
  help: boolean;
  resetId: number;
  telemetry: Telemetry;
  setMode: (mode: GameState["mode"]) => void;
  toggleCamera: () => void;
  toggleMute: () => void;
  reset: () => void;
};
export const useGame = create<GameState>(set => ({
  mode: "ready", camera: "chase", muted: false, help: false, resetId: 0,
  telemetry: { speed: 0, rpm: 900, gear: 1, slip: 0, g: 0, suspension: [0, 0, 0, 0], grounded: 0, fps: 0 },
  setMode: mode => set({ mode }),
  toggleCamera: () => set(s => ({ camera: s.camera === "chase" ? "cockpit" : "chase" })),
  toggleMute: () => set(s => ({ muted: !s.muted })),
  reset: () => set(s => ({ resetId: s.resetId + 1 })),
}));
