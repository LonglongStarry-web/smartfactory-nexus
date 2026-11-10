import { useState } from "react";
import { useFactory } from "../store/useFactory";
import { Panel, Badge, Empty, Chart, lineOption } from "../components/UI";
import { stamp } from "../simulation/engine";
import DeviceDetail from "../components/DeviceDetail";
export default function Health() {
  const f = useFactory();
  const [sensor, setSensor] = useState<"temperature" | "vibration">(
    "temperature",
  );
  const d = f.s.devices.find((d) => d.id === f.selected)!;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="breadcrumb">设备管理 / 可解释规则诊断</div>
          <h1>设备健康与维护</h1>
          <p>
            温度 &gt; 80°C 或振动 &gt; 5 mm/s 触发演示规则 · 未使用机器学习模型
          </p>
        </div>
        <button onClick={() => f.nav("ar")}>AR 辅助巡检</button>
      </div>
      <div className="health-layout">
        <Panel title="设备健康档案" sub="选择设备可查看参数、故障与维修记录">
          <div className="device-grid">
            {f.s.devices.map((x) => (
              <button
                className={`device-card ${x.id === f.selected ? "selected" : ""}`}
                key={x.id}
                onClick={() => f.select(x.id)}
              >
                <div>
                  <b>{x.id}</b>
                  <Badge status={x.status} />
                </div>
                <p>{x.name}</p>
                <div className="health-score">
                  <strong>
                    {x.health}
                    <small>/100</small>
                  </strong>
                  <span>健康评分</span>
                </div>
                <progress value={x.health} max={100} />
                <div className="device-params">
                  <span>{x.temperature.toFixed(1)} °C</span>
                  <span>{x.vibration.toFixed(1)} mm/s</span>
                </div>
              </button>
            ))}
          </div>
        </Panel>
        <DeviceDetail />
      </div>
      <div className="two-columns">
        <Panel
          title={`${d.id} · 故障演练`}
          sub="注入异常将立即停机，告警、三维与调度同步变化"
        >
          <div className="toolbar wrap">
            {["温度异常", "振动异常", "设备故障"].map((k) => (
              <button
                className="danger"
                key={k}
                disabled={d.status === "fault" || d.status === "maintenance"}
                onClick={() => f.fault(d.id, k)}
              >
                注入{k}
              </button>
            ))}
            <button
              disabled={d.status !== "fault" && d.status !== "maintenance"}
              onClick={() => {
                if (d.status === "maintenance") f.nav("ar");
                else f.finish(d.id);
              }}
            >
              恢复正常状态
            </button>
          </div>
          <p className="subtle">
            已有维修工单时，必须在巡检页逐项确认才能恢复。
          </p>
          <div className="toolbar">
            <select
              aria-label="设备历史参数"
              value={sensor}
              onChange={(e) => setSensor(e.target.value as any)}
            >
              <option value="temperature">温度历史 / °C</option>
              <option value="vibration">振动历史 / mm/s</option>
            </select>
          </div>
          <Chart
            height={150}
            option={lineOption(
              (d.history || []).map((h) => stamp(h.time)),
              [
                {
                  name: sensor === "temperature" ? "温度" : "振动",
                  values: (d.history || []).map((h) => +h[sensor].toFixed(2)),
                },
              ],
              sensor === "temperature" ? "°C" : "mm/s",
            )}
          />
          <p className="subtle">
            每 10 个模拟秒采样，保留最近 180 点。异常注入立即更新当前参数。
          </p>
        </Panel>
        <Panel title="维修工单与告警历史" sub="解除告警仍保留事件证据">
          <div className="record-list">
            {f.s.alarms.length ? (
              f.s.alarms.slice(0, 6).map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    f.select(a.deviceId);
                    f.nav("ar");
                  }}
                >
                  <div>
                    <b>
                      {a.deviceId} · {a.kind}
                    </b>
                    <small>{a.message}</small>
                  </div>
                  <span className={a.resolved ? "subtle" : "red"}>
                    {a.resolved ? "已解决" : "待处理"}
                    <small>{stamp(a.time)}</small>
                  </span>
                </button>
              ))
            ) : (
              <Empty>当前没有报警。可选择设备发起一次故障演练。</Empty>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
