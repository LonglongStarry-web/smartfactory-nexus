import { useEffect, useState } from "react";
import { useFactory } from "../../store/useFactory";
import { Panel } from "../../components/UI";
import type { ProcessRun, ProcessStepId } from "../../domain/process";
import type { SceneView } from "./FactoryWorld";
import { replayAt } from "./motion";
import { stamp } from "../../simulation/engine";
const explanations: Partial<Record<ProcessStepId, string>> = {
  pick: "滚筒将毛坯送至取料点；夹爪到位后闭合，下一工序由机械臂持有工件。",
  load: "机械臂从开启的门进入，把毛坯中心送到夹具定位基准。",
  clamp: "夹具合拢；夹紧后工件归属由夹爪交给夹具，机械臂才可退出。",
  face: "刀具沿端面往复切削，简化模型逐渐减小毛坯厚度。",
  contour: "刀具沿外轮廓走刀，直径误差由投料时保存的补偿参数决定。",
  drill: "依次加工中心孔及四个连接孔；装夹偏移会传递到孔位测量。",
  deburr: "沿边缘去除毛刺；跳过去毛刺会使残余高度超过演示规格。",
  unload: "松夹后机械臂接管成品，沿避让点退出，再送往共享检测台。",
  inspect: "夹爪释放并退离后扫描，比较测量值与规格；这里使用确定性工艺规则。",
  sort: "合格件与超差件进入不同暂存位；只有合格件完成转运入库才计入订单完成量。",
};
const hotspots = {
  tool: "刀具沿指定路径执行端面、轮廓、钻孔及去毛刺。转速仅为演示参数；没有切削力模型。",
  fixture:
    "夹具建立工件基准。X 定位偏移会导致孔位 X 同量偏移，夹紧/松开与所有权交接联锁。",
  gripper:
    "两段机械臂按目标点求逆运动学；闭合爪面与毛坯侧面相接，搬运中的工件跟随 TCP。",
  scanner:
    "两个单元共享 QC-01，同一时刻仅容纳一件工件。检测值来自保存的工艺参数。",
};
export default function Observation({
  onView,
}: {
  onView: (v: SceneView) => void;
}) {
  const f = useFactory(),
    obs = f.observation!;
  const [history, setHistory] = useState<ProcessRun>(),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(0.5);
  const [cutaway, setCutaway] = useState(true),
    [path, setPath] = useState(true),
    [hotspot, setHotspot] = useState<keyof typeof hotspots>("tool");
  const runs = Object.values(f.s.flow.runs)
    .filter((r) => Object.values(r.devices).includes(obs.deviceId))
    .sort((a, b) => b.time - a.time);
  const currentId =
    f.s.flow.occupancy[obs.deviceId] ??
    f.s.flow.cells.find(
      (c) => c.cncId === obs.deviceId || c.robotId === obs.deviceId,
    )?.activeId;
  const live = currentId ? f.s.flow.runs[currentId] : undefined;
  const run = history ?? live;
  const start = history?.trace[0]?.startedAt ?? 0,
    end = history?.trace.at(-1)?.completedAt ?? start;
  const choose = (id: string) => {
    setPlaying(false);
    const [key, inspectionId] = id.split("@");
    const r = inspectionId
      ? [...(f.s.flow.reworkArchive?.[key] ?? []), f.s.flow.runs[key]].find(
          (r) => r?.inspection?.id === inspectionId,
        )
      : f.s.flow.runs[key];
    setHistory(r ? structuredClone(r) : undefined);
    setTime(r?.trace[0]?.startedAt ?? 0);
  };
  useEffect(() => {
    choose(
      obs.runId
        ? `${obs.runId}${obs.inspectionId ? "@" + obs.inspectionId : ""}`
        : "",
    );
  }, [obs.deviceId, obs.runId, obs.inspectionId]);
  useEffect(() => {
    onView({
      deviceId: obs.deviceId,
      cutaway,
      showPath: path,
      replay: history ? { run: history, time } : undefined,
    });
  }, [obs.deviceId, cutaway, path, history, time, onView]);
  useEffect(() => {
    if (!playing || !history) return;
    const id = setInterval(
      () =>
        setTime((t) => {
          if (t + 0.1 * speed >= end) {
            setPlaying(false);
            return end;
          }
          return t + 0.1 * speed;
        }),
      100,
    );
    return () => clearInterval(id);
  }, [playing, history, end, speed]);
  const index = history
    ? replayAt(history, time).stepIndex
    : (run?.stepIndex ?? 0);
  const step = run?.recipe.steps[index];
  return (
    <Panel
      title="加工观察"
      sub={obs.deviceId}
      action={
        <button
          onClick={() => {
            onView({});
            useFactory.setState({ observation: null });
          }}
        >
          返回车间
        </button>
      }
    >
      <div className="stack" data-testid="observation">
        <div className="toolbar">
          <label>
            <input
              type="checkbox"
              checked={cutaway}
              onChange={(e) => setCutaway(e.target.checked)}
            />{" "}
            透视外壳
          </label>
          <label>
            <input
              type="checkbox"
              checked={path}
              onChange={(e) => setPath(e.target.checked)}
            />{" "}
            刀路示意
          </label>
        </div>
        <label className="field">
          观察工件
          <select
            aria-label="观察工件"
            value={
              history
                ? `${history.workpieceId}${history.inspection && history.inspection.id !== f.s.flow.runs[history.workpieceId]?.inspection?.id ? "@" + history.inspection.id : ""}`
                : "live"
            }
            onChange={(e) => choose(e.target.value)}
          >
            <option value="live">实时加工</option>
            {runs.slice(0, 100).map((r) => (
              <option key={r.workpieceId} value={r.workpieceId}>
                {r.workpieceId} ·{" "}
                {r.inspection?.result === "fail"
                  ? "超差"
                  : r.status === "complete"
                    ? "已完成"
                    : "在制"}
              </option>
            ))}
            {Object.entries(f.s.flow.reworkArchive ?? {}).flatMap(([id, rs]) =>
              rs
                .filter((r) => Object.values(r.devices).includes(obs.deviceId))
                .map((r, i) => (
                  <option
                    key={`${id}@${r.inspection?.id}`}
                    value={`${id}@${r.inspection?.id}`}
                  >
                    {id} · 返工前记录 {i + 1}
                  </option>
                )),
            )}
          </select>
        </label>
        {!run ? (
          <p>
            该设备暂无加工记录。开始生产后可观察；旧版本记录没有轨迹时不能还原加工。
          </p>
        ) : (
          <>
            <strong>
              {run.workpieceId} · {run.recipe.product}
            </strong>
            <span data-testid="observed-stage">{step?.label}</span>
            <p>
              {step &&
                (explanations[step.id] ??
                  "按设备联锁执行当前动作，完成后才进入下一工序。")}
            </p>
            <dl>
              <div>
                <dt>转速</dt>
                <dd>{run.parameters.spindleRpm} rpm</dd>
              </div>
              <div>
                <dt>进给</dt>
                <dd>{run.parameters.feedMmPerMin} mm/min</dd>
              </div>
              <div>
                <dt>定位偏移 X</dt>
                <dd>{run.parameters.fixtureOffsetXmm} mm</dd>
              </div>
              <div>
                <dt>直径补偿误差</dt>
                <dd>{run.parameters.contourDiameterErrorMm} mm</dd>
              </div>
            </dl>
            {history && (
              <>
                <strong>工序轨迹回放</strong>
                <small>
                  依据已完成工序的起止时间重建动作；停机期间未逐帧记录，回放不改变生产状态。
                </small>
                {!history.trace.length ? (
                  <p>尚无已完成的工序轨迹。</p>
                ) : (
                  <>
                    <input
                      aria-label="加工回放时间"
                      type="range"
                      min={start}
                      max={end}
                      step="0.05"
                      value={time}
                      onChange={(e) => {
                        setPlaying(false);
                        setTime(+e.target.value);
                      }}
                    />
                    <span>
                      {stamp(time)} / {stamp(end)}
                    </span>
                    <div className="toolbar">
                      <button
                        onClick={() => {
                          if (time >= end) setTime(start);
                          setPlaying(!playing);
                        }}
                      >
                        {playing ? "暂停回放" : "播放回放"}
                      </button>
                      <select
                        aria-label="回放速度"
                        value={speed}
                        onChange={(e) => setSpeed(+e.target.value)}
                      >
                        {[0.25, 0.5, 1, 2].map((v) => (
                          <option key={v} value={v}>
                            {v}×
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="field">
                      跳到工序
                      <select
                        aria-label="回放工序"
                        value={step?.id}
                        onChange={(e) => {
                          const t = history.trace.find(
                            (t) => t.stepId === e.target.value,
                          );
                          if (t) {
                            setPlaying(false);
                            setTime(t.startedAt);
                          }
                        }}
                      >
                        {history.trace.map((t) => (
                          <option key={t.stepId} value={t.stepId}>
                            {
                              history.recipe.steps.find(
                                (s) => s.id === t.stepId,
                              )?.label
                            }
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </>
            )}
          </>
        )}
        <label className="field">
          部件说明
          <select
            aria-label="部件说明"
            value={hotspot}
            onChange={(e) =>
              setHotspot(e.target.value as keyof typeof hotspots)
            }
          >
            <option value="tool">主轴与刀具</option>
            <option value="fixture">定位夹具</option>
            <option value="gripper">机械臂与夹爪</option>
            <option value="scanner">检测与分流</option>
          </select>
        </label>
        <p>{hotspots[hotspot]}</p>
      </div>
    </Panel>
  );
}
