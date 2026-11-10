import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { Suspense, useRef, useEffect, Component, type ReactNode } from "react";
import * as THREE from "three";
import { useFactory } from "../../store/useFactory";
import { statusText } from "../../simulation/engine";
import type { Device } from "../../domain/types";
import StatusLamp from "./StatusLamp";
import { accents } from "../../app/preferences";
const color = {
  running: "#34D399",
  idle: "#8192a6",
  fault: "#FB7185",
  maintenance: "#FBBF24",
};
function Box({
  p = [0, 0, 0],
  s = [1, 1, 1],
  c = "#bcc9d1",
  ...props
}: {
  p?: number[];
  s?: number[];
  c?: string;
  [k: string]: any;
}) {
  return (
    <mesh position={p as any} castShadow receiveShadow {...props}>
      <boxGeometry args={s as any} />
      <meshStandardMaterial color={c} roughness={0.65} metalness={0.28} />
    </mesh>
  );
}
function Cylinder({
  p = [0, 0, 0],
  r = 0.2,
  h = 0.5,
  c = "#c3cdd4",
  rotation = [0, 0, 0],
}: {
  p?: number[];
  r?: number;
  h?: number;
  c?: string;
  rotation?: number[];
}) {
  return (
    <mesh position={p as any} rotation={rotation as any} castShadow>
      <cylinderGeometry args={[r, r, h, 16]} />
      <meshStandardMaterial color={c} metalness={0.45} roughness={0.45} />
    </mesh>
  );
}
function Robot({ active, clock }: { active: boolean; clock: number }) {
  const joint = useRef<THREE.Group>(null);
  useFrame(() => {
    if (joint.current && active)
      joint.current.rotation.y = Math.sin(clock * 0.07) * 0.7;
  });
  return (
    <>
      <Cylinder p={[0, 0.25, 0]} r={0.55} h={0.5} c="#455c70" />
      <Cylinder p={[0, 0.65, 0]} r={0.33} h={0.45} c="#eea544" />
      <group ref={joint}>
        <Cylinder
          p={[0, 0.95, 0]}
          r={0.28}
          h={0.3}
          c="#55687b"
          rotation={[0, 0, Math.PI / 2]}
        />
        <group
          position={[0, 1, 0]}
          rotation={[0, 0, -0.45 + Math.sin(clock * 0.07) * 0.12]}
        >
          <Box p={[0, 0.62, 0]} s={[0.36, 1.25, 0.4]} c="#eda43f" />
          <Cylinder
            p={[0, 1.25, 0]}
            r={0.26}
            h={0.48}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <group position={[0, 1.25, 0]} rotation={[0, 0, -1.1]}>
            <Box p={[0, 0.55, 0]} s={[0.28, 1.1, 0.3]} c="#ecad52" />
            <Cylinder p={[0, 1.15, 0]} r={0.17} h={0.3} />
            <Box p={[-0.13, 1.4, 0]} s={[0.08, 0.35, 0.16]} c="#344758" />
            <Box p={[0.13, 1.4, 0]} s={[0.08, 0.35, 0.16]} c="#344758" />
          </group>
        </group>
      </group>
    </>
  );
}
function CNC() {
  return (
    <>
      <Box p={[0, 0.18, 0]} s={[2.4, 0.36, 2.25]} c="#35495d" />
      <Box p={[-0.95, 1.4, 0]} s={[0.48, 2.5, 2.2]} />
      <Box p={[0.95, 1.4, 0]} s={[0.48, 2.5, 2.2]} />
      <Box p={[0, 2.45, 0]} s={[2.4, 0.45, 2.2]} />
      <Box p={[0, 1.4, 0.9]} s={[1.4, 1.65, 0.12]} c="#203c49" />
      <Box p={[0, 1.4, 1]} s={[0.06, 1.65, 0.08]} c="#a6b9c5" />
      <Box p={[-0.26, 1.5, 1.08]} s={[0.08, 0.42, 0.08]} c="#c6d4de" />
      <Box p={[0.25, 1.5, 1.08]} s={[0.08, 0.42, 0.08]} c="#c6d4de" />
      <Box p={[1.48, 1.6, 0.5]} s={[0.6, 0.85, 0.32]} c="#354b60" />
      <Box p={[1.48, 1.7, 0.68]} s={[0.43, 0.4, 0.03]} c="#40868b" />
      <Box p={[0, 0.45, 1.2]} s={[2.4, 0.2, 0.2]} c="#22a9b9" />
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          p={[-0.7 + i * 0.7, 0.7, -1.14]}
          s={[0.4, 0.1, 0.03]}
          c="#64798e"
        />
      ))}
    </>
  );
}
function Warehouse() {
  return (
    <>
      {[-1.4, 0, 1.4].map((x) => (
        <Box key={x} p={[x, 1.85, 0]} s={[0.12, 3.7, 1.6]} c="#4d718a" />
      ))}
      {[0.3, 1.4, 2.5, 3.6].map((y) => (
        <group key={y}>
          <Box p={[0, y, 0]} s={[3, 0.12, 1.7]} c="#50687b" />
          {[-0.7, 0.7].map((x) => (
            <group key={x}>
              <Box p={[x, y + 0.4, 0]} s={[1, 0.7, 1.2]} c="#b7996b" />
              <Box p={[x, y + 0.4, 0.61]} s={[0.35, 0.25, 0.01]} c="#dfd9bc" />
            </group>
          ))}
        </group>
      ))}
    </>
  );
}
function QC() {
  return (
    <>
      <Box p={[0, 0.5, 0]} s={[1.9, 1, 1.6]} c="#b3c2cb" />
      <Box p={[0, 1.04, 0]} s={[2, 0.1, 1.8]} c="#364a5d" />
      {[-0.8, 0.8].map((x) => (
        <Box key={x} p={[x, 1.7, 0]} s={[0.12, 1.3, 1.3]} c="#607b90" />
      ))}
      <Box p={[0, 2.3, 0]} s={[1.8, 0.15, 1.4]} c="#6e8998" />
      <Cylinder p={[0, 2.08, 0]} r={0.14} h={0.3} c="#22D3EE" />
      <Box p={[0, 1.15, 0]} s={[0.6, 0.12, 0.6]} c="#d1bb7d" />
    </>
  );
}
function AGV() {
  return (
    <>
      <Box p={[0, 0.3, 0]} s={[1.2, 0.42, 0.85]} c="#d9b95b" />
      <Box p={[0, 0.56, 0]} s={[1.1, 0.12, 0.78]} c="#52616b" />
      {[-0.42, 0.42].flatMap((x) =>
        [-0.37, 0.37].map((z) => (
          <Cylinder
            key={`${x}${z}`}
            p={[x, 0.18, z]}
            r={0.18}
            h={0.12}
            rotation={[Math.PI / 2, 0, 0]}
            c="#202d3b"
          />
        )),
      )}
      <Box p={[0, 0.73, 0]} s={[0.65, 0.25, 0.5]} c="#a2b5c1" />
      <Box p={[0.6, 0.3, 0]} s={[0.03, 0.12, 0.5]} c="#22D3EE" />
    </>
  );
}
function Station({ d, labels }: { d: Device; labels: boolean }) {
  const selected = useFactory((s) => s.selected);
  const accent = useFactory((s) => s.accent);
  const select = useFactory((s) => s.select);
  const time = useFactory((s) => s.s.time);
  const running = useFactory((s) => s.s.running);
  const ref = useRef<THREE.Group>(null);
  const active = running && d.status === "running";
  useFrame(() => {
    if (ref.current && d.kind === "agv" && active) {
      ref.current.position.x = d.position[0] + Math.sin(d.runtime * 0.035) * 5;
      ref.current.position.z = d.position[2];
    }
  });
  return (
    <group
      ref={ref}
      position={d.position}
      onClick={(e) => {
        e.stopPropagation();
        select(d.id);
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <Box
        p={[0, 0.025, 0]}
        s={
          d.kind === "warehouse"
            ? [3.5, 0.05, 2.3]
            : d.kind === "agv"
              ? [1.5, 0.04, 1.2]
              : [3.1, 0.05, 3]
        }
        c={
          selected === d.id
            ? new THREE.Color(accents[accent].dark)
                .multiplyScalar(0.38)
                .getStyle()
            : "#344558"
        }
      />
      {d.kind === "cnc" ? (
        <CNC />
      ) : d.kind === "robot" ? (
        <Robot active={active} clock={d.runtime} />
      ) : d.kind === "warehouse" ? (
        <Warehouse />
      ) : d.kind === "qc" ? (
        <QC />
      ) : (
        <AGV />
      )}
      {d.kind === "robot" && (
        <>
          <Box p={[1.05, 0.35, -0.9]} s={[0.42, 0.6, 0.46]} c="#52687a" />
          <Box p={[1.05, 0.39, -0.66]} s={[0.27, 0.2, 0.025]} c="#203c49" />
        </>
      )}
      <StatusLamp device={d} />
    </group>
  );
}
function Conveyor({ z }: { z: number }) {
  const time = useFactory((s) => s.s.time);
  const ds = useFactory((s) => s.s.devices);
  const conveyorClock =
    ds.find((d) => d.kind === "cnc" && d.line === (z < 0 ? "A" : "B"))
      ?.runtime || 0;
  return (
    <group position={[0, 0, z]}>
      <Box p={[0, 0.65, 0]} s={[7, 0.18, 0.8]} c="#26384b" />
      {[-3, -1, 1, 3].map((x) => (
        <Box key={x} p={[x, 0.3, 0]} s={[0.12, 0.6, 0.65]} c="#62778b" />
      ))}
      {Array.from({ length: 22 }, (_, i) => (
        <Cylinder
          key={i}
          p={[-3.2 + i * 0.3, 0.76, 0]}
          r={0.06}
          h={0.7}
          rotation={[Math.PI / 2, 0, 0]}
          c="#8b9da8"
        />
      ))}
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          p={[((conveyorClock * 0.08 + i * 2.1) % 6.2) - 3.1, 0.9, 0]}
          s={[0.4, 0.2, 0.4]}
          c="#d6bd7b"
        />
      ))}
    </group>
  );
}
function Rig({ preset, focus }: { preset: number; focus: boolean }) {
  const reducedMotion = useFactory((s) => s.preferences.reducedMotion);
  const controls = useRef<any>(null);
  const { camera } = useThree();
  const selected = useFactory((s) => s.selected);
  const devices = useFactory((s) => s.s.devices);
  const target = useRef(new THREE.Vector3());
  const destination = useRef(new THREE.Vector3(15, 13, 18));
  const moving = useRef(false);
  useEffect(() => {
    const d = devices.find((d) => d.id === selected)!;
    target.current.set(
      ...((focus ? [d.position[0], 1, d.position[2]] : [0, 0, 0]) as [
        number,
        number,
        number,
      ]),
    );
    destination.current.set(
      ...((focus
        ? d.kind === "qc"
          ? [d.position[0] + 4.5, 4.5, d.position[2] - 5.5]
          : [d.position[0] + 5, 6, d.position[2] + 7]
        : preset % 3 === 1
          ? [0, 22, 0.1]
          : preset % 3 === 2
            ? [0, 6, 21]
            : [15, 13, 18]) as [number, number, number]),
    );
    if (reducedMotion) {
      camera.position.copy(destination.current);
      controls.current?.target.copy(target.current);
      controls.current?.update();
      moving.current = false;
    } else moving.current = true;
  }, [selected, preset, focus, reducedMotion]);
  useFrame((_, dt) => {
    if (moving.current && controls.current) {
      camera.position.lerp(destination.current, Math.min(1, dt * 4));
      controls.current.target.lerp(target.current, Math.min(1, dt * 4));
      controls.current.update();
      if (camera.position.distanceTo(destination.current) < 0.02)
        moving.current = false;
    }
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      minDistance={4}
      maxDistance={38}
      maxPolarAngle={Math.PI / 2.05}
      onStart={() => (moving.current = false)}
    />
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="empty">
        三维渲染失败，请启用 WebGL 或刷新后重试。业务页面仍可使用。
      </div>
    ) : (
      this.props.children
    );
  }
}
function WorldLabels({
  elements,
  devices,
}: {
  elements: React.RefObject<Record<string, HTMLButtonElement | null>>;
  devices: Device[];
}) {
  const { camera, size } = useThree();
  useFrame(() => {
    for (const d of devices) {
      const el = elements.current[d.id];
      if (!el) continue;
      const x =
        d.kind === "agv"
          ? d.position[0] + Math.sin(d.runtime * 0.035) * 5
          : d.position[0];
      const v = new THREE.Vector3(
        x,
        d.kind === "warehouse" ? 4.2 : d.kind === "agv" ? 1.2 : 3.5,
        d.position[2],
      ).project(camera);
      el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) * size.width) / 2}px,${((-v.y + 1) * size.height) / 2}px)`;
      el.style.visibility = v.z > 1 ? "hidden" : "visible";
    }
  });
  return null;
}
export default function Twin({
  labels = true,
  low = false,
  preset = 0,
  focus = false,
}: {
  labels?: boolean;
  low?: boolean;
  preset?: number;
  focus?: boolean;
}) {
  const devices = useFactory((s) => s.s.devices);
  const select = useFactory((s) => s.select);
  const selected = useFactory((s) => s.selected);
  const elements = useRef<Record<string, HTMLButtonElement | null>>({});
  return (
    <div className="twin-root">
      <SceneBoundary>
        <Suspense fallback={<div className="empty">正在建立三维车间…</div>}>
          <Canvas
            shadows={!low}
            dpr={low ? 1 : [1, 1.6]}
            camera={{ position: [15, 13, 18], fov: 42 }}
            gl={{ antialias: !low, preserveDrawingBuffer: true }}
          >
            <color attach="background" args={["#101c2b"]} />
            <ambientLight intensity={1.6} />
            <hemisphereLight args={["#dbf2ff", "#475566", 2]} />
            <directionalLight
              position={[5, 14, 8]}
              intensity={3}
              castShadow={!low}
              shadow-mapSize={[1024, 1024]}
              shadow-camera-left={-15}
              shadow-camera-right={15}
              shadow-camera-top={15}
              shadow-camera-bottom={-15}
            />
            <Box p={[0, -0.18, 0]} s={[21, 0.32, 16]} c="#354759" />
            <gridHelper
              args={[20, 40, "#5b7082", "#42586b"]}
              position={[0, 0.01, 0]}
            />
            {[-4.5, 0.5, 5.5].map((z) => (
              <Box key={z} p={[-1, 0.02, z]} s={[16, 0.02, 0.06]} c="#d2b25c" />
            ))}
            {[-2, 3].map((z) => (
              <group key={z}>
                <Box
                  p={[-1, 0.025, z + 1.7]}
                  s={[15, 0.01, 0.035]}
                  c="#22b6c3"
                />
                <Conveyor z={z + 1} />
              </group>
            ))}
            {devices.map((d) => (
              <Station key={d.id} d={d} labels={labels} />
            ))}
            <Rig preset={preset} focus={focus} />
            {labels && <WorldLabels elements={elements} devices={devices} />}
            {!low && (
              <ContactShadows
                position={[0, 0.012, 0]}
                opacity={0.25}
                scale={30}
                blur={2}
                far={6}
                resolution={256}
              />
            )}
          </Canvas>
        </Suspense>
      </SceneBoundary>
      {labels && (
        <div className="twin-labels">
          {devices.map((d) => (
            <button
              ref={(el) => {
                elements.current[d.id] = el;
              }}
              key={d.id}
              className={`device-label ${selected === d.id ? "chosen" : ""}`}
              onClick={() => select(d.id)}
            >
              <i style={{ background: color[d.status] }} />
              {d.id}
              <span>{statusText[d.status]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
