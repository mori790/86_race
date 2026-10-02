import { useEffect, useRef } from "react";
import { useGame } from "./store";
import { NEUTRAL, type Controls } from "./physics";

export function useInput() {
  const keys = useRef(new Set<string>());
  const reverse = useRef(false);
  const previousButtons = useRef<boolean[]>([]);
  useEffect(() => {
    const action = (code: string) => {
      const game = useGame.getState();
      if (game.help) { if (code === "Escape") useGame.setState({ help: false }); return; }
      if (code === "Escape" && game.mode !== "ready") game.setMode(game.mode === "paused" ? "driving" : "paused");
      if (code === "KeyC") game.toggleCamera();
      if (code === "KeyR") { reverse.current = false; game.reset(); }
      if (code === "KeyM") game.toggleMute();
      if (code === "KeyQ" && Math.abs(game.telemetry.speed) < 2) reverse.current = !reverse.current;
    };
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (/INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || (event.target.tagName === "BUTTON" && event.code === "Space"))) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
      keys.current.add(event.code);
      if (!event.repeat) action(event.code);
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const blur = () => {
      keys.current.clear();
      if (useGame.getState().mode === "driving") useGame.getState().setMode("paused");
    };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return {
    reverse,
    read: (): Controls => {
      const pad = navigator.getGamepads?.()[0];
      const buttons = pad?.buttons.map(b => b.pressed) ?? [];
      if (buttons[3] && !previousButtons.current[3]) useGame.getState().toggleCamera();
      if (buttons[9] && !previousButtons.current[9]) {
        const g = useGame.getState();
        if (g.help) useGame.setState({ help: false });
        else if (g.mode !== "ready") g.setMode(g.mode === "paused" ? "driving" : "paused");
      }
      previousButtons.current = buttons;
      if (useGame.getState().mode !== "driving") return NEUTRAL;
      const pressed = (...codes: string[]) => codes.some(c => keys.current.has(c));
      const axis = pad?.axes[0] ?? 0;
      const stick = Math.abs(axis) > 0.12 ? Math.sign(axis) * (Math.abs(axis) - 0.12) / 0.88 : 0;
      return {
        throttle: Math.max(pressed("KeyW", "ArrowUp") ? 1 : 0, pad?.buttons[7]?.value ?? 0),
        brake: Math.max(pressed("KeyS", "ArrowDown") ? 1 : 0, pad?.buttons[6]?.value ?? 0),
        steer: Math.max(-1, Math.min(1, Number(pressed("KeyD", "ArrowRight")) - Number(pressed("KeyA", "ArrowLeft")) + stick)),
        handbrake: pressed("Space") || !!buttons[0],
      };
    },
  };
}
