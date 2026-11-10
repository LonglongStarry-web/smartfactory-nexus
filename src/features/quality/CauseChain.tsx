import { useFactory } from "../../store/useFactory";
import type { QualityInspection } from "../../domain/types";
export default function CauseChain({
  record: q,
}: {
  record: QualityInspection;
}) {
  const s = useFactory((f) => f.s);
  const attempts = [
    ...(s.flow.reworkArchive?.[q.workpieceId] ?? []),
    s.flow.runs[q.workpieceId],
  ].filter(Boolean);
  const run =
    attempts.find((r) => r.inspection?.id === q.id) ?? attempts.at(-1);
  if (!run) return <p>这条历史记录没有参数与工序轨迹，不能据此推断原因。</p>;
  const p = run.parameters;
  return (
    <section className="stack" aria-label="工艺因果追溯">
      <strong>参数 → 工序 → 测量 → 处置</strong>
      <p>
        {run.devices.cnc} · 配方 {run.recipe.id} r{run.recipe.revision} ·{" "}
        {run.attempt ? "返工复测" : "首次加工"}
      </p>
      {q.measurements?.map((m) => {
        const fail = m.actual < m.lower || m.actual > m.upper;
        const parameter =
          m.featureId === "hole-x"
            ? `装夹 X 偏移 ${p.fixtureOffsetXmm} mm → 钻孔基准同量偏移`
            : m.featureId === "outer-diameter"
              ? `直径补偿误差 ${p.contourDiameterErrorMm} mm → 轮廓尺寸变化`
              : `${p.skipDeburr ? "跳过去毛刺" : "执行去毛刺"} → 残余高度 ${m.actual} mm`;
        return (
          <p key={m.featureId} className={fail ? "red" : "subtle"}>
            {parameter} → {m.label} {m.actual} mm（允许 {m.lower}–{m.upper}）→{" "}
            {fail ? "超差隔离" : "符合规格"}
          </p>
        );
      })}
      <small>
        以上是已知输入在仿真规则中的因果解释。真实设备还需量具校准、刀具磨损、热变形等证据，不能直接据此认定现场根因。
      </small>
    </section>
  );
}
