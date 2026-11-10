import { useEffect, useState, useRef } from "react";
import { Camera, CameraOff, Download, CheckCircle2 } from "lucide-react";
import { useFactory } from "../store/useFactory";
import { Panel, Badge } from "../components/UI";
import Twin from "../features/digital-twin/Twin";
import { event, stamp } from "../simulation/engine";
import { fontSizes } from "../app/preferences";
export default function AR() {
  const f = useFactory();
  const [camera, setCamera] = useState(false),
    [mode, setMode] = useState<"ar" | "3d">("3d"),
    [error, setError] = useState(""),
    [status, setStatus] = useState("摄像头未启动"),
    [checks, setChecks] = useState([false, false, false]);
  const frame = useRef<HTMLIFrameElement>(null);
  const d = f.s.devices.find((d) => d.id === f.selected)!;
  const work = f.s.maintenance.find(
    (w) => w.deviceId === d.id && w.completed === undefined,
  );
  useEffect(() => {
    setChecks([false, false, false]);
  }, [d.id]);
  useEffect(() => {
    function message(e: MessageEvent) {
      if (
        e.origin !== location.origin ||
        e.source !== frame.current?.contentWindow
      )
        return;
      if (e.data.type === "ar-status") setStatus(String(e.data.message));
      if (e.data.type === "ar-error") {
        setError(String(e.data.message));
        setCamera(false);
      }
    }
    window.addEventListener("message", message);
    return () => {
      window.removeEventListener("message", message);
      frame.current?.contentWindow?.postMessage(
        { type: "stop-ar" },
        location.origin,
      );
    };
  }, []);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { type: "device-state", device: { id: d.id, status: d.status } },
      location.origin,
    );
  }, [d.id, d.status, camera]);
  async function start() {
    setError("");
    setMode("ar");
    if (!window.isSecureContext) {
      setError(
        "摄像头需要 HTTPS 安全上下文。请通过 HTTPS 访问；手机局域网 HTTP 无法申请摄像头。",
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "当前浏览器不支持摄像头接口，请使用手机 Safari 或 Chrome，或进入普通三维维修演示。",
      );
      return;
    }
    setStatus("正在加载图像识别与申请摄像头…");
    setCamera(true);
  }
  const stepTitles = [
    "隔离设备并确认停止运行",
    "检查冷却回路、轴承与连接件",
    "确认防护与复位，申请恢复生产",
  ];
  const values = work?.steps || checks;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="breadcrumb">现场协同 / 设备巡检</div>
          <h1>AR 智能设备巡检</h1>
          <p>MindAR 图像目标识别 · 三维设备叠加 · 待手机实机验证</p>
        </div>
        <select
          aria-label="巡检设备"
          value={d.id}
          onChange={(e) => {
            setCamera(false);
            f.select(e.target.value);
          }}
        >
          {f.s.devices.map((x) => (
            <option key={x.id} value={x.id}>
              {x.id} · {x.name}
            </option>
          ))}
        </select>
      </div>
      <div className="notice">
        当前模式：
        {mode === "3d"
          ? "普通三维维修演示（无摄像头、无图像识别）"
          : "真实 WebAR 图像识别（需摄像头）"}
        。维修动作均为课程模拟确认。
      </div>
      <div className="ar-layout">
        <Panel
          title={mode === "3d" ? "设备三维检查" : "图像识别摄像头"}
          sub={mode === "ar" ? status : "选择设备，按步骤完成巡检"}
          action={<Badge status={d.status} />}
        >
          <div className="ar-viewport">
            {camera ? (
              <iframe
                ref={frame}
                title="MindAR 摄像头图像识别"
                src={`/ar/index.html?device=${encodeURIComponent(d.id)}&status=${d.status}&fontScale=${fontSizes[f.preferences.fontSize].scale}`}
                allow="camera; fullscreen"
              />
            ) : mode === "3d" ? (
              <Twin low focus labels={false} />
            ) : (
              <div className="camera-placeholder">
                <Camera size={36} />
                <p>{status}</p>
                <small>启动后对准下方设备识别图</small>
              </div>
            )}
          </div>
          <div className="toolbar wrap ar-controls">
            <button className="primary" onClick={start} disabled={camera}>
              <Camera size={16} /> 启动 AR 摄像头
            </button>
            <button
              disabled={!camera}
              onClick={() => {
                frame.current?.contentWindow?.postMessage(
                  { type: "stop-ar" },
                  location.origin,
                );
                setCamera(false);
                setStatus("摄像头已关闭");
              }}
            >
              <CameraOff size={16} /> 关闭摄像头
            </button>
            <button
              onClick={() => {
                setCamera(false);
                setMode("3d");
                setError("");
              }}
            >
              普通三维维修演示
            </button>
          </div>
          {error && (
            <p role="alert" className="notice warning">
              {error} 可切换普通三维维修演示继续课程流程。
            </p>
          )}
        </Panel>
        <Panel title="巡检与维修工单" sub={`${d.id} · ${d.name}`}>
          <dl>
            <div>
              <dt>当前工单</dt>
              <dd>{work?.id || "常规巡检"}</dd>
            </div>
            <div>
              <dt>巡检状态</dt>
              <dd>{values.filter(Boolean).length} / 3 项已确认</dd>
            </div>
          </dl>
          {d.status === "fault" && !work && (
            <button className="primary" onClick={() => f.repair(d.id)}>
              创建设备维修工单
            </button>
          )}
          <div className="steps">
            {stepTitles.map((t, i) => (
              <label key={t} className={values[i] ? "done" : ""}>
                <input
                  type="checkbox"
                  checked={values[i]}
                  onChange={() =>
                    work
                      ? f.check(d.id, i)
                      : setChecks(checks.map((v, n) => (n === i ? !v : v)))
                  }
                />
                <span>
                  <b>
                    {String(i + 1).padStart(2, "0")} {t}
                  </b>
                  <small>
                    {
                      [
                        "课程演示确认。实际设备必须由授权人员按现场规程执行。",
                        "对应当前异常的规则建议，检查异常参数与维护记录。",
                        "核对参数恢复，系统保存维修事件并重新排产。",
                      ][i]
                    }
                  </small>
                </span>
                {values[i] && <CheckCircle2 size={18} />}
              </label>
            ))}
          </div>
          <button
            className="primary wide"
            disabled={!values.every(Boolean)}
            onClick={() => {
              if (work) f.finish(d.id);
              else {
                f.update((s) =>
                  event(s, "巡检完成", `${d.id} 三项模拟巡检已确认`, d.id),
                );
                f.notify("巡检记录已保存");
                setChecks([false, false, false]);
              }
            }}
          >
            {work ? "完成维修并恢复生产" : "提交巡检记录"}
          </button>
          <p className="subtle">记录同步至统一事件日志。维修恢复会解除告警。</p>
        </Panel>
      </div>
      <div className="two-columns">
        <Panel title="设备识别图" sub="本项目自制高特征目标图 · 已编译 .mind">
          <div className="target-row">
            <img
              src="/ar-targets/equipment-target.png"
              alt="设备图像识别目标 CNC-01"
            />
            <div>
              <p>在另一块屏幕显示或打印此图，再用手机对准。</p>
              <a
                className="button"
                href="/ar-targets/equipment-target.png"
                download
              >
                <Download size={15} /> 下载识别图
              </a>
              <a
                className="text-button"
                href="/ar-targets/equipment.mind"
                download
              >
                下载 .mind 识别资源
              </a>
            </div>
          </div>
        </Panel>
        <Panel title="手机操作与兼容性" sub="桌面测试通过不代表手机识别通过">
          <ol className="instructions">
            <li>将项目部署到 HTTPS，手机访问同一地址的 #ar 页面。</li>
            <li>使用 Android Chrome 或 iOS Safari，允许摄像头权限。</li>
            <li>识别图保持完整、平整且光照充足，距离约 20–50 cm。</li>
            <li>成功识别后，简化设备模型随目标移动。完成三个确认步骤。</li>
            <li>
              切换页面或关闭摄像头会释放媒体流。拒绝权限时可用普通三维模式。
            </li>
          </ol>
          <p className="subtle">
            最近记录：
            {f.s.events.find(
              (e) => e.type === "巡检完成" || e.type === "设备恢复",
            )
              ? stamp(
                  f.s.events.find(
                    (e) => e.type === "巡检完成" || e.type === "设备恢复",
                  )!.time,
                )
              : "尚无巡检记录"}
          </p>
        </Panel>
      </div>
    </>
  );
}
