import { Panel } from "../../components/UI";
import { useFactory } from "../../store/useFactory";
import { assign } from "../../simulation/engine";
export default function Capabilities() {
  const f = useFactory();
  return (
    <Panel
      title="加工能力与换型"
      sub="首次按法兰配置；切换产品需 6 个模拟秒。能力只能在单元无投料、无转运时调整。"
    >
      <div className="two-columns">
        {f.s.flow.cells.map((c) => {
          const busy = Boolean(
            c.activeId ||
            c.queue.length ||
            (f.s.flow.reroute &&
              (f.s.flow.reroute.from === c.id || f.s.flow.reroute.to === c.id)),
          );
          return (
            <div key={c.id} className="stack">
              <strong>
                {c.id} · {c.cncId}
              </strong>
              <div className="toolbar">
                {(["flange", "plate"] as const).map((family) => (
                  <label key={family}>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={(c.capabilities ?? ["flange", "plate"]).includes(
                        family,
                      )}
                      onChange={(e) =>
                        f.update((s) => {
                          const cell = s.flow.cells.find((x) => x.id === c.id)!;
                          cell.capabilities = e.target.checked
                            ? [
                                ...(cell.capabilities ?? ["flange", "plate"]),
                                family,
                              ]
                            : (cell.capabilities ?? ["flange", "plate"]).filter(
                                (x) => x !== family,
                              );
                          assign(s);
                        })
                      }
                    />
                    {family === "plate" ? "安装支架板" : "圆形法兰"}
                  </label>
                ))}
              </div>
              <small>
                {c.setup
                  ? `换型剩余 ${c.setup.remaining.toFixed(1)} 秒`
                  : `当前工装：${c.currentFamily === "plate" ? "安装板" : "法兰"}`}
                {busy ? " · 已锁定加工能力" : ""}
              </small>
              <small>{c.waitingReason || "按当前规则等待或加工"}</small>
            </div>
          );
        })}
      </div>
      {f.s.flow.reroute && (
        <p role="status">
          替代转运：{f.s.flow.reroute.workpieceId} · {f.s.flow.reroute.from} →{" "}
          {f.s.flow.reroute.to} · {f.s.flow.reroute.elapsed.toFixed(1)} /{" "}
          {f.s.flow.reroute.duration} 秒
        </p>
      )}
      {f.s.orders
        .filter(
          (o) =>
            !o.cancelled &&
            o.completed < o.quantity &&
            !f.s.flow.cells.some((c) =>
              (c.capabilities ?? ["flange", "plate"]).includes(
                o.recipeId ?? "flange",
              ),
            ),
        )
        .map((o) => (
          <p className="red" key={o.id}>
            {o.id} 没有兼容的加工单元，等待能力配置。
          </p>
        ))}
    </Panel>
  );
}
