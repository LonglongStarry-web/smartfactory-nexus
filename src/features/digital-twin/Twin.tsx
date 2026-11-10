import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { Suspense, useRef, useEffect, Component, type ReactNode } from "react";
import * as THREE from "three";
import { useFactory } from "../../store/useFactory";
import { statusText } from "../../simulation/engine";
import type { Device } from "../../domain/types";
import FactoryWorld, { vehiclePose, type SceneView } from "./FactoryWorld";
const color = {
  running: "#34D399",
  idle: "#8192a6",
  fault: "#FB7185",
  maintenance: "#FBBF24",
};
function Rig({
  preset,
  focus,
  view,
}: {
  preset: number;
  focus: boolean;
  view: SceneView;
}) {
  const reducedMotion = useFactory((s) => s.preferences.reducedMotion);
  const controls = useRef<any>(null);
  const { camera } = useThree();
  const selected = useFactory((s) => s.selected);
  const devices = useFactory((s) => s.s.devices);
  const target = useRef(new THREE.Vector3());
  const destination = useRef(new THREE.Vector3(12, 9, 13));
  const moving = useRef(false);
  useEffect(() => {
    const d = devices.find((d) => d.id === (view.deviceId ?? selected))!;
    target.current.set(
      ...((focus || view.cutaway
        ? [d.position[0], 1.3, d.position[2]]
        : [1.2, 1, 0]) as [number, number, number]),
    );
    destination.current.set(
      ...((view.cutaway
        ? [d.position[0] + 3.4, 2.9, d.position[2] + 1.3]
        : focus
          ? d.kind === "qc"
            ? [d.position[0] + 4.5, 4.5, d.position[2] - 5.5]
            : [d.position[0] + 5, 6, d.position[2] + 7]
          : preset % 3 === 1
            ? [0, 22, 0.1]
            : preset % 3 === 2
              ? [0, 6, 21]
              : [12, 9, 13]) as [number, number, number]),
    );
    if (reducedMotion) {
      camera.position.copy(destination.current);
      controls.current?.target.copy(target.current);
      controls.current?.update();
      moving.current = false;
    } else moving.current = true;
  }, [selected, preset, focus, reducedMotion, view.deviceId, view.cutaway]);
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
      minDistance={view.cutaway ? 1.2 : 4}
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
      const pos =
        d.kind === "agv"
          ? vehiclePose(d.id, useFactory.getState().s)
          : d.position;
      const v = new THREE.Vector3(
        pos[0],
        d.kind === "warehouse" ? 4.2 : d.kind === "agv" ? 1.2 : 3.5,
        pos[2],
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
  view = {},
}: {
  labels?: boolean;
  low?: boolean;
  preset?: number;
  focus?: boolean;
  view?: SceneView;
}) {
  const devices = useFactory((s) => s.s.devices);
  const select = useFactory((s) => s.select);
  const selected = useFactory((s) => s.selected);
  const root = useRef<HTMLDivElement>(null);
  const elements = useRef<Record<string, HTMLButtonElement | null>>({});
  return (
    <div className="twin-root" ref={root}>
      <SceneBoundary>
        <Suspense fallback={<div className="empty">正在建立三维车间…</div>}>
          <Canvas
            shadows={!low}
            dpr={low ? 1 : [1, 1.6]}
            camera={{ position: [12, 9, 13], fov: 42 }}
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
            <FactoryWorld view={view} root={root} />
            <Rig preset={preset} focus={focus} view={view} />
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
