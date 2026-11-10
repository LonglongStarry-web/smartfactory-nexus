import { useFactory } from "../store/useFactory";
import { Panel, Stat, Chart, lineOption } from "../components/UI";
import { modes, metrics, stamp, schedule } from "../simulation/engine";
import type { Mode } from "../domain/types";
export default function Energy() {
  const f = useFactory();
  const m = metrics(f.s);
  const xs = f.s.energy.map((e) => stamp(e.time));
  const forecast = (mode: Mode) => {
    const s = { ...f.s, mode };
    return Math.max(s.time, ...schedule(s).map((x) => x.end));
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="breadcrumb">绿色制造 / 能源效率</div>
          <h1>能耗与绿色制造</h1>
          <p>
            能耗按设备功率对模拟时间积分 · 碳排因子 0.57 kgCO₂/kWh 为演示假设
          </p>
        </div>
      </div>
      <div className="kpi-strip">
        <Stat label="累计电能" value={m.energy.toFixed(3)} unit="kWh" />
        <Stat
          label="单位产品能耗"
          value={m.output ? m.unit.toFixed(3) : "—"}
          unit="kWh/件"
        />
        <Stat
          label="估算碳排放"
          value={(m.energy * 0.57).toFixed(3)}
          unit="kgCO₂"
        />
        <Stat label="当前运行模式" value={modes[f.s.mode].name} />
      </div>
      <Panel
        title="生产运行模式"
        sub="相同订单与当前故障约束下，比较剩余订单预计完工时刻"
      >
        <div className="mode-grid">
          {(Object.keys(modes) as Mode[]).map((k) => (
            <button
              key={k}
              className={`mode-card ${f.s.mode === k ? "selected" : ""}`}
              onClick={() => f.mode(k)}
            >
              <h3>{modes[k].name}</h3>
              <strong>
                {modes[k].rate.toFixed(2)}
                <small> × 产能</small>
              </strong>
              <p>{modes[k].power.toFixed(2)} × 运行功率</p>
              <small>预计末单完工 {stamp(forecast(k))}</small>
              <span>{f.s.mode === k ? "当前模式" : "切换至此模式"}</span>
            </button>
          ))}
        </div>
        <p className="subtle">
          基础 CNC 功率 8 kW，节拍 10 秒/件。待机功率为额定功率的
          12%，故障与维修功率记 0。累计历史不随模式切换重算。
        </p>
      </Panel>
      <div className="two-columns">
        <Panel title="分产线能耗趋势" sub="累计电能 · 实际模拟积分">
          <Chart
            height={230}
            option={lineOption(
              xs,
              [
                {
                  name: "A线",
                  values: f.s.energy.map((e) => +e.lineA.toFixed(3)),
                },
                {
                  name: "B线",
                  values: f.s.energy.map((e) => +e.lineB.toFixed(3)),
                },
              ],
              "kWh",
            )}
          />
        </Panel>
        <Panel title="分设备用电" sub="由设备累计积分汇总">
          <Chart
            height={230}
            option={{
              grid: { left: 75, right: 25, top: 10, bottom: 30 },
              xAxis: {
                type: "value",
                name: "kWh",
                splitLine: { lineStyle: { color: "#26364a" } },
              },
              yAxis: { type: "category", data: f.s.devices.map((d) => d.id) },
              series: [
                {
                  type: "bar",
                  barMaxWidth: 12,
                  data: f.s.devices.map((d) => +d.energy.toFixed(3)),
                },
              ],
            }}
          />
        </Panel>
      </div>
    </>
  );
}
