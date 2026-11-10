import { useState } from "react";
import { Panel } from "../../components/UI";
import { useFactory } from "../../store/useFactory";
import { assign } from "../../simulation/engine";
import { disposeRejected } from "../../simulation/flow";
export default function ProcessLab() {
  const f = useFactory();
  const [scenario, setScenario] = useState("normal");
  const [offset, setOffset] = useState(0),
    [diameter, setDiameter] = useState(0),
    [skip, setSkip] = useState(false);
  const choose = (v: string) => {
    setScenario(v);
    setOffset(v === "fixture" ? 0.08 : 0);
    setDiameter(v === "diameter" ? 0.2 : 0);
    setSkip(v === "burr");
  };
  const rejected = f.s.flow.cells
    .flatMap((c) => c.reject)
    .filter((id) => f.s.flow.transfer?.workpieceId !== id);
  const dispose = (id: string, action: "rework" | "scrap") => {
    try {
      f.update((s) => disposeRejected(s, id, action));
      f.notify(
        action === "rework"
          ? "已安排返工回送；开始生产后执行"
          : "工件已报废，保留首检与轨迹",
      );
    } catch (e) {
      f.notify((e as Error).message);
    }
  };
  return (
    <Panel
      title="工艺与质量实验"
      sub="参数仅影响后续投料；已有工件保留原参数快照。规格和误差映射均为课程演示假设。"
    >
      <div className="settings-fields">
        <label className="field">
          可复现场景
          <select
            aria-label="质量实验场景"
            value={scenario}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="normal">正常工艺</option>
            <option value="fixture">装夹偏移 → 孔位超差</option>
            <option value="diameter">补偿偏差 → 尺寸异常</option>
            <option value="burr">漏去毛刺 → 毛刺超限</option>
          </select>
        </label>
        <label className="field">
          装夹偏移 X / mm
          <input
            aria-label="装夹偏移 X"
            type="number"
            step="0.01"
            min="-1"
            max="1"
            value={offset}
            onChange={(e) => setOffset(+e.target.value)}
          />
        </label>
        <label className="field">
          直径补偿误差 / mm
          <input
            aria-label="直径补偿误差"
            type="number"
            min="-1"
            max="1"
            step="0.01"
            value={diameter}
            onChange={(e) => setDiameter(+e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={skip}
            onChange={(e) => setSkip(e.target.checked)}
          />{" "}
          跳过去毛刺
        </label>
        <button
          onClick={() => {
            if (
              !Number.isFinite(offset) ||
              !Number.isFinite(diameter) ||
              Math.abs(offset) > 1 ||
              Math.abs(diameter) > 1
            ) {
              f.notify("请输入 -1 到 1 mm 的有效误差");
              return;
            }
            f.update((s) => {
              s.flow.parameters = {
                ...s.flow.parameters,
                fixtureOffsetXmm: offset,
                contourDiameterErrorMm: diameter,
                skipDeburr: skip,
              };
              s.flow.demoVariations = false;
            });
            f.notify("后续投料采用新参数；已关闭随机演示偏移");
          }}
        >
          应用后续投料参数
        </button>
      </div>
      <label>
        <input
          type="checkbox"
          checked={Boolean(f.s.flow.qualityHold)}
          onChange={(e) =>
            f.update((s) => {
              s.flow.qualityHold = e.target.checked;
              assign(s);
            })
          }
        />{" "}
        保留超差件等待人工处置（暂停自动报废与对应补投）
      </label>
      <p className="subtle">
        首检良品率保持首次检测口径；返工复测单独记录。孔位与尺寸损伤在本模型中不能加料修复，只有毛刺允许去毛刺返工。
      </p>
      {rejected.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>隔离工件</th>
                <th>超差特征</th>
                <th>处置</th>
              </tr>
            </thead>
            <tbody>
              {rejected.map((id) => {
                const r = f.s.flow.runs[id];
                const failures =
                  r.inspection?.measurements.filter(
                    (m) => m.actual < m.lower || m.actual > m.upper,
                  ) ?? [];
                return (
                  <tr key={id}>
                    <td>{id}</td>
                    <td>{failures.map((m) => m.label).join("、")}</td>
                    <td>
                      <div className="toolbar">
                        <button
                          disabled={failures.some(
                            (m) => m.featureId !== "burr-height",
                          )}
                          onClick={() => dispose(id, "rework")}
                        >
                          去毛刺返工
                        </button>
                        <button onClick={() => dispose(id, "scrap")}>
                          报废补投
                        </button>
                        <button onClick={() => f.observe(r.devices.cnc, id)}>
                          回看加工
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
