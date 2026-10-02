"use client";

import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { ACESFilmicToneMapping } from "three";
import Track, { TRACK_LENGTH } from "./Track";
import Vehicle from "./Vehicle";
import { useGame } from "./store";
import { EngineAudio } from "./audio";

class SceneBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (this.state.error) return <div className="scene-error" role="alert"><h2>3Dシーンを起動できませんでした</h2><p>WebGL 2 対応のデスクトップブラウザで、ハードウェアアクセラレーションを有効にしてください。</p><button onClick={() => location.reload()}>再読み込み</button></div>;
    return this.props.children;
  }
}

function Loaded({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]); return null;
}

const controls = [
  ["W / ↑", "アクセル"], ["S / ↓", "ブレーキ"], ["A D / ← →", "ステアリング"],
  ["SPACE", "ハンドブレーキ"], ["C", "視点切替"], ["R", "リスポーン"],
  ["Q", "D / R 切替（停止中）"], ["ESC", "一時停止"], ["M", "ミュート"],
];

function Hud() {
  const t = useGame(s => s.telemetry);
  const camera = useGame(s => s.camera);
  return <>
    <div className="drive-location"><span className="live-dot" /><span>PROVING GROUND <small>テストコース / FREE RUN</small></span></div>
    <div className="drive-tools">
      <button onClick={e => { useGame.getState().toggleCamera(); e.currentTarget.blur(); }}><kbd>C</kbd> {camera === "chase" ? "CHASE CAM" : "COCKPIT"}</button>
      <button onClick={e => { useGame.getState().reset(); e.currentTarget.blur(); }}><kbd>R</kbd> RESET</button>
    </div>
    <div className="telemetry-panel">
      <div className="mini-title"><span>CHASSIS TELEMETRY</span><span className="accent">LIVE</span></div>
      <div className="suspension-grid">{t.suspension.map((length, i) => <div key={i}><span>{["FL", "FR", "RL", "RR"][i]}</span><div className="suspension-track"><i style={{ height: `${Math.max(5, Math.min(100, (0.52 - length) / 0.4 * 100))}%` }} /></div></div>)}</div>
      <div className="telemetry-stats"><span>{Math.abs(t.g).toFixed(2)} <small>LATERAL G</small></span><span>{t.grounded}/4 <small>CONTACT</small></span></div>
      <div className="telemetry-note">4輪独立レイキャストサスペンション</div>
    </div>
    <div className="instrument-cluster" aria-label="車両メーター">
      <div className="rpm-numbers">{[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => <span key={n} className={n >= 7 ? "redline" : ""}>{n}</span>)}</div>
      <div className="rpm-track"><div style={{ width: `${Math.min(100, t.rpm / 80)}%` }} className={t.rpm > 7000 ? "hot" : ""} /></div>
      <div className="speed-row"><div className="gear"><small>GEAR</small><strong>{t.gear < 0 ? "R" : t.gear}</strong><span>6AT</span></div><div className="speed"><strong data-testid="speed">{Math.round(Math.abs(t.speed)).toString().padStart(3, "0")}</strong><span>km/h</span></div></div>
      <div className="instrument-footer"><span>{Math.round(t.rpm).toLocaleString("en-US")} RPM</span><span>{t.slip > 0.13 ? "SLIP" : "FR · REAR WHEEL DRIVE"}</span></div>
    </div>
    <div className="drive-bottom"><span><kbd>W A S D</kbd> DRIVE <kbd>SPACE</kbd> HANDBRAKE <kbd>ESC</kbd> PAUSE</span><span>{t.fps} FPS <i /> PHYSICS 60 HZ</span></div>
  </>;
}

export default function Game() {
  const mode = useGame(s => s.mode);
  const muted = useGame(s => s.muted);
  const [loaded, setLoaded] = useState(false);
  const help = useGame(s => s.help);
  const setHelp = (help: boolean) => useGame.setState({ help });
  const [notice, setNotice] = useState("");
  const audio = useRef<EngineAudio | null>(null);
  if (!audio.current) audio.current = new EngineAudio();
  const markReady = useRef(() => setLoaded(true)).current;
  useEffect(() => () => audio.current?.dispose(), []);
  async function start() {
    try { await audio.current!.start(); } catch { setNotice("音声を開始できませんでした。走行は続けられます。"); }
    useGame.getState().setMode("driving");
    (document.activeElement as HTMLElement | null)?.blur();
  }
  function showHelp() {
    if (mode === "driving") useGame.getState().setMode("paused");
    setHelp(!help);
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { setNotice("このブラウザでは全画面表示を利用できません。"); }
  }
  return <main className={`game ${mode}`}>
    <div className="scene">
      <SceneBoundary>
        <Canvas shadows dpr={[1, 1.5]} camera={{ position: [6, 3, 7], fov: 43, near: 0.08, far: 1400 }} gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }} fallback={<div className="scene-error">WebGL 2 対応ブラウザが必要です。</div>}>
          <color attach="background" args={["#101c27"]} /><fog attach="fog" args={["#101c27", 110, 650]} />
          <hemisphereLight args={["#a6bfda", "#202731", 1.25]} />
          <directionalLight position={[15, 25, 8]} intensity={2.3} color="#b4c7e0" />
          <directionalLight position={[-10, 8, -8]} intensity={1.2} color="#f3cda8" />
          <Suspense fallback={null}>
            <Environment resolution={128} frames={1}>
              <Lightformer intensity={3} position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 8, 1]} />
              <Lightformer intensity={4} position={[6, 3, 0]} rotation={[0, Math.PI / 2, 0]} scale={[15, 2, 1]} color="#bcd9ee" />
              <Lightformer intensity={3} position={[-5, 2, -3]} rotation={[0, -Math.PI / 2, 0]} scale={[12, 1, 1]} color="#f6d7b0" />
            </Environment>
            <Physics paused={mode !== "driving"} timeStep={1 / 60} gravity={[0, -9.81, 0]}>
              <Track /><Vehicle audio={audio.current} />
            </Physics>
            <Loaded onReady={markReady} />
          </Suspense>
        </Canvas>
      </SceneBoundary>
    </div>
    <div className="vignette" />
    <header className="topbar">
      <a className="wordmark" href="/" aria-label="Tokyo Midnight 86 ホーム"><span className="brand-symbol">86</span><span>TOKYO<span className="wordmark-sub">MIDNIGHT</span></span></a>
      <div className="build-tag"><span className="live-dot" /> DRIVING LAB <span>01 / PROTOTYPE</span></div>
      <nav aria-label="ゲーム設定">
        <button onClick={showHelp} aria-expanded={help}>操作方法 <span>↗</span></button>
        <button onClick={e => { useGame.getState().toggleMute(); e.currentTarget.blur(); }} aria-label={muted ? "音声をオン" : "音声をオフ"} aria-pressed={muted}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
        <button className="fullscreen" onClick={fullscreen} aria-label="全画面表示">⛶</button>
      </nav>
    </header>

    {mode === "ready" && <>
      <section className="intro">
        <div className="eyebrow"><span className="accent-line" /> REAR-WHEEL DRIVE. AFTER DARK.</div>
        <h1>TOKYO<br /><span>MIDNIGHT</span><b>86<span className="title-dot">.</span></b></h1>
        <p className="intro-ja">夜を走る。その感覚から。</p>
        <p className="intro-copy">4輪の接地。アクセルで変わる姿勢。<br />走りの芯をつくる、最初のドライビングラボ。</p>
        <div className="start-row"><button className="primary-button" onClick={start} disabled={!loaded}>{loaded ? "START ENGINE" : "LOADING PHYSICS"}<span>→</span></button><span className="start-note">{loaded ? "キーを握って、走り出そう。" : "車両を準備しています…"}</span></div>
        <div className="input-hint"><span>⌨</span> KEYBOARD <i /> GAMEPAD READY</div>
      </section>
      <div className="car-caption"><span className="caption-rule" /><div><span className="eyebrow">THE DRIVER’S CAR</span><strong>86 <span>2.0 NA / FR</span></strong><small>GT86-inspired · procedural prototype</small></div></div>
      <footer className="spec-footer">
        <div className="spec-heading"><span className="tiny-label">VEHICLE 01</span><strong>Pure balance.</strong><span>軽さと、後輪駆動。</span></div>
        <div className="spec"><span>ENGINE</span><strong>2.0 <small>L</small></strong><em>NATURALLY ASPIRATED</em></div>
        <div className="spec"><span>PEAK TORQUE</span><strong>205 <small>Nm</small></strong><em>AT 5,000 RPM</em></div>
        <div className="spec"><span>CURB WEIGHT</span><strong>1,250 <small>kg</small></strong><em>FR / 6-SPEED AUTO</em></div>
        <div className="track-spec"><span className="tiny-label">TEST ENVIRONMENT</span><strong>Proving ground <span>↗</span></strong><span>{(TRACK_LENGTH / 1000).toFixed(2)} KM <i /> FLAT CIRCUIT <i /> NIGHT</span></div>
      </footer>
    </>}

    {mode !== "ready" && <Hud />}
    {mode === "paused" && !help && <div className="modal-scrim"><section className="pause-card" aria-label="一時停止"><span className="eyebrow">TAKE A BREATH</span><h2>PAUSED<span>.</span></h2><p>走りは、ここで待っている。</p><button className="primary-button" onClick={start}>RESUME DRIVE <span>→</span></button><button className="text-button" onClick={() => { useGame.getState().reset(); useGame.getState().setMode("ready"); }}>スタート画面へ戻る</button></section></div>}
    {help && <div className="modal-scrim"><section className="help-card" aria-label="操作方法"><button className="close-button" onClick={() => setHelp(false)} aria-label="操作方法を閉じる">×</button><span className="eyebrow">GET IN. DRIVE.</span><h2>操作方法</h2><div className="control-list">{controls.map(([key, label]) => <div key={key}><kbd>{key}</kbd><span>{label}</span></div>)}</div><p>ゲームパッド: RT アクセル / LT ブレーキ / 左スティック 操舵 / A ハンドブレーキ / Y 視点 / Menu 一時停止</p><small>Phase 1: 平坦な試験コースで車両挙動を確認するプロトタイプです。都市・レース計測・交通車両は今後のフェーズで追加します。</small><button className="primary-button" onClick={() => setHelp(false)}>GOT IT <span>→</span></button></section></div>}
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="通知を閉じる">×</button></div>}
    <div className="mobile-warning">デスクトップ + キーボード、またはゲームパッドでプレイしてください。</div>
  </main>;
}
