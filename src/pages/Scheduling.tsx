import { useState } from "react";
import { Plus, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { useFactory } from "../store/useFactory";
import { schedule, stamp, event, assign } from "../simulation/engine";
import { Panel, Modal, Empty } from "../components/UI";
import type { ProductionOrder } from "../domain/types";
export default function Scheduling() {
  const f = useFactory();
  const [formTime, setFormTime] = useState(0);
  function openOrder(order: ProductionOrder | null) {
    setFormTime(f.s.time);
    setError("");
    setEdit(order);
  }
  const [edit, setEdit] = useState<ProductionOrder | null | undefined>(
      undefined,
    ),
    [filter, setFilter] = useState(""),
    [sort, setSort] = useState(false),
    [error, setError] = useState(""),
    [remove, setRemove] = useState<string>();
  const slots = schedule(f.s);
  const max = Math.max(f.s.time + 600, ...slots.map((x) => x.end));
  const compare = ["FCFS", "PRIORITY"].map((a) => {
    const ss = schedule(f.s, a as any);
    return {
      name: a,
      end: Math.max(f.s.time, ...ss.map((x) => x.end)),
      late: ss.filter((x) => x.late).length,
    };
  });
  const orders = f.s.orders
    .filter((o) => `${o.id}${o.product}`.includes(filter))
    .sort((a, b) => (sort ? a.priority - b.priority : a.created - b.created));
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const input = {
      product: String(data.get("product")),
      quantity: Number(data.get("quantity")),
      priority: Number(data.get("priority")),
      planned: formTime + Number(data.get("planned")) * 60,
      due: formTime + Number(data.get("due")) * 60,
    };
    try {
      if (edit) {
        if (
          input.quantity < edit.completed ||
          input.quantity < 1 ||
          !Number.isInteger(input.quantity) ||
          input.planned < 0 ||
          input.due <= input.planned
        )
          throw Error("数量不能小于已完成数量，交期必须晚于计划开始");
        f.update((s) => {
          Object.assign(
            s.orders.find((o) => o.id === edit.id)!,
            input,
          );
          const order = s.orders.find((o) => o.id === edit.id)!;
          if (order.completed < order.quantity) delete order.completedAt;
          event(s, "修改订单", `${edit.id} 更新数量、优先级与计划`);
          assign(s);
        });
      } else f.order(input);
      setEdit(undefined);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="breadcrumb">生产管理 / 规则调度</div>
          <h1>生产调度</h1>
          <p>两台并行加工中心 · 同一工件仅分配一次 · 故障设备自动退出排产</p>
        </div>
        <button className="primary" onClick={() => openOrder(null)}>
          <Plus size={16} /> 新增订单
        </button>
      </div>
      <div className="toolbar filterbar">
        <input
          aria-label="搜索订单"
          placeholder="搜索订单编号或产品"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span>调度规则</span>
        <select
          aria-label="调度规则"
          value={f.s.algorithm}
          onChange={(e) => f.algorithm(e.target.value as any)}
        >
          <option value="FCFS">先来先服务 FCFS</option>
          <option value="PRIORITY">紧急订单优先</option>
        </select>
        <button
          onClick={() =>
            f.update((s) => {
              assign(s);
              event(s, "重新排产", "手动重新计算排产");
            })
          }
        >
          重新排产
        </button>
      </div>
      <div className="two-columns">
        {compare.map((c) => (
          <div className="comparison" key={c.name}>
            <span>
              {c.name === "FCFS" ? "先来先服务" : "紧急订单优先"}{" "}
              <small>
                {f.s.algorithm === c.name ? "当前策略" : "对比策略"}
              </small>
            </span>
            <strong>{stamp(c.end)}</strong>
            <small>预计末单完工 · {c.late} 个订单延期</small>
          </div>
        ))}
      </div>
      <Panel
        title="生产甘特图"
        sub="相同订单、设备及速度约束 · 每件基础节拍 10 秒"
      >
        <div className="gantt">
          <div className="gantt-scale">
            <span>设备</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <time key={i}>
                {stamp(f.s.time + ((max - f.s.time) * i) / 4).slice(0, 5)}
              </time>
            ))}
          </div>
          {f.s.devices
            .filter((d) => d.kind === "cnc")
            .map((d) => (
              <div className="gantt-row" key={d.id}>
                <div>
                  <b>{d.id}</b>
                  <small>
                    {d.status === "fault" || d.status === "maintenance"
                      ? "停机 · 不参与排产"
                      : `任务负载 ${Math.round((slots.filter((x) => x.deviceId === d.id).reduce((a, x) => a + x.end - x.start, 0) / (max - f.s.time)) * 100)}%`}
                  </small>
                </div>
                <div className="gantt-track">
                  {slots
                    .filter((x) => x.deviceId === d.id)
                    .map((x) => (
                      <div
                        key={x.orderId}
                        title={`${x.orderId} ${stamp(x.start)}–${stamp(x.end)} ${x.quantity}件${x.late ? " 延期" : ""}`}
                        className={`gantt-slot ${x.late ? "late" : ""}`}
                        style={{
                          left: `${((x.start - f.s.time) / (max - f.s.time)) * 100}%`,
                          width: `${((x.end - x.start) / (max - f.s.time)) * 100}%`,
                        }}
                      >
                        {x.orderId}
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
        {!slots.length && (
          <Empty>当前无可排任务；请检查订单与设备可用状态。</Empty>
        )}
      </Panel>
      <Panel
        title="生产订单"
        sub={`${orders.length} 个订单 · 计划开始由订单指定；预计完工计入当前工件进度，受故障、插单和速度影响`}
        action={
          <button className="text-button" onClick={() => setSort(!sort)}>
            <ArrowUpDown size={14} /> {sort ? "按优先级" : "按创建时间"}
          </button>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>订单 / 产品</th>
                <th className="num">数量</th>
                <th>优先级</th>
                <th>进度</th>
                <th>计划开始</th>
                <th>完工时间</th>
                <th>交付期限</th>
                <th>设备</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const slot = slots.find((x) => x.orderId === o.id);
                const completedAt =
                  o.completedAt ??
                  f.s.events.find(
                    (e) => e.type === "完成订单" && e.orderId === o.id,
                  )?.time;
                return (
                  <tr key={o.id}>
                    <td>
                      <b>{o.id}</b>
                      <small>{o.product}</small>
                    </td>
                    <td className="num">{o.quantity}</td>
                    <td>
                      <select
                        aria-label={`${o.id} 优先级`}
                        value={o.priority}
                        disabled={o.cancelled || o.completed === o.quantity}
                        onChange={(e) =>
                          f.update((s) => {
                            s.orders.find((x) => x.id === o.id)!.priority =
                              +e.target.value;
                            event(s, "优先级变更", `${o.id} 优先级调整`);
                            assign(s);
                          })
                        }
                      >
                        <option value="0">紧急</option>
                        <option value="1">高</option>
                        <option value="2">普通</option>
                      </select>
                    </td>
                    <td>
                      {o.cancelled
                        ? "已取消"
                        : `${o.completed} / ${o.quantity}`}
                      <progress max={o.quantity} value={o.completed} />
                    </td>
                    <td className="order-time">
                      <time>{stamp(o.planned)}</time>
                      <small>订单计划</small>
                    </td>
                    <td className="order-time">
                      {o.cancelled ? (
                        <span className="subtle">已取消</span>
                      ) : o.completed === o.quantity ? (
                        <>
                          <time>
                            {completedAt === undefined
                              ? "—"
                              : stamp(completedAt)}
                          </time>
                          <small>
                            {completedAt === undefined
                              ? "已完成 · 历史时间未记录"
                              : "实际完工"}
                          </small>
                        </>
                      ) : slot ? (
                        <>
                          <time className={slot.late ? "red" : ""}>
                            {stamp(Math.ceil(slot.end - 1e-6))}
                          </time>
                          <small>
                            {slot.late ? "预计完工 · 延期" : "预计完工"}
                          </small>
                        </>
                      ) : (
                        <>
                          <span>待排产</span>
                          <small>当前无可用设备</small>
                        </>
                      )}
                    </td>
                    <td className="order-time">
                      <time>{stamp(o.due)}</time>
                      <small>承诺交付</small>
                    </td>
                    <td>{slot?.deviceId || "—"}</td>
                    <td>
                      <div className="toolbar">
                        <button
                          aria-label={`编辑 ${o.id}`}
                          disabled={o.cancelled}
                          onClick={() => openOrder(o)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          aria-label={`取消 ${o.id}`}
                          disabled={o.cancelled || o.completed === o.quantity}
                          onClick={() => setRemove(o.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!orders.length && <Empty>没有匹配订单，请更改搜索或创建订单。</Empty>}
      </Panel>
      {edit !== undefined && (
        <Modal
          title={edit ? "修改订单" : "新增生产订单"}
          onClose={() => setEdit(undefined)}
        >
          <form onSubmit={submit}>
            <label className="field">
              产品名称
              <input
                name="product"
                required
                maxLength={60}
                defaultValue={edit?.product || "应急法兰 U-01"}
              />
            </label>
            <div className="two-columns">
              <label className="field">
                数量 / 件
                <input
                  name="quantity"
                  type="number"
                  min={edit?.completed || 1}
                  max={10000}
                  required
                  defaultValue={edit?.quantity || 30}
                />
              </label>
              <label className="field">
                优先级
                <select name="priority" defaultValue={edit?.priority ?? 0}>
                  <option value="0">紧急</option>
                  <option value="1">高</option>
                  <option value="2">普通</option>
                </select>
              </label>
            </div>
            <div className="two-columns">
              <label className="field">
                计划开始 / 距今分钟
                <input
                  name="planned"
                  type="number"
                  min={edit ? undefined : 0}
                  step="any"
                  defaultValue={edit ? (edit.planned - formTime) / 60 : 0}
                  required
                />
              </label>
              <label className="field">
                交期 / 距今分钟
                <input
                  name="due"
                  type="number"
                  min={edit ? undefined : 1}
                  step="any"
                  defaultValue={edit ? (edit.due - formTime) / 60 : 15}
                  required
                />
              </label>
            </div>
            {error && (
              <p role="alert" className="red">
                {error}
              </p>
            )}
            <p className="subtle">
              将立即重新计算调度，不同规则不会改变实际设备能力。
            </p>
            <button className="primary" type="submit">
              保存订单并排产
            </button>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal title="取消订单" onClose={() => setRemove(undefined)}>
          <p>取消 {remove} 的剩余任务？已完成工件与质检历史会保留。</p>
          <button
            className="danger"
            onClick={() => {
              f.update((s) => {
                s.orders.find((o) => o.id === remove)!.cancelled = true;
                event(s, "取消订单", `${remove} 已取消`);
                assign(s);
              });
              setRemove(undefined);
            }}
          >
            确认取消订单
          </button>
        </Modal>
      )}
    </>
  );
}
