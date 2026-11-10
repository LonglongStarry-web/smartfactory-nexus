import type { Device } from "../../domain/types";
const mounts: Record<
  Device["kind"],
  { at: [number, number, number]; stem: number }
> = {
  cnc: { at: [0.88, 2.78, -0.65], stem: 0.26 },
  robot: { at: [1.05, 0.65, -0.9], stem: 0.32 },
  qc: { at: [0.72, 2.375, 0.5], stem: 0.25 },
  warehouse: { at: [-1.4, 3.7, 0.6], stem: 0.34 },
  agv: { at: [0.43, 0.62, -0.25], stem: 0.035 },
};
const colors = {
  running: "#34D399",
  idle: "#8192a6",
  fault: "#FB7185",
  maintenance: "#FBBF24",
};
export default function StatusLamp({ device }: { device: Device }) {
  const { at, stem } = mounts[device.kind];
  const tint = colors[device.status];
  const small = device.kind === "agv";
  const radius = small ? 0.06 : 0.09;
  return (
    <group position={at} name={`status-lamp-${device.id}`}>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.2, radius * 1.35, 0.05, 16]} />
        <meshStandardMaterial color="#34495b" metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.04 + stem / 2, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.04, stem, 12]} />
        <meshStandardMaterial color="#40586b" metalness={0.65} />
      </mesh>
      <mesh
        position={[0, 0.04 + stem + 0.07, 0]}
        name={`status-lens-${device.id}`}
      >
        <cylinderGeometry args={[radius, radius, 0.14, 16]} />
        <meshStandardMaterial
          color={tint}
          emissive={tint}
          emissiveIntensity={0.45}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 0.04 + stem + 0.145, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.02, 16]} />
        <meshStandardMaterial color="#52687a" />
      </mesh>
    </group>
  );
}
