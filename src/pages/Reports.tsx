import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { useFactory } from "../store/useFactory";
import { Panel, Stat, Empty, Chart, lineOption } from "../components/UI";
import { metrics, stamp, statusText } from "../simulation/engine";
import { download } from "../utils/download";
const esc = (v: unknown) =>
  String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export default function Reports() {
  const f = useFactory();
  const [range, setRange] = useState("all"),
    [query, setQuery] = useState(""),
    [ascending, setAscending] = useState(false),
    [metric, setMetric] = useState("output");
  const m = metrics(f.s);
  const from = range === "all" ? 0 : Math.max(0, f.s.time - Number(range));
  const events = f.s.events
    .filter((e) => e.time >= from && `${e.type}${e.message}`.includes(query))
    .sort((a, b) => (ascending ? a.time - b.time : b.time - a.time));
  const h = f.s.energy.filter((e) => e.time >= from);
  const qs = f.s.inspections.filter((q) => q.time >= from);
  const report = () =>
    `<!doctype html><html lang="zh"><meta charset="utf-8"><title>智造未来模拟运行报告</title><style>body{font:15px 'Microsoft YaHei',sans-serif;max-width:1000px;margin:40px auto;color:#15243a}h1{font-size:28px}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{padding:9px;border-bottom:1px solid #ddd;text-align:left}small{color:#556} @media print{button{display:none}}</style><h1>SmartFactory Nexus · 模拟运行报告</h1><p>2026-11-09 ${stamp(from)} 至 ${stamp(f.s.time)}（中国标准时间）</p><p>课程原型 / 模拟数据 / 规则调度 / AR 待手机实机验证</p><h2>本次模拟累计指标</h2><p>产出 ${m.output} 件，OEE ${(m.oee * 100).toFixed(1)}%，检测 ${m.total} 件，合格 ${m.good} 件，累计能耗 ${m.energy.toFixed(3)} kWh。</p><h2>设备统计</h2><table><tr><th>设备</th><th>状态</th><th>产出</th><th>运行时间/s</th><th>能耗/kWh</th></tr>${f.s.devices.map((d) => `<tr><td>${d.id}</td><td>${statusText[d.status]}</td><td>${d.produced}</td><td>${d.runtime.toFixed(0)}</td><td>${d.energy.toFixed(3)}</td></tr>`).join("")}</table><h2>订单履约</h2><table><tr><th>订单</th><th>产品</th><th>完成/总数</th><th>状态</th></tr>${f.s.orders.map((o) => `<tr><td>${o.id}</td><td>${esc(o.product)}</td><td>${o.completed}/${o.quantity}</td><td>${o.cancelled ? "取消" : o.completed === o.quantity ? "完成" : "未完工"}</td></tr>`).join("")}</table><h2>窗口事件记录</h2><table><tr><th>时间</th><th>类型</th><th>事件</th></tr>${events.map((e) => `<tr><td>${stamp(e.time)}</td><td>${e.type}</td><td>${esc(e.message)}</td></tr>`).join("")}</table><h2>统计口径</h2><p>OEE=加工中心可用率×性能效率×所选范围检测良品率。手动抽检不增加生产数量，但纳入质检统计与良品率。碳因子0.57 kgCO₂/kWh为假设。生产数据均为浏览器模拟，动画未经物理验证。</p><button onclick="print()">打印 / 保存 PDF</button></html>`;
  function csv() {
    const cell = (s: string | number) =>
      '"' + String(s).replaceAll('"', '""') + '"';
    const rows = [
      ["事件ID", "模拟秒", "时间", "类型", "设备ID", "订单ID", "内容"],
      ...events.map((e) => [
        e.id,
        e.time,
        stamp(e.time),
        e.type,
        e.deviceId || "",
        e.orderId || "",
        e.message,
      ]),
    ];
    download(
      "nexus-events.csv",
      "\ufeff" +
        rows
          .map((r) =>
            r
              .map((v) =>
                cell(typeof v === "string" && /^[=+@-]/.test(v) ? `'${v}` : v),
              )
              .join(","),
          )
          .join("\r\n"),
      "text/csv;charset=utf-8",
    );
    f.notify("CSV 已导出");
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="breadcrumb">分析中心 / 模拟运行记录</div>
          <h1>数据分析与报告</h1>
          <p>指标为本次模拟累计值；图表与事件按所选时间窗口筛选。</p>
        </div>
        <div className="toolbar">
          <button onClick={csv}>
            <Download size={15} /> 事件 CSV
          </button>
          <button
            onClick={() => {
              download(
                "nexus-snapshot.json",
                JSON.stringify(
                  { scope: { from, to: f.s.time }, state: f.s, metrics: m },
                  null,
                  2,
                ),
                "application/json",
              );
              f.notify("完整状态快照已导出");
            }}
          >
            JSON 快照
          </button>
          <button
            className="primary"
            onClick={() => {
              download("nexus-report.html", report(), "text/html");
              f.notify("可打印 HTML 报告已生成");
            }}
          >
            <Printer size={15} /> 导出运行报告
          </button>
        </div>
      </div>
      <div className="kpi-strip">
        <Stat label="累计产出" value={m.output} unit="件" />
        <Stat label="窗口质检记录" value={qs.length} unit="条" />
        <Stat label="累计故障事件" value={f.s.alarms.length} unit="次" />
        <Stat
          label="已完成维修"
          value={
            f.s.maintenance.filter((w) => w.completed !== undefined).length
          }
          unit="单"
        />
      </div>
      <Panel
        title="运行趋势"
        sub={`窗口 ${stamp(from)}–${stamp(f.s.time)}`}
        action={
          <div className="toolbar">
            <select
              aria-label="报告时间范围"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="all">本次模拟</option>
              <option value="300">最近 5 分钟</option>
              <option value="900">最近 15 分钟</option>
            </select>
            <select
              aria-label="报告指标"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
            >
              <option value="output">累计产量</option>
              <option value="total">累计能耗</option>
              <option value="good">累计合格品</option>
            </select>
          </div>
        }
      >
        <Chart
          option={lineOption(
            h.map((e) => stamp(e.time)),
            [
              {
                name: metric,
                values: h.map((e) => +(e as any)[metric].toFixed(3)),
              },
            ],
            metric === "total" ? "kWh" : "件",
          )}
        />
      </Panel>
      <Panel
        title="事件审计日志"
        sub={`${events.length} 条窗口事件 · 最多保留最近 2000 条`}
        action={
          <div className="toolbar">
            <input
              aria-label="搜索事件"
              placeholder="搜索故障、订单或设备…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={() => setAscending(!ascending)}>
              {ascending ? "时间升序" : "时间降序"}
            </button>
          </div>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>事件 ID</th>
                <th>模拟时间</th>
                <th>类型</th>
                <th>设备</th>
                <th>事件内容</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 100).map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.id}</td>
                  <td>{stamp(e.time)}</td>
                  <td>{e.type}</td>
                  <td>{e.deviceId || "—"}</td>
                  <td>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!events.length && <Empty>当前筛选没有事件记录。</Empty>}
      </Panel>
    </>
  );
}
