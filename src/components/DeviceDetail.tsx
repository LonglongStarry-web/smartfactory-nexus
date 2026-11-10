import { useFactory } from "../store/useFactory";
import { Badge, Panel } from "./UI";
export default function DeviceDetail() {
  const f = useFactory();
  const d = f.s.devices.find((d) => d.id === f.selected)!;
  const a = f.s.alarms.find((a) => a.deviceId === d.id && !a.resolved);
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
