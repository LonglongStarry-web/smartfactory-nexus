import { transportPose } from "../features/digital-twin/logistics";
import { dispatchInventory } from "../simulation/flow";
import { useFactory } from "../store/useFactory";
import { Badge, Panel } from "./UI";
export default function DeviceDetail() {
  const f = useFactory();
  const d = f.s.devices.find((d) => d.id === f.selected)!;
  const a = f.s.alarms.find((a) => a.deviceId === d.id && !a.resolved);
  const transfer = f.s.flow.transfer;
  const transport = transportPose(f.s);
  const inventory = f.s.workpieces.filter(
    (w) => w.storedAt !== undefined && w.dispatchedAt === undefined,
  ).length;
  const transportCell =
    transport &&
    [transport.cell.agvId, transport.cell.warehouseId].includes(d.id)
      ? transport.cell
      : undefined;
  const movingId = transfer?.workpieceId ?? f.s.flow.reroute?.workpieceId;
  const cell =
    transportCell ??
    f.s.flow.cells.find(
      (c) =>
        c.cncId === d.id ||
        c.robotId === d.id ||
        (c.activeId && f.s.flow.occupancy[d.id] === c.activeId),
    );
  const run =
    transportCell && movingId
      ? f.s.flow.runs[movingId]
      : cell?.activeId
        ? f.s.flow.runs[cell.activeId]
        : undefined;
  const step = run?.recipe.steps[run.stepIndex];
  const phaseLabel = transportCell
    ? f.s.flow.reroute
      ? "未开工毛坯替代转运"
      : transfer?.kind === "good"
        ? "合格入库转运"
        : "不合格品隔离转运"
    : step?.label;
  const duration = transportCell
    ? (f.s.flow.reroute?.duration ?? f.s.flow.transferDuration)
    : (step?.duration ?? 1);
  const elapsed = transportCell
    ? (transfer?.elapsed ?? f.s.flow.reroute?.elapsed ?? 0)
    : (run?.stepElapsed ?? 0);
  return (
    <Panel title={d.id} sub={d.name} action={<Badge status={d.status} />}>
      <div className="detail-metrics">
        <div>
          <span>温度</span>
          <strong>
            {d.temperature.toFixed(1)} <small>°C</small>
          </strong>
        </div>
        <div>
          <span>振动</span>
          <strong>
            {d.vibration.toFixed(2)} <small>mm/s</small>
          </strong>
        </div>
        <div>
          <span>健康评分</span>
          <strong>
            {d.health}
            <small> /100</small>
          </strong>
        </div>
        <div>
          <span>设备负载</span>
          <strong>
            {d.load.toFixed(0)}
            <small> %</small>
          </strong>
        </div>
      </div>
      {d.kind === "warehouse" && (
        <section className="stack">
          <strong>
            成品库存 {inventory} / {f.s.flow.warehouseCapacity ?? 480} 件
          </strong>
          <small>
            12 个逻辑货格，每格按 40 件聚合显示；图中料箱不按真实装箱尺寸建模。
          </small>
          <button
            disabled={!inventory}
            onClick={() => {
              f.update(dispatchInventory);
              f.notify("现有成品库存已发运，历史订单完成数保留");
            }}
          >
            发运现有库存
          </button>
        </section>
      )}
      {transport &&
        [transport.cell.agvId, transport.cell.warehouseId].includes(d.id) && (
          <p>
            物流动作：{transport.phase} · {Math.round(transport.progress * 100)}
            %
          </p>
        )}
      <dl>
        <div>
          <dt>所属产线</dt>
          <dd>{d.line} 线</dd>
        </div>
        <div>
          <dt>当前任务</dt>
          <dd>{d.task || "无待加工任务"}</dd>
        </div>
        <div>
          <dt>累计运行</dt>
          <dd>{(d.runtime / 60).toFixed(1)} min</dd>
        </div>
        <div>
          <dt>累计能耗</dt>
          <dd>{d.energy.toFixed(3)} kWh</dd>
        </div>
      </dl>
      {["cnc", "robot", "qc"].includes(d.kind) && (
        <button className="primary" onClick={() => f.observe(d.id)}>
          观察加工
        </button>
      )}
      <section
        className="stack"
        aria-label="工件流转"
        data-testid="process-detail"
      >
        <strong>工件流转</strong>
        {run && phaseLabel ? (
          <>
            <span>
              {run.workpieceId} · {run.recipe.product}
            </span>
            <span data-testid="process-stage">
              {phaseLabel} · {Math.round((elapsed / duration) * 100)}%
            </span>
            <progress
              aria-label="当前工序进度"
              max={duration}
              value={elapsed}
            />
            <small>
              工件位置：
              {transportCell
                ? transport?.loaded
                  ? "AGV 顶升平台"
                  : transport?.phase
                : {
                    infeed: "上料位",
                    gripper: "机械臂夹爪",
                    fixture: "机床夹具",
                    inspection: "检测工位",
                    "good-buffer": "良品暂存",
                    "reject-buffer": "不合格暂存",
                  }[run.holder]}
            </small>
          </>
        ) : (
          <span className="subtle">当前没有加工中的工件</span>
        )}
        {cell && (
          <small>
            待加工 {cell.queue.length}/{f.s.flow.inputCapacity} · 良品暂存{" "}
            {cell.good.length}/{f.s.flow.outputCapacity} · 不合格暂存{" "}
            {cell.reject.length}/{f.s.flow.outputCapacity}
          </small>
        )}
        {!transportCell && cell?.waitingReason && (
          <p className="notice warning" role="status">
            {cell.waitingReason}
          </p>
        )}
      </section>
      {a && <p className="notice warning">{a.message}</p>}
      <div className="stack">
        {d.status === "fault" || d.status === "maintenance" ? (
          <>
            <button
              className="primary"
              onClick={() => {
                if (d.status === "fault") f.repair(d.id);
                f.nav("ar");
              }}
            >
              进入巡检维修
            </button>
            <button onClick={() => f.nav("health")}>查看故障与维修记录</button>
          </>
        ) : (
          <>
            <button
              className="danger"
              onClick={() => f.fault(d.id, "设备故障")}
            >
              注入设备故障
            </button>
            <button onClick={() => f.nav("health")}>查看设备健康</button>
          </>
        )}
      </div>
    </Panel>
  );
}
