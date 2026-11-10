import { useState } from "react";
import { ArrowUpRight, Box, Radio, ChevronRight } from "lucide-react";
import { useFactory } from "../store/useFactory";
import { metrics, stamp, statusText } from "../simulation/engine";
import { Panel, Stat, Chart, lineOption, Empty } from "../components/UI";
import Twin from "../features/digital-twin/Twin";
export default function Dashboard() {
  const f = useFactory();
  const [line, setLine] = useState("all"),
    [range, setRange] = useState(900);
  const m = metrics(f.s, line);
  const history = f.s.energy.filter((e) => e.time >= f.s.time - range);
  const alarms = f.s.alarms.filter(
    (a) =>
      !a.resolved &&
      (line === "all" ||
        f.s.devices.find((d) => d.id === a.deviceId)?.line === line),
  );
  const devices = f.s.devices.filter((d) => line === "all" || d.line === line);
  const xs = history.map((e) => stamp(e.time));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="breadcrumb">
            运营中心 <ChevronRight size={12} /> 车间总览
          </div>
          <h1>智能制造驾驶舱</h1>
          <p>
            {m.alarms
              ? `${m.alarms} 项设备异常待处理，排产已自动调整`
              : "车间已就绪，生产、设备与物流在此协同"}
          </p>
        </div>
        <div className="toolbar">
          <select
            aria-label="筛选产线"
            value={line}
            onChange={(e) => setLine(e.target.value)}
          >
            <option value="all">全部产线</option>
            <option value="A">A 线 · 精密零件</option>
            <option value="B">B 线 · 柔性装配</option>
          </select>
          <button onClick={() => f.nav("reports")}>
            运营报告 <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
      <div className="kpi-strip">
        <Stat
          label="综合设备效率 OEE"
          value={(m.oee * 100).toFixed(1)}
          unit="%"
          sub={`可用率 ${(m.availability * 100).toFixed(0)}% × 性能 ${(m.performance * 100).toFixed(0)}% × 良率 ${(m.quality * 100).toFixed(0)}%`}
          onClick={() => f.nav("health")}
        />
        <Stat
          label="累计产出 / 今日计划"
          value={m.output}
          unit={`/ ${m.plan} 件`}
          sub="完成加工的工件，含不合格品"
          onClick={() => f.nav("scheduling")}
        />
        <Stat
          label="产品良品率"
          value={m.total ? (m.quality * 100).toFixed(1) : "—"}
          unit={m.total ? "%" : ""}
          sub={`${m.good} 件合格 / ${m.total} 件已检`}
          onClick={() => f.nav("quality")}
        />
        <Stat
          label="单位产品能耗"
          value={m.output ? m.unit.toFixed(3) : "—"}
          unit="kWh/件"
          sub={`累计能耗 ${m.energy.toFixed(2)} kWh`}
          onClick={() => f.nav("energy")}
        />
      </div>
      <div className="dashboard-grid">
        <Panel
          title="车间数字孪生"
          sub="柔性制造实验车间 · 2 条产线 / 8 台设备"
          action={
            <button className="text-button" onClick={() => f.nav("twin")}>
              进入车间 <ArrowUpRight size={14} />
            </button>
          }
          className="twin-panel"
        >
          <div className="scene-overview">
            <Twin labels={false} low />
            <div className="scene-corner">
              <span className="live-dot" />
              {f.s.running ? "模拟实时运行" : "模拟已暂停"}
              <span>程序化三维场景</span>
            </div>
          </div>
          <div className="scene-footer">
            <span>
              <Box size={14} /> 2 条柔性制造产线
            </span>
            <span>
              <Radio size={14} /> 统一模拟事件驱动
            </span>
            <button className="text-button" onClick={() => f.nav("twin")}>
              旋转、选择与设备控制 <ChevronRight size={14} />
            </button>
          </div>
        </Panel>
        <Panel
          title="设备运行概况"
          sub={`${devices.length} 台设备 · 运行率 ${(m.runRate * 100).toFixed(0)}%`}
          action={<span className="subtle">{stamp(f.s.time)}</span>}
        >
          <div className="device-overview">
            {(["running", "idle", "fault", "maintenance"] as const).map(
              (st) => (
                <div key={st}>
                  <span className={`status-dot ${st}`} />
                  <span>{statusText[st]}</span>
                  <strong>
                    {devices.filter((d) => d.status === st).length}
                  </strong>
                </div>
              ),
            )}
          </div>
          <div className="line-capacity">
            {["A", "B"]
              .filter((l) => line === "all" || line === l)
              .map((l) => {
                const lm = metrics(f.s, l);
                return (
                  <div key={l}>
                    <div>
                      <span>
                        产线 {l}{" "}
                        <small>{l === "A" ? "精密零件" : "柔性装配"}</small>
                      </span>
                      <strong>
                        {(lm.runRate * 100).toFixed(0)}
                        <small> %</small>
                      </strong>
                    </div>
                    <progress value={lm.runRate} max={1} />
                  </div>
                );
              })}
          </div>
          <div className="mini-kpis">
            <div>
              <span>订单完成率</span>
              <strong>{(m.completion * 100).toFixed(0)}%</strong>
            </div>
            <button onClick={() => f.nav("health")}>
              <span>当前报警</span>
              <strong className={alarms.length ? "red" : ""}>
                {alarms.length}
                <small> 项</small>
              </strong>
            </button>
          </div>
        </Panel>
        <Panel
          title="生产节拍"
          sub="累计产量与合格品数量"
          action={
            <select
              aria-label="趋势时间范围"
              value={range}
              onChange={(e) => setRange(+e.target.value)}
            >
              <option value="300">最近 5 分钟</option>
              <option value="900">最近 15 分钟</option>
              <option value="86400">本次模拟</option>
            </select>
          }
        >
          {!history.length ? (
            <Empty>开始生产后，每 10 个模拟秒记录一组产出。</Empty>
          ) : (
            <Chart
              option={lineOption(
                xs,
                [
                  {
                    name: "总产量",
                    values: history.map((e) =>
                      line === "all"
                        ? e.output
                        : f.s.workpieces.filter(
                            (w) =>
                              w.time <= e.time &&
                              devices.some(
                                (d) => d.kind === "cnc" && d.id === w.deviceId,
                              ),
                          ).length,
                    ),
                  },
                  {
                    name: "合格品",
                    values: history.map((e) =>
                      line === "all"
                        ? e.good
                        : f.s.workpieces.filter(
                            (w) =>
                              w.time <= e.time &&
                              w.result === "pass" &&
                              devices.some(
                                (d) => d.kind === "cnc" && d.id === w.deviceId,
                              ),
                          ).length,
                    ),
                  },
                ],
                "件",
              )}
            />
          )}
        </Panel>
        <Panel
          title="事件与告警"
          sub="按模拟时间记录 · 点击设备事件定位"
          action={
            <button className="text-button" onClick={() => f.nav("reports")}>
              查看全部
            </button>
          }
        >
          <div className="event-feed">
            {f.s.events.slice(0, 4).map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  if (e.deviceId) {
                    f.select(e.deviceId);
                    f.nav("twin");
                  } else f.nav("reports");
                }}
              >
                <i className={e.type === "设备报警" ? "red-bg" : ""} />
                <div>
                  <b>{e.type}</b>
                  <p>{e.message}</p>
                </div>
                <time>{stamp(e.time)}</time>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="能耗趋势" sub="累计用电量 · kWh">
          <Chart
            height={150}
            option={lineOption(
              xs,
              [
                {
                  name: "能耗",
                  values: history.map(
                    (e) =>
                      +(
                        line === "A"
                          ? e.lineA
                          : line === "B"
                            ? e.lineB
                            : e.total
                      ).toFixed(3),
                  ),
                },
              ],
              "kWh",
            )}
          />
        </Panel>
        <Panel title="订单与故障分布" sub="当前订单及故障历史">
          <div className="distribution">
            {["待生产", "加工中", "已完成", "已取消"].map((name, i) => {
              const count = f.s.orders.filter((o) =>
                i === 3
                  ? o.cancelled
                  : !o.cancelled &&
                    (i === 0
                      ? o.completed === 0
                      : i === 1
                        ? o.completed > 0 && o.completed < o.quantity
                        : o.completed >= o.quantity),
              ).length;
              return (
                <div key={name}>
                  <span>{name}</span>
                  <progress
                    value={count}
                    max={Math.max(1, f.s.orders.length)}
                  />
                  <strong>{count}</strong>
                </div>
              );
            })}
            <p className="subtle">
              故障历史：
              {["温度异常", "振动异常", "设备故障"]
                .map(
                  (k) =>
                    `${k} ${f.s.alarms.filter((a) => a.kind === k).length}`,
                )
                .join(" · ")}
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
