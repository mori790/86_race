import { useEffect, useMemo, useRef } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { BufferGeometry, CatmullRomCurve3, DataTexture, Float32BufferAttribute, InstancedMesh, Object3D, RepeatWrapping, RGBAFormat, Vector3 } from "three";

export const trackCurve = new CatmullRomCurve3([
  [0, 0, -1000], [0, 0, 0], [0, 0, 1000], [59, 0, 1141], [200, 0, 1200], [341, 0, 1141],
  [400, 0, 1000], [400, 0, 0], [400, 0, -1000], [341, 0, -1141], [200, 0, -1200], [59, 0, -1141],
].map(p => new Vector3(...p)), true, "centripetal");
export const TRACK_LENGTH = trackCurve.getLength();

function asphalt() {
  const pixels = new Uint8Array(128 * 128 * 4);
  let seed = 42;
  for (let i = 0; i < pixels.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 70 + seed % 60;
    pixels.set([value, value + 2, value + 5, 255], i);
  }
  const texture = new DataTexture(pixels, 128, 128, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping; texture.repeat.set(3, TRACK_LENGTH / 4); texture.needsUpdate = true;
  return texture;
}

type Instance = { position: [number, number, number]; rotation?: number; scale: [number, number, number] };
function Boxes({ items, color, emissive = "#000000" }: { items: Instance[]; color: string; emissive?: string }) {
  const ref = useRef<InstancedMesh>(null);
  useEffect(() => {
    const object = new Object3D();
    items.forEach((item, i) => {
      object.position.set(...item.position); object.rotation.set(0, item.rotation ?? 0, 0); object.scale.set(...item.scale);
      object.updateMatrix(); ref.current!.setMatrixAt(i, object.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
    <boxGeometry /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={2} roughness={0.65} />
  </instancedMesh>;
}

export default function Track() {
  const texture = useMemo(asphalt, []);
  const road = useMemo(() => {
    const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 800; i++) {
      const t = i / 800, p = trackCurve.getPointAt(t), tangent = trackCurve.getTangentAt(t);
      const normal = new Vector3(tangent.z, 0, -tangent.x);
      for (const side of [-1, 1]) { const v = p.clone().addScaledVector(normal, side * 6.7); vertices.push(v.x, 0.015, v.z); uv.push((side + 1) / 2, t); }
      if (i < 800) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }, []);
  const { marks, rails, reflectors, poles, lamps } = useMemo(() => {
    const marks: Instance[] = [], rails: Instance[] = [], reflectors: Instance[] = [], poles: Instance[] = [], lamps: Instance[] = [];
    const add = (list: Instance[], t: number, lateral: number, y: number, scale: Instance["scale"]) => {
      const p = trackCurve.getPointAt(t), d = trackCurve.getTangentAt(t);
      list.push({ position: [p.x + d.z * lateral, y, p.z - d.x * lateral], rotation: Math.atan2(d.x, d.z), scale });
    };
    for (let i = 0; i < 700; i++) {
      for (const side of [-1, 1]) {
        add(marks, i / 700, side * 1.75, 0.03, [0.1, 0.014, 3]);
        add(marks, i / 700, side * 5.6, 0.03, [0.14, 0.014, TRACK_LENGTH / 700 + 0.1]);
      }
    }
    for (let i = 0; i < 320; i++) for (const side of [-1, 1]) {
      add(rails, i / 320, side * 7.2, 0.55, [0.23, 1.1, TRACK_LENGTH / 320 + 0.2]);
      add(reflectors, i / 320, side * 7.04, 0.75, [0.04, 0.12, 0.3]);
    }
    for (let i = 0; i < 100; i++) {
      add(poles, i / 100, -8.4, 4, [0.15, 8, 0.15]);
      add(poles, i / 100, -6.7, 7.9, [3.5, 0.1, 0.15]);
      add(lamps, i / 100, -5.5, 7.8, [1.2, 0.06, 0.4]);
    }
    return { marks, rails, reflectors, poles, lamps };
  }, []);
  useEffect(() => () => { texture.dispose(); road.dispose(); }, [texture, road]);
  return <group>
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[4000, 0.5, 4000]} position={[0, -0.5, 0]} friction={1} />
      {rails.map((rail, i) => <CuboidCollider key={i} args={[rail.scale[0] / 2, rail.scale[1] / 2, rail.scale[2] / 2]} position={rail.position} rotation={[0, rail.rotation ?? 0, 0]} restitution={0.12} />)}
    </RigidBody>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[8000, 8000]} /><meshStandardMaterial color="#1c2427" roughness={1} /></mesh>
    <mesh geometry={road} receiveShadow><meshStandardMaterial map={texture} color="#60666e" roughness={0.83} side={2} /></mesh>
    <Boxes items={marks} color="#b5b9b4" />
    <Boxes items={rails} color="#7b858a" />
    <Boxes items={reflectors} color="#a6e7c2" emissive="#3f9b75" />
    <Boxes items={poles} color="#434f57" />
    <Boxes items={lamps} color="#ffe1b0" emissive="#ffcf92" />
    {/* A start gantry and braking markers keep the proving ground legible. */}
    <group position={[0, 0, 25]}>
      {[-7, 7].map(x => <mesh key={x} position={[x, 3.5, 0]}><boxGeometry args={[0.25, 7, 0.25]} /><meshStandardMaterial color="#66767a" metalness={0.5} roughness={0.4} /></mesh>)}
      <mesh position={[0, 6.2, 0]}><boxGeometry args={[14.3, 0.65, 0.25]} /><meshStandardMaterial color="#17262b" /></mesh>
      <mesh position={[0, 6.2, -0.15]}><boxGeometry args={[6, 0.045, 0.04]} /><meshStandardMaterial color="#c8ff86" emissive="#9cfd64" emissiveIntensity={3} /></mesh>
      {Array.from({ length: 24 }, (_, i) => <mesh key={i} position={[-5.75 + (i % 12), 0.04, Math.floor(i / 12) * 0.5]}><boxGeometry args={[1, 0.016, 0.5]} /><meshStandardMaterial color={(i + Math.floor(i / 12)) % 2 ? "#dddcd1" : "#171c22"} /></mesh>)}
    </group>
    {[700, 800, 900].map((z, i) => <group key={z} position={[6.4, 0.7, z]}>
      <mesh><boxGeometry args={[0.45, 1.4, 0.15]} /><meshStandardMaterial color="#d4d5cb" /></mesh>
      {Array.from({ length: 3 - i }, (_, j) => <mesh key={j} position={[0, -0.3 + j * 0.3, -0.09]} rotation={[0, 0, 0.3]}><boxGeometry args={[0.38, 0.08, 0.02]} /><meshStandardMaterial color="#1a2329" /></mesh>)}
    </group>)}
  </group>;
}
