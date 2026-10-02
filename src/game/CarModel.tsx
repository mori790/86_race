import { forwardRef, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute, type Group } from "three";
import { CAR } from "./physics";

function shell(sections: number[][]) {
  const vertices: number[] = [], indices: number[] = [];
  for (const [z, width, bottom, top] of sections) {
    vertices.push(-width * 0.86, bottom, z, -width, bottom + 0.12, z,
      -width, top - 0.08, z, -width * 0.82, top, z,
      width * 0.82, top, z, width, top - 0.08, z,
      width, bottom + 0.12, z, width * 0.86, bottom, z);
  }
  for (let s = 0; s < sections.length - 1; s++) for (let v = 0; v < 8; v++) {
    const a = s * 8 + v, b = s * 8 + (v + 1) % 8;
    indices.push(a, b, a + 8, b, b + 8, a + 8);
  }
  for (let v = 1; v < 7; v++) {
    indices.push(0, v + 1, v);
    const end = (sections.length - 1) * 8;
    indices.push(end, end + v, end + v + 1);
  }
  const geometry = new BufferGeometry();
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export const Wheel = forwardRef<Group>(function Wheel(_, ref) {
  return <group ref={ref}>
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow><cylinderGeometry args={[CAR.radius, CAR.radius, 0.22, 24]} /><meshStandardMaterial color="#141518" roughness={0.92} /></mesh>
      <mesh><cylinderGeometry args={[0.235, 0.235, 0.232, 20]} /><meshStandardMaterial color="#252a31" metalness={0.85} roughness={0.28} /></mesh>
      <mesh><cylinderGeometry args={[0.08, 0.08, 0.25, 12]} /><meshStandardMaterial color="#b3bac1" metalness={0.8} roughness={0.23} /></mesh>
      {Array.from({ length: 5 }, (_, i) => <group key={i} rotation={[0, i * Math.PI * 2 / 5, 0]}>
        <mesh position={[0.11, 0, 0]}><boxGeometry args={[0.21, 0.242, 0.035]} /><meshStandardMaterial color="#a7adb4" metalness={0.8} roughness={0.2} /></mesh>
      </group>)}
    </group>
  </group>;
});

export function CarBody({ cockpit = false }: { cockpit?: boolean }) {
  const body = useMemo(() => shell([
    [-2.1, 0.75, -0.16, 0.24], [-1.65, 0.89, -0.22, 0.38],
    [-0.8, 0.88, -0.23, 0.37], [0.55, 0.85, -0.23, 0.29],
    [1.45, 0.89, -0.2, 0.24], [2.1, 0.77, -0.1, 0.08],
  ]), []);
  const cabin = useMemo(() => shell([
    [-1.38, 0.69, 0.25, 0.38], [-0.68, 0.64, 0.31, 0.88],
    [0.3, 0.63, 0.28, 0.88], [1.04, 0.72, 0.23, 0.31],
  ]), []);
  return <group>
    <group visible={!cockpit}>
      <mesh geometry={body} castShadow receiveShadow><meshPhysicalMaterial color="#d9dcda" metalness={0.72} roughness={0.24} clearcoat={1} side={2} /></mesh>
      <mesh geometry={cabin} castShadow><meshPhysicalMaterial color="#071016" metalness={0.05} roughness={0.22} clearcoat={0.2} envMapIntensity={0.3} /></mesh>
      <mesh position={[-0.01, 0.885, -0.2]}><boxGeometry args={[1.05, 0.04, 1.02]} /><meshPhysicalMaterial color="#deded8" metalness={0.7} roughness={0.22} clearcoat={1} /></mesh>
      {[-1, 1].map(side => <group key={side}>
        <mesh position={[side * 0.88, 0.42, 0.48]} rotation={[0, side * -0.2, 0]}><boxGeometry args={[0.22, 0.11, 0.28]} /><meshStandardMaterial color="#d6d6cc" metalness={0.8} roughness={0.22} /></mesh>
        <mesh position={[side * 0.85, 0.08, -0.55]}><boxGeometry args={[0.027, 0.025, 0.17]} /><meshStandardMaterial color="#373f43" /></mesh>
        <mesh position={[side * 0.85, -0.19, 0]}><boxGeometry args={[0.08, 0.07, 2.45]} /><meshStandardMaterial color="#171b20" /></mesh>
        <mesh position={[side * 0.54, 0.17, 1.96]} rotation={[0, side * -0.2, -side * 0.12]}><boxGeometry args={[0.46, 0.065, 0.09]} /><meshStandardMaterial color="#e8f2ff" emissive="#d5e8ff" emissiveIntensity={4} /></mesh>
        <mesh position={[side * 0.57, 0.23, -2.02]}><boxGeometry args={[0.37, 0.06, 0.075]} /><meshStandardMaterial color="#ff3238" emissive="#ff1028" emissiveIntensity={3} /></mesh>
        <mesh position={[side * 0.64, -0.18, -2.09]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.068, 0.068, 0.22, 16]} /><meshStandardMaterial color="#6c7378" metalness={1} roughness={0.2} /></mesh>
      </group>)}
      <mesh position={[0, -0.025, 2.075]}><boxGeometry args={[1.1, 0.19, 0.05]} /><meshStandardMaterial color="#090e13" /></mesh>
      <mesh position={[0, 0.055, -2.115]}><boxGeometry args={[0.39, 0.15, 0.03]} /><meshStandardMaterial color="#e6e5d7" /></mesh>
      <mesh position={[0, 0.28, -1.97]} rotation={[-0.05, 0, 0]}><boxGeometry args={[1.53, 0.055, 0.17]} /><meshStandardMaterial color="#d6d9d4" metalness={0.7} roughness={0.2} /></mesh>
    </group>
    {/* Cockpit geometry remains visible from the driver seat. */}
    <mesh position={[0, 0.21, 0.73]}><boxGeometry args={[1.44, 0.24, 0.4]} /><meshStandardMaterial color="#10141b" roughness={0.9} /></mesh>
    <mesh position={[0, -0.01, 0]}><boxGeometry args={[0.22, 0.3, 1.4]} /><meshStandardMaterial color="#20242b" /></mesh>
    {[-0.39, 0.39].map(x => <group key={x} position={[x, 0, -0.5]}>
      <mesh position={[0, 0.22, -0.17]} rotation={[-0.16, 0, 0]}><boxGeometry args={[0.43, 0.65, 0.16]} /><meshStandardMaterial color="#161c24" /></mesh>
      <mesh position={[0, -0.03, 0.1]}><boxGeometry args={[0.43, 0.12, 0.6]} /><meshStandardMaterial color="#161c24" /></mesh>
    </group>)}
  </group>;
}
