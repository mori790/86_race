import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from "@react-three/rapier";
import type { DynamicRayCastVehicleController } from "@dimforge/rapier3d-compat";
import { Group, Object3D, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { CarBody, Wheel } from "./CarModel";
import { CAR, createVehicle, newDriveState, NEUTRAL, stepVehicle } from "./physics";
import { useInput } from "./input";
import { useGame } from "./store";
import type { EngineAudio } from "./audio";

const spawn = { x: 0, y: 0.68, z: 0 };
export default function Vehicle({ audio }: { audio: EngineAudio }) {
  const body = useRef<RapierRigidBody>(null);
  const controller = useRef<DynamicRayCastVehicleController | null>(null);
  const wheels = useRef<(Group | null)[]>([]);
  const steeringWheel = useRef<Group>(null);
  const visual = useRef<Group>(null);
  const headlightTarget = useRef(new Object3D());
  const state = useRef(newDriveState());
  const input = useInput();
  const controls = useRef(NEUTRAL);
  const { world } = useRapier();
  const cameraMode = useGame(s => s.camera);
  const gameMode = useGame(s => s.mode);
  const resetId = useGame(s => s.resetId);
  const math = useRef({ pos: new Vector3(), q: new Quaternion(), desired: new Vector3(), target: new Vector3(), look: new Vector3(), initialized: false, lastMode: "", elapsed: 0, frames: 0 });
  useEffect(() => {
    if (!body.current) return;
    body.current.setTranslation(spawn, true);
    body.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    state.current = newDriveState(); input.reverse.current = false;
    controller.current = createVehicle(world, body.current);
    math.current.initialized = false;
    return () => { if (controller.current) world.removeVehicleController(controller.current); controller.current = null; };
  }, [world, resetId, input.reverse]);

  useBeforePhysicsStep(() => {
    if (!controller.current) return;
    if (Math.abs(state.current.speed) < 0.6) {
      if (input.reverse.current) state.current.gear = -1;
      else if (state.current.gear < 0) state.current.gear = 1;
    }
    stepVehicle(controller.current, state.current, controls.current, world.timestep);
  });

  useFrame(({ camera, clock }, delta) => {
    if (!body.current || !visual.current) return;
    controls.current = input.read();
    const game = useGame.getState(), drive = state.current, v = controller.current, m = math.current;
    const dt = Math.min(delta, 0.1);
    // Use the interpolated visual transform, keeping cameras smooth on >60Hz displays.
    visual.current.getWorldPosition(m.pos); visual.current.getWorldQuaternion(m.q);
    for (let i = 0; i < 4; i++) {
      const wheel = wheels.current[i]; if (!wheel) continue;
      const suspension = game.mode === "ready" ? CAR.suspension : (v?.wheelSuspensionLength(i) ?? CAR.suspension);
      wheel.position.set(CAR.wheels[i][0], -suspension, CAR.wheels[i][2]);
      wheel.rotation.y = v?.wheelSteering(i) ?? 0;
      wheel.children[0].rotation.x = -(v?.wheelRotation(i) ?? 0);
    }
    if (steeringWheel.current) steeringWheel.current.rotation.z = -drive.steering * 9;
    if (game.mode === "ready") {
      const angle = clock.elapsedTime * 0.035;
      m.desired.set(6.5 * Math.cos(angle), 2.9, 6.8 + Math.sin(angle) * 1.3).add(m.pos);
      m.target.copy(m.pos).add(new Vector3(-1.3, 0.35, 0));
    } else if (game.camera === "cockpit") {
      const vibration = game.mode === "driving" ? Math.sin(clock.elapsedTime * 47) * Math.min(0.008, Math.abs(drive.speed) * 0.00015) : 0;
      m.desired.set(-0.36, 0.67 + vibration, -0.07 - Math.max(-1, Math.min(1, drive.longitudinalG)) * 0.055).applyQuaternion(m.q).add(m.pos);
      m.target.set(-0.36 - drive.lateralG * 0.04, 0.63, 35).applyQuaternion(m.q).add(m.pos);
    } else {
      m.desired.set(0, 2.7, -6.8 - Math.abs(drive.speed) * 0.025).applyQuaternion(m.q).add(m.pos);
      m.target.set(0, 0.6, 8).applyQuaternion(m.q).add(m.pos);
    }
    const mode = game.mode === "ready" ? "ready" : game.camera;
    const snap = !m.initialized || m.lastMode !== mode;
    camera.position.lerp(m.desired, snap || game.camera === "cockpit" ? 1 : 1 - Math.exp(-dt * 6));
    m.look.lerp(m.target, snap ? 1 : 1 - Math.exp(-dt * 10));
    camera.up.set(0, 1, 0);
    if (game.camera === "cockpit" && game.mode !== "ready") camera.up.applyQuaternion(m.q);
    camera.lookAt(m.look);
    const perspective = camera as PerspectiveCamera;
    const fov = game.mode === "ready" ? 43 : (game.camera === "cockpit" ? 67 : 60) + Math.min(12, Math.abs(drive.speed) * 0.216);
    perspective.fov += (fov - perspective.fov) * (snap ? 1 : 1 - Math.exp(-dt * 4));
    perspective.updateProjectionMatrix();
    m.initialized = true; m.lastMode = mode;
    audio.update(drive.rpm, drive.speed, controls.current.throttle, !game.muted && game.mode === "driving");
    m.elapsed += delta; m.frames++;
    if (m.elapsed >= 0.1) {
      useGame.setState({ telemetry: {
        speed: drive.speed * 3.6, rpm: drive.rpm, gear: drive.gear, slip: drive.slip,
        g: drive.lateralG, suspension: CAR.wheels.map((_, i) => v?.wheelSuspensionLength(i) ?? CAR.suspension),
        grounded: CAR.wheels.filter((_, i) => v?.wheelIsInContact(i)).length,
        fps: Math.round(m.frames / m.elapsed),
      } });
      m.elapsed = 0; m.frames = 0;
    }
    if (m.pos.y < -5 || Math.abs(m.pos.x) > 3900 || Math.abs(m.pos.z) > 3900) game.reset();
  });

  const cockpit = cameraMode === "cockpit" && gameMode !== "ready";
  return <RigidBody ref={body} colliders={false} position={[spawn.x, spawn.y, spawn.z]} canSleep={false} ccd angularDamping={0.3}>
    <CuboidCollider args={[0.82, 0.22, 2]} mass={CAR.mass} friction={0.4} restitution={0.08} />
    <group ref={visual}>
      <CarBody cockpit={cockpit} />
      {CAR.wheels.map((_, i) => <Wheel key={i} ref={node => { wheels.current[i] = node; }} />)}
      <group position={[-0.36, 0.32, 0.46]} rotation={[0.22, 0, 0]}>
        <group ref={steeringWheel}>
          <mesh><torusGeometry args={[0.17, 0.019, 8, 32]} /><meshStandardMaterial color="#252a2d" /></mesh>
          <mesh><boxGeometry args={[0.3, 0.036, 0.025]} /><meshStandardMaterial color="#535a61" metalness={0.7} roughness={0.3} /></mesh>
          <mesh position={[0, -0.07, 0]}><boxGeometry args={[0.035, 0.13, 0.025]} /><meshStandardMaterial color="#535a61" /></mesh>
        </group>
      </group>
      <primitive object={headlightTarget.current} position={[0, -0.4, 55]} />
      {[-0.6, 0.6].map(x => <spotLight key={x} position={[x, 0.12, 2]} target={headlightTarget.current} intensity={75} distance={100} angle={0.36} penumbra={0.7} color="#edf0ff" />)}
    </group>
  </RigidBody>;
}
