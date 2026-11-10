import { lazy, Suspense, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Boxes,
  CalendarRange,
  ScanLine,
  Activity,
  Zap,
  Scan,
  ChartNoAxesCombined,
  Play,
  Pause,
  RotateCcw,
  Sun,
  Moon,
  Bell,
  Menu,
  X,
  ChevronDown,
  Factory,
  Check,
  Settings as SettingsIcon,
} from "lucide-react";
import { useFactory } from "./store/useFactory";
import { stamp } from "./simulation/engine";
import { Modal } from "./components/UI";
import { useAppearance } from "./hooks/useAppearance";
import { APP_VERSION } from "./app/version";
const pages = {
  dashboard: lazy(() => import("./pages/Dashboard")),
  twin: lazy(() => import("./pages/TwinPage")),
  scheduling: lazy(() => import("./pages/Scheduling")),
  quality: lazy(() => import("./pages/Quality")),
  health: lazy(() => import("./pages/Health")),
  energy: lazy(() => import("./pages/Energy")),
  ar: lazy(() => import("./pages/AR")),
  reports: lazy(() => import("./pages/Reports")),
  settings: lazy(() => import("./pages/Settings")),
};
const nav = [
  ["dashboard", "智能驾驶舱", LayoutDashboard],
  ["twin", "数字孪生车间", Boxes],
  ["scheduling", "生产调度", CalendarRange],
  ["quality", "质量检测", ScanLine],
  ["health", "设备健康", Activity],
  ["energy", "能耗管理", Zap],
  ["ar", "AR 智能巡检", Scan],
  ["reports", "数据分析与报告", ChartNoAxesCombined],
  ["settings", "系统设置", SettingsIcon],
] as const;
export default function App() {
  const f = useFactory();
  const { theme, accentColor, fontScale } = useAppearance();
  const [mobile, setMobile] = useState(false),
    [reset, setReset] = useState(false);
  const Page = pages[f.page as keyof typeof pages] || pages.dashboard;
  const alarms = f.s.alarms.filter((a) => !a.resolved).length;
  useEffect(() => {
    const interval = setInterval(() => useFactory.getState().step(0.1), 100);
    function change() {
      const page = location.hash.slice(1) || "dashboard";
      useFactory.setState({ page });
    }
    window.addEventListener("hashchange", change);
    return () => {
      clearInterval(interval);
      window.removeEventListener("hashchange", change);
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.setProperty("--cyan", accentColor);
    root.style.setProperty("--font-scale", String(fontScale));
    root.dataset.fontSize = f.preferences.fontSize;
    root.dataset.density = f.preferences.density;
    root.dataset.reducedMotion = String(f.preferences.reducedMotion);
  }, [
    theme,
    accentColor,
    fontScale,
    f.preferences.fontSize,
    f.preferences.density,
    f.preferences.reducedMotion,
  ]);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <svg
            width="32"
            height="34"
            viewBox="0 0 32 34"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 24V8l14-7 14 7v16l-14 8L2 24Z"
              stroke="var(--cyan)"
              strokeWidth="1.6"
            />
            <path
              d="m9 23 0-11 14 11V11M2 8l14 8 14-8M16 16v16"
              stroke="var(--cyan)"
              strokeWidth="1.2"
            />
          </svg>
          <div>
            SMARTFACTORY<span>NEXUS</span>
          </div>
          <button
            className="mobile-only icon-button"
            aria-label="关闭导航"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace">
          <Factory size={17} />
          <div>
            柔性制造实验车间<small>工业智能制造 · 课程原型</small>
          </div>
          <ChevronDown size={13} />
        </div>
        <small className="nav-group">车间协同管控</small>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={f.page === id ? "active" : ""}
              onClick={() => {
                f.nav(id);
                setMobile(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "health" && alarms > 0 && <b>{alarms}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="simulation-note">
            <span className="live-dot" /> 演示数据模式
            <p>
              浏览器本地模拟
              <br />
              未连接真实工业设备
            </p>
          </div>
          <div className="version">
            <span>NEXUS LAB</span>
            <small>v{APP_VERSION}</small>
          </div>
        </div>
      </aside>
      {mobile && (
        <div className="mobile-scrim" onClick={() => setMobile(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-only icon-button"
            aria-label="展开导航"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            智造未来 <span>/ 协同管控平台</span>
          </div>
          <div className="topbar-controls">
            <div className="clock">
              <small>模拟时间</small>
              <time>{stamp(f.s.time)}</time>
            </div>
            <button
              className={f.s.running ? "running-control" : "start-control"}
              onClick={f.toggle}
            >
              {f.s.running ? <Pause size={14} /> : <Play size={14} />}
              <span>{f.s.running ? "暂停模拟" : "开始生产"}</span>
            </button>
            <select
              aria-label="模拟倍速"
              value={f.s.speed}
              onChange={(e) =>
                f.update((s) => {
                  s.speed = +e.target.value;
                })
              }
            >
              <option value="1">1×</option>
              <option value="5">5×</option>
              <option value="20">20×</option>
            </select>
            <button
              aria-label={`告警 ${alarms} 项`}
              className="alarm-button"
              onClick={() => f.nav("health")}
            >
              <Bell size={17} />
              <span>{alarms}</span>
            </button>
            <button
              className="icon-button theme-button"
              aria-label="切换主题"
              onClick={f.setTheme}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="reset-button" onClick={() => setReset(true)}>
              <RotateCcw size={14} />
              <span>重置演示</span>
            </button>
          </div>
        </header>
        <main>
          <Suspense fallback={<div className="loading">正在加载工作区域…</div>}>
            <Page />
          </Suspense>
          <footer className="app-footer">
            <span>
              <i /> 统一状态引擎 · 本地存储
            </span>
            <span>SmartFactory Nexus · 工业智能制造系统设计与初步验证</span>
          </footer>
        </main>
      </div>
      {f.toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {f.toast}
        </div>
      )}
      {reset && (
        <Modal title="重置演示场景" onClose={() => setReset(false)}>
          <p>将替换当前浏览器内的模拟记录。选择一个可重复运行的初始场景。</p>
          <div className="stack">
            {[
              ["normal", "初始化正常生产（暂停）"],
              ["fault", "加载温度故障场景"],
              ["urgent", "加载紧急订单场景"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  f.reset(key);
                  setReset(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
