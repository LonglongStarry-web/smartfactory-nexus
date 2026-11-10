import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Device } from "../../domain/types";
import type { Vec3 } from "../../domain/layout";
import { cellAnchors, factoryLayout } from "../../domain/layout";
import type { MotionPose } from "./motion";
import { solveArm } from "./motion";
import StatusLamp from "./StatusLamp";

export function Block({
  p = [0, 0, 0],
  size = [1, 1, 1],
  color = "#b7c7ce",
  opacity = 1,
  ...rest
}: {
  p?: number[];
  size?: number[];
  color?: string;
  opacity?: number;
  [key: string]: any;
}) {
  return (
    <mesh
      position={p as Vec3}
      castShadow={opacity === 1}
      receiveShadow
      {...rest}
    >
      <boxGeometry args={size as Vec3} />
      <meshStandardMaterial
        color={color}
        metalness={0.35}
        roughness={0.58}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
      />
    </mesh>
  );
}
export function Round({
  p = [0, 0, 0],
  radius = 0.2,
  height = 0.4,
  color = "#60788b",
  rotation = [0, 0, 0],
  ...rest
}: {
  p?: number[];
  radius?: number;
  height?: number;
  color?: string;
  rotation?: number[];
  [key: string]: any;
}) {
  return (
    <mesh position={p as Vec3} rotation={rotation as Vec3} castShadow {...rest}>
      <cylinderGeometry args={[radius, radius, height, 20]} />
      <meshStandardMaterial color={color} metalness={0.55} roughness={0.4} />
    </mesh>
  );
}

export function Part({
  pose,
  color = "#d1ba77",
  holes = 0,
  deburred = false,
  position,
  onClick,
  profile = "flange",
}: {
  pose?: MutableRefObject<MotionPose>;
  color?: string;
  holes?: number;
  deburred?: boolean;
  position?: Vec3;
  onClick?: () => void;
  profile?: "flange" | "plate";
}) {
  const ref = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    if (profile === "plate") {
      shape.moveTo(-0.24, -0.18);
      shape.lineTo(0.24, -0.18);
      shape.lineTo(0.24, 0.18);
      shape.lineTo(-0.24, 0.18);
      shape.closePath();
    } else shape.absarc(0, 0, 0.24, 0, Math.PI * 2, false);
    for (let i = 0; i < holes; i++) {
      const h = new THREE.Path();
      const angle = ((i - 1) * Math.PI) / 2;
      const point =
        profile === "plate"
          ? [
              [0, 0],
              [-0.16, -0.11],
              [0.16, -0.11],
              [0.16, 0.11],
              [-0.16, 0.11],
            ][i]
          : [i ? Math.cos(angle) * 0.16 : 0, i ? Math.sin(angle) * 0.16 : 0];
      h.absarc(point[0], point[1], i ? 0.023 : 0.075, 0, Math.PI * 2, true);
      shape.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.12,
      bevelEnabled: deburred,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.004,
      bevelThickness: 0.004,
      curveSegments: 24,
    });
    g.translate(0, 0, -0.06);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [holes, deburred, profile]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    if (ref.current && pose) {
      const p = pose.current;
      ref.current.position.set(...p.part);
      ref.current.scale.set(p.radius / 0.24, p.height / 0.12, p.radius / 0.24);
    }
  });
  return (
    <mesh
      ref={ref}
      position={position}
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
    >
      <meshStandardMaterial
        color={color}
        metalness={0.65}
        roughness={deburred ? 0.25 : 0.5}
      />
    </mesh>
  );
}

export function RobotModel({
  device,
  pose,
}: {
  device: Device;
  pose: MutableRefObject<MotionPose>;
}) {
  const upper = useRef<THREE.Mesh>(null),
    lower = useRef<THREE.Mesh>(null),
    elbow = useRef<THREE.Mesh>(null),
    wrist = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null),
    right = useRef<THREE.Mesh>(null),
    shoulder = useRef<THREE.Mesh>(null);
  const scratch = useMemo(
    () => ({
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      base: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );
  useFrame(() => {
    const ik = solveArm(device.position, pose.current.tcp);
    scratch.base.set(...device.position);
    const link = (mesh: THREE.Mesh | null, a: Vec3, b: Vec3) => {
      if (!mesh) return;
      scratch.from.set(...a).sub(scratch.base);
      scratch.to.set(...b).sub(scratch.base);
      scratch.dir.subVectors(scratch.to, scratch.from);
      mesh.position.copy(scratch.from).addScaledVector(scratch.dir, 0.5);
      mesh.scale.y = scratch.dir.length();
      mesh.quaternion.setFromUnitVectors(scratch.up, scratch.dir.normalize());
    };
    link(upper.current, ik.shoulder, ik.elbow);
    link(lower.current, ik.elbow, ik.wrist);
    elbow.current?.position.set(
      ik.elbow[0] - device.position[0],
      ik.elbow[1],
      ik.elbow[2] - device.position[2],
    );
    if (shoulder.current) shoulder.current.rotation.y = ik.yaw;
    if (wrist.current) {
      wrist.current.position.set(
        ik.wrist[0] - device.position[0],
        ik.wrist[1],
        ik.wrist[2] - device.position[2],
      );
      wrist.current.rotation.y = pose.current.profile === "plate" ? 0 : ik.yaw;
    }
    if (left.current) left.current.position.x = -pose.current.grip;
    if (right.current) right.current.position.x = pose.current.grip;
  });
  return (
    <group position={device.position} name={`robot-${device.id}`}>
      <Round p={[0, 0.22, 0]} radius={0.49} height={0.44} color="#40586b" />
      <Round p={[0, 0.65, 0]} radius={0.29} height={0.45} color="#e6aa47" />
      <mesh ref={shoulder} position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.25, 20, 16]} />
        <meshStandardMaterial color="#7b919f" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh ref={upper} castShadow>
        <boxGeometry args={[0.27, 1, 0.31]} />
        <meshStandardMaterial color="#df9b39" metalness={0.4} />
      </mesh>
      <mesh ref={elbow} castShadow>
        <sphereGeometry args={[0.21, 20, 16]} />
        <meshStandardMaterial color="#7b919f" metalness={0.6} />
      </mesh>
      <mesh ref={lower} castShadow>
        <boxGeometry args={[0.21, 1, 0.25]} />
        <meshStandardMaterial color="#edb351" metalness={0.4} />
      </mesh>
      <group ref={wrist}>
        <object3D name={`tcp-${device.id}`} position={[0, -0.48, 0]} />
        <Round radius={0.14} height={0.19} color="#6f8798" />
        <Block p={[0, -0.1, 0]} size={[0.95, 0.12, 0.22]} color="#344b5e" />
        <Block p={[0, -0.27, 0]} size={[0.12, 0.2, 0.12]} color="#798f9e" />
        <mesh ref={left} position={[-0.4, -0.34, 0]} castShadow>
          <boxGeometry args={[0.07, 0.42, 0.2]} />
          <meshStandardMaterial color="#718692" metalness={0.8} />
        </mesh>
        <mesh ref={right} position={[0.4, -0.34, 0]} castShadow>
          <boxGeometry args={[0.07, 0.42, 0.2]} />
          <meshStandardMaterial color="#718692" metalness={0.8} />
        </mesh>
      </group>
      <Block p={[1.05, 0.35, -0.9]} size={[0.42, 0.6, 0.46]} color="#52687a" />
      <Block
        p={[1.05, 0.39, -0.66]}
        size={[0.27, 0.2, 0.025]}
        color="#24424a"
      />
      <StatusLamp device={device} />
    </group>
  );
}

export function CNCModel({
  device,
  pose,
  cutaway = false,
  moving = false,
  showPath = false,
}: {
  device: Device;
  pose: MutableRefObject<MotionPose>;
  cutaway?: boolean;
  moving?: boolean;
  showPath?: boolean;
}) {
  const doors = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)],
    jaws = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)],
    tool = useRef<THREE.Group>(null),
    bit = useRef<THREE.Mesh>(null);
  const z = device.position[2];
  const points = useMemo(
    () =>
      Array.from(
        { length: 65 },
        (_, i) =>
          new THREE.Vector3(
            -2.4 + Math.cos((i / 64) * Math.PI * 2) * 0.27,
            1.27,
            z + Math.sin((i / 64) * Math.PI * 2) * 0.27,
          ),
      ),
    [z],
  );
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(points),
    [points],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, dt) => {
    const p = pose.current;
    doors.forEach((door, i) => {
      if (door.current)
        door.current.position.x = (i ? 1 : -1) * (0.38 + 0.82 * p.door);
    });
    jaws.forEach((jaw, i) => {
      if (jaw.current)
        jaw.current.position.x =
          (i ? 1 : -1) *
          ((p.profile === "plate" ? (0.18 * p.radius) / 0.24 : p.radius) +
            0.06 +
            (1 - p.clamp) * 0.18);
    });
    if (tool.current)
      tool.current.position.set(
        -(p.tool[2] - z),
        p.tool[1],
        p.tool[0] - device.position[0],
      );
    if (bit.current && moving && p.spindle)
      bit.current.rotation.y += Math.min(dt, 0.1) * 18;
  });
  return (
    <>
      <group
        position={device.position}
        rotation={[0, Math.PI / 2, 0]}
        name={`cnc-${device.id}`}
      >
        <Block p={[0, 0.2, 0]} size={[2.45, 0.4, 2.2]} color="#354d61" />
        <Block
          p={[-1.05, 1.5, 0]}
          size={[0.35, 2.3, 2.2]}
          opacity={cutaway ? 0.12 : 1}
        />
        <Block
          p={[1.05, 1.5, 0]}
          size={[0.35, 2.3, 2.2]}
          opacity={cutaway ? 0.12 : 1}
        />
        <Block
          p={[0, 2.65, 0]}
          size={[2.45, 0.25, 2.2]}
          opacity={cutaway ? 0.12 : 1}
        />
        <Block
          p={[0, 1.5, -1.04]}
          size={[2.1, 2.2, 0.12]}
          opacity={cutaway ? 0.12 : 1}
        />
        <Block p={[0, 0.72, 0.15]} size={[0.6, 0.46, 0.65]} color="#657d8d" />
        <Block p={[0, 1.01, 0.15]} size={[0.85, 0.12, 0.8]} color="#708b9c" />
        {jaws.map((ref, i) => (
          <mesh
            key={i}
            ref={ref}
            position={[(i ? 1 : -1) * 0.45, 1.18, 0.15]}
            castShadow
          >
            <boxGeometry args={[0.12, 0.22, 0.65]} />
            <meshStandardMaterial
              color="#a3b2b8"
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
        ))}
        {doors.map((ref, i) => (
          <group key={i} ref={ref} position={[(i ? 1 : -1) * 0.38, 1.47, 1.13]}>
            <Block
              size={[0.72, 1.75, 0.08]}
              color="#1d3948"
              opacity={cutaway ? 0.12 : 0.45}
            />
            <Block
              p={[i ? -0.24 : 0.24, 0, 0.07]}
              size={[0.06, 0.42, 0.08]}
              color="#c7d7df"
            />
            <Block p={[0, 0.85, 0]} size={[0.74, 0.05, 0.1]} color="#70818b" />
            <Block p={[0, -0.85, 0]} size={[0.74, 0.05, 0.1]} color="#70818b" />
          </group>
        ))}
        <Block p={[0, 2.42, 1.12]} size={[3.2, 0.09, 0.1]} color="#536c7d" />
        <Block p={[0, 0.57, 1.12]} size={[3.2, 0.09, 0.1]} color="#536c7d" />
        <Block p={[0, 1.75, -0.65]} size={[0.22, 1.4, 0.18]} color="#5e788b" />
        <group ref={tool}>
          <Block p={[0, 0.55, 0]} size={[0.34, 0.3, 0.34]} color="#497385" />
          <Round
            p={[0, 0.28, 0]}
            radius={0.065}
            height={0.44}
            color="#b8c6c9"
          />
          <mesh ref={bit} position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.045, 0.035, 0.12, 12]} />
            <meshStandardMaterial color="#d2dadd" metalness={0.9} />
          </mesh>
        </group>
        <Block
          p={[1.48, 1.55, 0.55]}
          size={[0.55, 0.8, 0.28]}
          color="#405d70"
        />
        <Block
          p={[1.48, 1.64, 0.7]}
          size={[0.39, 0.38, 0.025]}
          color="#3e8d98"
        />
        <StatusLamp device={device} />
      </group>
      {showPath && (
        <lineLoop geometry={geometry}>
          <lineBasicMaterial color="#22d3ee" />
        </lineLoop>
      )}
    </>
  );
}

export function Rollers({
  from,
  to,
  width = 0.72,
}: {
  from: Vec3;
  to: Vec3;
  width?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const count = Math.max(2, Math.ceil(length / 0.18));
  const direction = useMemo(
    () => new THREE.Vector3(to[0] - from[0], 0, to[2] - from[2]).normalize(),
    [...from, ...to],
  );
  useEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(-direction.z, 0, direction.x),
      );
    for (let i = 0; i < count; i++) {
      m.compose(
        new THREE.Vector3(
          from[0] + (direction.x * length * i) / (count - 1),
          from[1],
          from[2] + (direction.z * length * i) / (count - 1),
        ),
        q,
        new THREE.Vector3(1, 1, 1),
      );
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [count, length, direction, width, ...from]);
  const mid: Vec3 = [
    (from[0] + to[0]) / 2,
    from[1] - 0.09,
    (from[2] + to[2]) / 2,
  ];
  return (
    <>
      <Block
        p={mid}
        size={
          Math.abs(direction.x) > 0.5
            ? [length + 0.25, 0.12, width + 0.1]
            : [width + 0.1, 0.12, length + 0.25]
        }
        color="#2c4357"
      />
      <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, width, 12]} />
        <meshStandardMaterial
          color="#829aa7"
          metalness={0.7}
          roughness={0.35}
        />
      </instancedMesh>
    </>
  );
}

export function QCModel({
  device,
  pose,
}: {
  device: Device;
  pose: MutableRefObject<MotionPose> | undefined;
}) {
  const scanner = useRef<THREE.Group>(null),
    pusher = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (scanner.current) {
      const p = pose?.current;
      scanner.current.position.x =
        p?.stage === "inspect" && p.progress > 0.45
          ? 0.25 * Math.sin(((p.progress - 0.45) / 0.55) * Math.PI * 2)
          : 0;
    }
    if (pusher.current && pose) {
      pusher.current.position.set(
        pose.current.part[0] - device.position[0],
        1.14,
        pose.current.part[2],
      );
      pusher.current.visible = pose.current.stage === "sort";
    }
  });
  return (
    <group position={device.position} name="shared-qc">
      <Block p={[0, 0.5, 0]} size={[1.9, 1, 1.5]} />
      <Block p={[0, 1.04, 0]} size={[2, 0.08, 1.7]} color="#456475" />
      {[-0.8, 0.8].map((x) => (
        <Block
          key={x}
          p={[x, 1.7, 0]}
          size={[0.12, 1.3, 1.35]}
          color="#647f90"
        />
      ))}
      <Block p={[0, 2.3, 0]} size={[1.8, 0.15, 1.4]} color="#839ba6" />
      <group ref={scanner}>
        <Round p={[0, 2.02, 0]} radius={0.13} height={0.3} color="#4b97a1" />
        <Block p={[0, 1.85, 0]} size={[0.4, 0.035, 0.035]} color="#62d5ce" />
      </group>
      <mesh ref={pusher} visible={false}>
        <boxGeometry args={[0.08, 0.18, 0.5]} />
        <meshStandardMaterial color="#80a4ae" />
      </mesh>
      <StatusLamp device={device} />
    </group>
  );
}

export function AGVModel({
  device,
  position,
  lift = 0.15,
}: {
  device: Device;
  position?: Vec3;
  lift?: number;
}) {
  return (
    <group position={position ?? device.position} name={`vehicle-${device.id}`}>
      <Block p={[0, 0.31, 0]} size={[1.1, 0.4, 0.82]} color="#d6ad48" />
      <Block p={[0, 0.56, 0]} size={[1.04, 0.12, 0.74]} color="#3e5868" />
      {[-0.37, 0.37].flatMap((x) =>
        [-0.38, 0.38].map((z) => (
          <Round
            key={`${x}-${z}`}
            p={[x, 0.19, z]}
            radius={0.18}
            height={0.1}
            color="#1d2b37"
            rotation={[Math.PI / 2, 0, 0]}
          />
        )),
      )}
      <Round
        p={[0, 0.68 + lift / 2, 0]}
        radius={0.05}
        height={0.12 + lift}
        color="#a7bac4"
      />
      <Block p={[0, 0.68 + lift, 0]} size={[0.7, 0.06, 0.58]} color="#8dabb6" />
      <StatusLamp device={device} />
    </group>
  );
}

export function WarehouseModel({
  device,
  stored = 0,
}: {
  device: Device;
  stored?: number;
}) {
  return (
    <group position={device.position} name="warehouse-rack">
      {[-1.35, 0, 1.35].map((x) => (
        <Block
          key={x}
          p={[x, 1.85, 0]}
          size={[0.12, 3.7, 1.5]}
          color="#4d738a"
        />
      ))}
      {[0.35, 0.9, 1.45, 2, 2.55, 3.1, 3.65].map((y) => (
        <Block key={y} p={[0, y, 0]} size={[2.8, 0.09, 1.6]} color="#526f83" />
      ))}
      {Array.from({ length: Math.min(12, Math.ceil(stored / 40)) }, (_, i) => (
        <group
          key={i}
          position={[i % 2 ? 0.66 : -0.66, 0.6 + Math.floor(i / 2) * 0.55, 0]}
        >
          <Block size={[1, 0.38, 1.12]} color="#b79866" />
          <Block p={[0, 0, 0.57]} size={[0.32, 0.16, 0.01]} color="#e2dfbf" />
        </group>
      ))}
      <StatusLamp device={device} />
    </group>
  );
}

export function Stacker({
  position,
  sign = -1,
}: {
  position: Vec3;
  sign?: number;
}) {
  const [x, y, z] = position;
  return (
    <group name="warehouse-stacker">
      <Block
        p={[6.3, 0.12, sign * 1.75]}
        size={[4.3, 0.12, 0.18]}
        color="#4e7186"
      />
      <Block
        p={[x, 1.95, sign * 1.75]}
        size={[0.15, 3.7, 0.18]}
        color="#7798a6"
      />
      <Block
        p={[x, y - 0.085, (z + sign * 1.75) / 2]}
        size={[0.13, 0.05, Math.abs(z - sign * 1.75) + 0.15]}
        color="#b1c5ca"
      />
      <Block p={[x, y - 0.085, z]} size={[0.58, 0.05, 0.5]} color="#799aa6" />
    </group>
  );
}
