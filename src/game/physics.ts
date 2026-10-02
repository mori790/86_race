import type { DynamicRayCastVehicleController, RigidBody, World } from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";

// SI units. These are calibration values, not a validated GT86 vehicle model.
export const CAR = {
  mass: 1250, radius: 0.315, suspension: 0.32, stiffness: 38,
  compression: 4.4, relaxation: 5.2, grip: 1.55, finalDrive: 4.1,
  gears: [3.626, 2.188, 1.541, 1.213, 1, 0.767],
  wheels: [[-0.77, 0, 1.28], [0.77, 0, 1.28], [-0.77, 0, -1.29], [0.77, 0, -1.29]],
};
export type Controls = { throttle: number; brake: number; steer: number; handbrake: boolean };
export const NEUTRAL: Controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
export type DriveState = {
  gear: number; rpm: number; steering: number; shiftTime: number; speed: number;
  slip: number; longitudinalG: number; lateralG: number; previousSpeed: number;
};
export const newDriveState = (): DriveState => ({
  gear: 1, rpm: 900, steering: 0, shiftTime: 0, speed: 0,
  slip: 0, longitudinalG: 0, lateralG: 0, previousSpeed: 0,
});

export function torqueAt(rpm: number) {
  const curve = [120, 160, 180, 195, 205, 195, 175, 0];
  const position = Math.max(0, Math.min(7, rpm / 1000 - 1));
  const index = Math.min(6, Math.floor(position));
  return curve[index] + (curve[index + 1] - curve[index]) * (position - index);
}

export function createVehicle(world: World, body: RigidBody) {
  const vehicle = world.createVehicleController(body);
  vehicle.indexUpAxis = 1;
  vehicle.setIndexForwardAxis = 2;
  for (const [x, y, z] of CAR.wheels) {
    vehicle.addWheel({ x, y, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, CAR.suspension, CAR.radius);
  }
  for (let i = 0; i < 4; i++) {
    vehicle.setWheelSuspensionStiffness(i, CAR.stiffness);
    vehicle.setWheelSuspensionCompression(i, CAR.compression);
    vehicle.setWheelSuspensionRelaxation(i, CAR.relaxation);
    vehicle.setWheelMaxSuspensionTravel(i, 0.2);
    vehicle.setWheelMaxSuspensionForce(i, 13000);
    vehicle.setWheelFrictionSlip(i, CAR.grip);
    vehicle.setWheelSideFrictionStiffness(i, 1);
  }
  return vehicle;
}

const q = new Quaternion();
const local = new Vector3();
const drag = new Vector3();

export function stepVehicle(vehicle: DynamicRayCastVehicleController, state: DriveState, input: Controls, dt: number) {
  const body = vehicle.chassis();
  q.copy(body.rotation());
  local.copy(body.linvel()).applyQuaternion(q.clone().invert());
  const speed = local.z;
  const magnitude = Math.abs(speed);
  state.speed = speed;
  state.longitudinalG += ((speed - state.previousSpeed) / dt / 9.81 - state.longitudinalG) * 0.12;
  state.previousSpeed = speed;
  state.lateralG += ((body.angvel().y * speed) / 9.81 - state.lateralG) * 0.12;
  state.slip = Math.atan2(Math.abs(local.x), Math.max(3, magnitude));
  const wheelRpm = magnitude / (2 * Math.PI * CAR.radius) * 60;
  state.shiftTime = Math.max(0, state.shiftTime - dt);
  if (state.gear > 0 && state.shiftTime === 0) {
    const rpm = wheelRpm * CAR.gears[state.gear - 1] * CAR.finalDrive;
    if (rpm > 7100 && state.gear < 6) { state.gear++; state.shiftTime = 0.22; }
    else if (rpm < 2800 && state.gear > 1) { state.gear--; state.shiftTime = 0.22; }
  }
  const ratio = state.gear < 0 ? -3.437 : CAR.gears[state.gear - 1];
  const targetRpm = Math.max(900 + input.throttle * 1500, wheelRpm * Math.abs(ratio) * CAR.finalDrive);
  state.rpm += (Math.min(7600, targetRpm) - state.rpm) * Math.min(1, dt * 12);
  const maxSteer = 0.48 / (1 + magnitude * 0.075);
  const steeringTarget = -input.steer * maxSteer;
  state.steering += (steeringTarget - state.steering) * Math.min(1, dt * 5);
  const engineForce = state.rpm < 7550 && state.shiftTime === 0
    ? torqueAt(state.rpm) * ratio * CAR.finalDrive * 0.87 / CAR.radius * input.throttle : 0;
  // Rapier's friction-limited raycast tires approximate combined slip. Replace with
  // a measured tire curve only when tuning against real telemetry (ponytail).
  for (let i = 0; i < 4; i++) {
    const rear = i >= 2;
    vehicle.setWheelSteering(i, rear ? 0 : state.steering);
    vehicle.setWheelEngineForce(i, rear ? engineForce / 2 : 0);
    vehicle.setWheelBrake(i, input.brake * (rear ? 40 : 65) + (rear && input.handbrake ? 140 : 0));
    vehicle.setWheelFrictionSlip(i, CAR.grip * (rear && input.handbrake ? 0.38 : 1));
    vehicle.setWheelSideFrictionStiffness(i, rear ? (input.handbrake ? 0.25 : 0.95) : 1);
  }
  // Aerodynamic drag + rolling resistance + closed-throttle engine braking.
  const resistance = 0.39 * magnitude * magnitude + 145 + (1 - input.throttle) * 85;
  const impulse = Math.min(resistance * dt, magnitude * CAR.mass);
  drag.set(0, 0, -Math.sign(speed) * impulse).applyQuaternion(q);
  body.applyImpulse(drag, true);
  vehicle.updateVehicle(dt, undefined, undefined, collider => collider.parent()?.handle !== body.handle);
}
