import { useState } from "react";
import { useFactory } from "../store/useFactory";
import { Panel, Stat, Chart, Modal, Empty, lineOption } from "../components/UI";
import { defects, inspect, metrics, stamp } from "../simulation/engine";
import type { QualityInspection } from "../domain/types";
export default function Quality() {
  const f = useFactory();
  const [filter, setFilter] = useState("all"),
    [batch, setBatch] = useState("all"),
    [selected, setSelected] = useState<QualityInspection>();
  const qs = f.s.inspections.filter(
    (q) =>
      (filter === "all" || q.result === filter) &&
      (batch === "all" || q.batch === batch),
  );
  const m = metrics(f.s);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="breadcrumb">质量管理 / 批次追溯</div>
          <h1>智能质量检测</h1>
          <p>
            模拟视觉检测 ·
            固定种子生成缺陷与人为标注位置，未运行真实图像检测模型
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            const o = f.s.orders.find((o) => !o.cancelled);
            if (o) {
              f.update((s) => inspect(s, o.id, "QC-01"));
              f.notify("已生成模拟抽检记录");
            } else f.notify("请先创建可追溯订单");
          }}
        >
          模拟抽检一个产品
        </button>
      </div>
      <div className="kpi-strip">
        <Stat label="已检测产品" value={m.total} unit="件" />
        <Stat label="合格产品" value={m.good} unit="件" />
        <Stat label="不合格产品" value={m.total - m.good} unit="件" />
        <Stat
          label="检测良品率"
          value={m.total ? (m.quality * 100).toFixed(1) : "—"}
          unit={m.total ? "%" : ""}
        />
      </div>
      <div className="two-columns">
        <Panel title="缺陷类型分布" sub="当前全部检测历史">
          <Chart
            option={{
              grid: { left: 75, right: 20, top: 15, bottom: 20 },
              xAxis: {
                type: "value",
                minInterval: 1,
                splitLine: { lineStyle: { color: "#26364a" } },
              },
              yAxis: { type: "category", data: defects },
              series: [
                {
                  type: "bar",
                  barMaxWidth: 12,
                  data: defects.map(
                    (k) => f.s.inspections.filter((q) => q.defect === k).length,
                  ),
                },
              ],
            }}
          />
        </Panel>
        <Panel title="检测示意" sub="示意工件 · 框线为人为标注">
          <div className="part-preview">
            <div className="metal-part">
              <div className="part-hole" />
              {[0, 1, 2, 3].map((i) => (
                <i key={i} className={`bolt b${i}`} />
              ))}
            </div>
            <span className="part-caption">
              FLANGE A-320 / VISUAL INSPECTION DEMO
            </span>
          </div>
        </Panel>
      </div>
      <Panel title="质量趋势" sub="每10个模拟秒的累计检测良品率">
        <Chart
          option={lineOption(
            f.s.energy.map((e) => stamp(e.time)),
            [
              {
                name: "检测良品率",
                values: f.s.energy.map((e) => {
                  const records = f.s.inspections.filter(
                    (q) => q.time <= e.time,
                  );
                  return records.length
                    ? +(
                        (records.filter((q) => q.result === "pass").length /
                          records.length) *
                        100
                      ).toFixed(1)
                    : 0;
                }),
              },
            ],
            "%",
          )}
        />
      </Panel>
      <Panel
        title="检测历史"
        sub={`${qs.length} 条记录`}
        action={
          <div className="toolbar">
            <select
              aria-label="筛选检测结果"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">全部结果</option>
              <option value="pass">合格</option>
              <option value="fail">缺陷</option>
            </select>
            <select
              aria-label="筛选批次"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
            >
              <option value="all">全部批次</option>
              {[...new Set(f.s.inspections.map((q) => q.batch))].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>产品编号</th>
                <th>订单 / 批次</th>
                <th>检测时间</th>
                <th>结果</th>
                <th>缺陷类型</th>
                <th>追溯</th>
              </tr>
            </thead>
            <tbody>
              {qs.slice(0, 30).map((q) => (
                <tr key={q.id}>
                  <td>{q.workpieceId}</td>
                  <td>
                    {q.orderId}
                    <small>{q.batch}</small>
                  </td>
                  <td>{stamp(q.time)}</td>
                  <td className={q.result === "fail" ? "red" : "green"}>
                    {q.result === "pass" ? "合格" : "不合格"}
                  </td>
                  <td>{q.defect || "—"}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setSelected(q)}
                    >
                      查看产品
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!qs.length && (
          <Empty>没有匹配检测记录。开始生产或执行一次模拟抽检。</Empty>
        )}
      </Panel>
      {selected && (
        <Modal title="产品质量追溯" onClose={() => setSelected(undefined)}>
          <div className="part-preview">
            <div className="metal-part">
              <div className="part-hole" />
            </div>
            {selected.result === "fail" && (
              <div
                className="defect-box"
                style={{ left: `${selected.x}%`, top: `${selected.y}%` }}
              >
                {selected.defect}
              </div>
            )}
          </div>
          <dl>
            {[
              ["产品", selected.workpieceId],
              ["订单", selected.orderId],
              ["批次", selected.batch],
              ["时间", stamp(selected.time)],
              ["结果", selected.defect || "合格"],
              [
                "标注位置",
                `x=${selected.x.toFixed(1)}%, y=${selected.y.toFixed(1)}%`,
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </>
  );
}
