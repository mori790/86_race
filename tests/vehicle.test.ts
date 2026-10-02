import assert from "node:assert/strict";
import test from "node:test";
import RAPIER from "@dimforge/rapier3d-compat";
import { CAR, createVehicle, NEUTRAL, newDriveState, stepVehicle, torqueAt, type Controls } from "../src/game/physics";

test("four-wheel vehicle: suspension, acceleration, braking, steering and reverse", async () => {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  world.createCollider(RAPIER.ColliderDesc.cuboid(10000, 0.5, 10000).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.75, 0).setCanSleep(false));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.82, 0.22, 2).setMass(CAR.mass), body);
  const vehicle = createVehicle(world, body);
  const state = newDriveState();
  function run(seconds: number, input: Controls) {
    for (let i = 0; i < seconds * 60; i++) { stepVehicle(vehicle, state, input, 1 / 60); world.step(); }
  }
  run(2, NEUTRAL);
  assert.equal(vehicle.numWheels(), 4);
  for (let i = 0; i < 4; i++) {
    assert.ok(vehicle.wheelIsInContact(i), `wheel ${i} must contact the road`);
    assert.ok(vehicle.wheelSuspensionLength(i)! < CAR.suspension, "spring must compress under weight");
  }
  assert.ok(body.translation().y > 0.3, "chassis must rest above the floor");
  run(50, { ...NEUTRAL, throttle: 1 });
  console.log(`Top speed after 50s: ${(state.speed * 3.6).toFixed(1)} km/h, gear ${state.gear}`);
  assert.ok(state.speed * 3.6 > 195 && state.speed * 3.6 < 235, "must reach around 200 km/h");
  assert.ok(state.gear >= 5, "automatic must upshift");
  assert.equal(vehicle.wheelEngineForce(0), 0, "front wheels must not drive");
  assert.ok(vehicle.wheelEngineForce(2)! > 0, "rear wheels must drive");
  run(8, { ...NEUTRAL, brake: 1 });
  assert.ok(Math.abs(state.speed) < 0.5, "brake must stop without reversing");
  run(4, { ...NEUTRAL, throttle: 0.6 });
  run(1, { ...NEUTRAL, throttle: 0.3, steer: 1 });
  assert.ok(body.angvel().y < -0.03, "right input must turn right from +Z heading");
  assert.ok(Number.isFinite(body.translation().x));
  body.setTranslation({ x: 0, y: 0.75, z: 0 }, true);
  body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  Object.assign(state, newDriveState(), { gear: -1 });
  run(3, { ...NEUTRAL, throttle: 0.5 });
  assert.ok(state.speed < -1, "reverse must travel backward");
  assert.equal(torqueAt(5000), 205);
  assert.ok(torqueAt(8500) === 0);
  world.free();
});
