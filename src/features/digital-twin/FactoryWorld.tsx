import { useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useFactory } from "../../store/useFactory";
import { cellAnchors, factoryLayout, type Vec3 } from "../../domain/layout";
import type { ProcessRun } from "../../domain/process";
import type { Workcell } from "../../domain/flow";
import { motionPose, replayAt, type MotionPose } from "./motion";
import {
  AGVModel,
  Block,
  CNCModel,
  Part,
  QCModel,
  RobotModel,
  Rollers,
  WarehouseModel,
} from "./Models";

export interface SceneView {
  deviceId?: string;
  cutaway?: boolean;
  showPath?: boolean;
  replay?: { run: ProcessRun; time: number };
}

function WorkpieceView({
  id,
  pose,
  run,
}: {
  id: string;
  pose: MutableRefObject<MotionPose>;
  run: ProcessRun;
}) {
  const observe = useFactory((s) => s.select);
  const phase = motionPose(run, run.devices.cnc.endsWith("01") ? "A" : "B");
  return (
    <group name={`workpiece-${id}`}>
      <Part
        pose={pose}
        holes={phase.holes}
        deburred={phase.deburred}
        onClick={() => observe(run.devices.cnc)}
      />
    </group>
  );
}

function QueuedPart({
  id,
  line,
  index,
  activePose,
}: {
  id: string;
  line: string;
  index: number;
  activePose: MutableRefObject<MotionPose>;
}) {
  const ref = useRef(motionPose(undefined, line));
  const a = cellAnchors(line);
  useFrame(() => {
    const active = activePose.current;
    const feeding =
      active.stage === "pick" ? Math.min(1, active.progress / 0.25) : 1;
    ref.current.part = [
      a.raw[0] + 0.65 * (index + 2 - feeding),
      a.raw[1],
      a.raw[2],
    ];
    ref.current.radius = 0.26;
    ref.current.height = 0.18;
  });
  return (
    <group name={`queued-${id}`}>
      <Part pose={ref} />
    </group>
  );
}

function AnimatedCell({
  cell,
  pose,
  view,
}: {
  cell: Workcell;
  pose: MutableRefObject<MotionPose>;
  view: SceneView;
}) {
  const state = useFactory((s) => s.s),
    selected = useFactory((s) => s.selected),
    select = useFactory((s) => s.select);
  const running = state.running;
  const live = cell.activeId ? state.flow.runs[cell.activeId] : undefined;
  const replay =
    view.replay?.run.devices.cnc === cell.cncId ? view.replay : undefined;
  const sample = replay ? replayAt(replay.run, replay.time) : undefined;
  const run =
    replay && sample
      ? {
          ...replay.run,
          status: "running" as const,
          stepIndex: sample.stepIndex,
          stepElapsed:
            sample.progress *
            replay.run.recipe.steps[sample.stepIndex].duration,
        }
      : live;
  const part = run
    ? state.workpieces.find((w) => w.id === run.workpieceId)
    : undefined;
  const slot = part?.bufferSlot ?? 0;
  const step = run?.recipe.steps[run.stepIndex];
  const progress =
    sample?.progress ?? (step ? (run?.stepElapsed ?? 0) / step.duration : 0);
  const animation = useRef({
    key: "",
    previous: progress,
    target: progress,
    start: 0,
    run,
  });
  const reduced = useFactory((s) => s.preferences.reducedMotion);
  useFrame(({ clock }) => {
    const key = `${run?.workpieceId}:${run?.stepIndex}`;
    if (animation.current.run !== run) {
      const same = animation.current.key === key;
      animation.current = {
        key,
        previous: same ? pose.current.progress : 0,
        target: progress,
        start: clock.elapsedTime,
        run,
      };
    }
    const a = animation.current;
    const fraction =
      replay || !running || run?.status !== "running" || reduced
        ? 1
        : Math.min(1, (clock.elapsedTime - a.start) / 0.1);
    pose.current = motionPose(
      run,
      cell.line,
      a.previous + (a.target - a.previous) * fraction,
      slot,
    );
  }, -20);
  const cnc = state.devices.find((d) => d.id === cell.cncId)!,
    robot = state.devices.find((d) => d.id === cell.robotId)!;
  const anchors = cellAnchors(cell.line);
  return (
    <>
      <group
        onClick={(e) => {
          e.stopPropagation();
          select(cell.cncId);
        }}
      >
        <CNCModel
          device={cnc}
          pose={pose}
          cutaway={Boolean(
            view.cutaway &&
            (!view.deviceId ||
              [cell.cncId, cell.robotId].includes(view.deviceId)),
          )}
          showPath={view.showPath && selected === cell.cncId}
          moving={running && run?.status === "running"}
        />
      </group>
      <group
        onClick={(e) => {
          e.stopPropagation();
          select(cell.robotId);
        }}
      >
        <RobotModel device={robot} pose={pose} />
      </group>
      <Block
        p={[cnc.position[0], 0.025, cnc.position[2]]}
        size={[3.1, 0.05, 3.1]}
        color={selected === cell.cncId ? "#245769" : "#344b5f"}
      />
      <Block
        p={[0, 0.025, anchors.base[2]]}
        size={[1.7, 0.05, 1.8]}
        color={selected === cell.robotId ? "#245769" : "#344b5f"}
      />
      <Rollers
        from={[anchors.raw[0] - 0.15, 1.02, anchors.raw[2]]}
        to={[anchors.raw[0] + 2.3, 1.02, anchors.raw[2]]}
      />
      {run && <WorkpieceView id={run.workpieceId} pose={pose} run={run} />}
      {!replay &&
        cell.queue.map((id, i) => (
          <QueuedPart
            key={id}
            id={id}
            line={cell.line}
            index={i}
            activePose={pose}
          />
        ))}
      {!replay &&
        [...cell.good, ...cell.reject]
          .filter((id) => id !== state.flow.transfer?.workpieceId)
          .map((id) => {
            const saved = state.flow.runs[id],
              p = state.workpieces.find((w) => w.id === id);
            return (
              <Part
                key={id}
                position={anchors.output(
                  saved.inspection?.result === "fail" ? "reject" : "good",
                  p?.bufferSlot ?? 0,
                )}
                holes={5}
                deburred
                color={
                  saved.inspection?.result === "fail" ? "#ba7773" : "#c6b57c"
                }
              />
            );
          })}
      {(["good", "reject"] as const).map((kind) => (
        <Rollers
          key={kind}
          from={[anchors.output(kind, 0)[0], 1.03, 0]}
          to={[anchors.output(kind, 0)[0], 1.03, anchors.output(kind, 1)[2]]}
          width={0.65}
        />
      ))}
    </>
  );
}

export function vehiclePose(
  deviceId: string,
  state: ReturnType<typeof useFactory.getState>["s"],
): Vec3 {
  const home = factoryLayout[deviceId] ?? [0, 0, 0];
  const transfer = state.flow.transfer;
  if (!transfer) return home;
  const cell = state.flow.cells.find((c) => c.id === transfer.cellId);
  if (!cell || cell.agvId !== deviceId) return home;
  const p = transfer.elapsed / state.flow.transferDuration,
    sign = cell.line === "A" ? -1 : 1;
  const source = cellAnchors(cell.line).output(
    transfer.kind,
    state.workpieces.find((w) => w.id === transfer.workpieceId)?.bufferSlot ??
      0,
  );
  const pickup: Vec3 = [source[0], 0, source[2]],
    dock: Vec3 = [5.7, 0, sign * 1.35];
  const waypoints: Vec3[] = [home, pickup, pickup, dock, dock, home];
  const n = Math.min(
      waypoints.length - 2,
      Math.floor(p * (waypoints.length - 1)),
    ),
    u = Math.min(1, p * (waypoints.length - 1) - n);
  return waypoints[n].map((v, i) => v + (waypoints[n + 1][i] - v) * u) as Vec3;
}

export default function FactoryWorld({
  view = {},
  root,
}: {
  view?: SceneView;
  root: RefObject<HTMLDivElement | null>;
}) {
  const state = useFactory((s) => s.s),
    select = useFactory((s) => s.select);
  const poses = useMemo(
    () =>
      Object.fromEntries(
        state.flow.cells.map((c) => [
          c.id,
          { current: motionPose(undefined, c.line) },
        ]),
      ),
    [],
  );
  const qcOwner = state.flow.cells.find(
    (c) => c.activeId && state.flow.occupancy[c.qcId] === c.activeId,
  );
  const qc = state.devices.find((d) => d.id === "QC-01")!,
    warehouse = state.devices.find((d) => d.id === "ASRS-01")!;
  const { gl, scene } = useThree();
  const telemetry = useRef({ at: 0, last: 0, frames: 0, total: 0 });
  const scratch = useMemo(
    () => ({ part: new THREE.Vector3(), tcp: new THREE.Vector3() }),
    [],
  );
  useFrame(({ clock }, dt) => {
    const t = telemetry.current;
    t.frames++;
    t.total += dt;
    if (clock.elapsedTime - t.at < 0.25 || !root.current) return;
    const current = useFactory.getState().s;
    const cells = current.flow.cells.map((c) => {
      const run = c.activeId ? current.flow.runs[c.activeId] : undefined;
      const group = run
        ? scene.getObjectByName(`workpiece-${run.workpieceId}`)
        : undefined;
      const mesh = group?.children[0],
        tcp = scene.getObjectByName(`tcp-${c.robotId}`);
      const worldPart = mesh?.getWorldPosition(scratch.part),
        worldTcp = tcp?.getWorldPosition(scratch.tcp);
      return {
        id: c.id,
        workpiece: run?.workpieceId,
        stage: run?.recipe.steps[run.stepIndex]?.id,
        holder: run?.holder,
        part: worldPart?.toArray(),
        tcp: worldTcp?.toArray(),
        contactError:
          worldPart && worldTcp && run?.holder === "gripper"
            ? worldPart.distanceTo(worldTcp)
            : null,
      };
    });
    root.current.dataset.scene = JSON.stringify({
      fps: t.frames / Math.max(0.001, t.total),
      calls: gl.info.render.calls,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      cells,
    });
    t.frames = 0;
    t.total = 0;
    t.at = clock.elapsedTime;
  }, -1);
  return (
    <>
      <Block p={[1.2, -0.18, 0]} size={[17, 0.32, 12]} color="#344a5c" />
      <gridHelper
        args={[17, 34, "#557487", "#40596b"]}
        position={[1.2, 0.005, 0]}
      />
      {[-4.7, 4.7].map((z) => (
        <Block
          key={z}
          p={[1.2, 0.015, z]}
          size={[15, 0.02, 0.045]}
          color="#c8ad65"
        />
      ))}
      <Rollers from={[1.7, 1.03, 0]} to={[4.6, 1.03, 0]} />
      {state.flow.cells.map((c) => (
        <AnimatedCell key={c.id} cell={c} pose={poses[c.id]} view={view} />
      ))}
      <group
        onClick={(e) => {
          e.stopPropagation();
          select(qc.id);
        }}
      >
        <QCModel device={qc} pose={qcOwner ? poses[qcOwner.id] : undefined} />
      </group>
      <group
        onClick={(e) => {
          e.stopPropagation();
          select(warehouse.id);
        }}
      >
        <WarehouseModel
          device={warehouse}
          stored={
            state.workpieces.filter((w) => w.storedAt !== undefined).length
          }
        />
      </group>
      {state.devices
        .filter((d) => d.kind === "agv")
        .map((d) => (
          <group
            key={d.id}
            onClick={(e) => {
              e.stopPropagation();
              select(d.id);
            }}
          >
            <AGVModel device={d} position={vehiclePose(d.id, state)} />
          </group>
        ))}
      {state.flow.transfer &&
        (() => {
          const c = state.flow.cells.find(
            (c) => c.id === state.flow.transfer!.cellId,
          )!;
          const p = vehiclePose(c.agvId, state);
          return <Part position={[p[0], 0.95, p[2]]} holes={5} deburred />;
        })()}
    </>
  );
}
