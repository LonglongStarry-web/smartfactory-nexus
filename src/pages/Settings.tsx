import { useEffect, useRef, useState } from "react";
import {
  Check,
  RefreshCw,
  Download,
  RotateCcw,
  Monitor,
  Sun,
  Moon,
  ArrowUpRight,
} from "lucide-react";
import { useFactory } from "../store/useFactory";
import {
  accents,
  fontSizes,
  type Accent,
  type ThemeMode,
  type FontSize,
} from "../app/preferences";
import {
  APP_VERSION,
  checkRelease,
  compareVersions,
  type Release,
} from "../app/version";
import { Panel, Modal } from "../components/UI";
import { download } from "../utils/download";
export default function Settings() {
  const f = useFactory();
  const [confirm, setConfirm] = useState(false),
    [checking, setChecking] = useState(false),
    [release, setRelease] = useState<Release>(),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );
  async function check() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setError("");
    setRelease(undefined);
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await checkRelease(controller.signal);
      if (request.current !== controller) return;
      setRelease(result);
    } catch (e) {
      if (request.current === controller)
        setError(
          controller.signal.aborted
            ? "版本检查超时，请确认当前服务可访问后重试。"
            : e instanceof Error
              ? e.message
              : "版本检查失败，请重试。",
        );
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        setChecking(false);
        request.current = null;
      }
    }
  }
  const difference = release
    ? compareVersions(release.version, APP_VERSION)
    : 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="breadcrumb">工作空间 / 偏好与版本</div>
          <h1>系统设置</h1>
          <p>配置立即生效并保存在当前浏览器，刷新后保留。</p>
        </div>
        <span className="settings-saved">
          <Check size={14} /> 本地自动保存
        </span>
      </div>
      <div className="settings-layout">
        <section className="settings-section">
          <div className="settings-description">
            <h2>版本与更新</h2>
            <p>检查当前部署所提供的版本清单。尚未配置远程发布服务。</p>
          </div>
          <Panel
            title="SmartFactory Nexus"
            sub="智造未来 · 工业智能制造课程原型"
            action={<span className="release-channel">课程原型</span>}
          >
            <div className="settings-content">
              <div className="version-summary">
                <div>
                  <span>当前版本</span>
                  <strong>v{APP_VERSION}</strong>
                </div>
                <button className="primary" onClick={check} disabled={checking}>
                  <RefreshCw
                    size={15}
                    className={checking ? "checking-icon" : ""}
                  />
                  {checking ? "正在检查…" : "检查更新"}
                </button>
              </div>
              <p className="settings-help">
                更新来源：当前服务器的 <code>version.json</code>
                。此操作核对发布版本，不会自动下载或修改本地源码。
              </p>
              {error && (
                <div role="alert" className="notice warning">
                  {error}
                </div>
              )}
              {release && (
                <div className="release-result" role="status">
                  <b>
                    {difference > 0
                      ? `发现新版本 v${release.version}`
                      : difference < 0
                        ? "当前版本领先于部署清单"
                        : "当前已是部署清单中的最新版本"}
                  </b>
                  <ul>
                    {release.notes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                  {difference > 0 && (
                    <>
                      <p>
                        请先更新本地文件或服务器部署，再重新载入。当前模拟记录已在本地保存，重载后默认暂停。
                      </p>
                      <button onClick={() => window.location.reload()}>
                        重新载入应用
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </section>
        <section className="settings-section">
          <div className="settings-description">
            <h2>外观与主题</h2>
            <p>
              选择适合工作环境的明暗模式和主题色。设备的正常、维修与故障色保持独立。
            </p>
          </div>
          <Panel
            title="工作界面"
            sub="主题色同步应用到导航重点、操作与图表主序列"
          >
            <div className="settings-content">
              <fieldset className="setting-fieldset">
                <legend>明暗模式</legend>
                <div className="theme-options">
                  {(
                    [
                      ["dark", "深色", Moon],
                      ["light", "浅色", Sun],
                      ["system", "跟随系统", Monitor],
                    ] as const
                  ).map(([value, label, Icon]) => (
                    <button
                      key={value}
                      aria-pressed={f.theme === value}
                      className={f.theme === value ? "selected" : ""}
                      onClick={() =>
                        f.appearance({ theme: value as ThemeMode })
                      }
                    >
                      <Icon size={16} />
                      {label}
                      {f.theme === value && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="setting-fieldset">
                <legend>主题色</legend>
                <div className="accent-options">
                  {(
                    Object.entries(accents) as [Accent, typeof accents.cyan][]
                  ).map(([value, accent]) => (
                    <button
                      key={value}
                      aria-label={`主题色：${accent.name}`}
                      aria-pressed={f.accent === value}
                      className={f.accent === value ? "selected" : ""}
                      onClick={() => f.appearance({ accent: value })}
                    >
                      <i style={{ background: accent.dark }} />
                      {accent.name}
                      {f.accent === value && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="appearance-preview" aria-label="主题效果预览">
                <div>
                  <b>当前主题：{accents[f.accent].name}</b>
                  <small>导航、按钮、图表与进度条同步应用。</small>
                </div>
                <button className="primary" onClick={() => f.nav("dashboard")}>
                  查看驾驶舱 <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <b>界面字号</b>
                  <small>调整页面和图表文字大小，设置自动保存。</small>
                </div>
                <select
                  aria-label="界面字号"
                  value={f.preferences.fontSize}
                  onChange={(e) =>
                    f.setPreferences({ fontSize: e.target.value as FontSize })
                  }
                >
                  {Object.entries(fontSizes).map(([value, size]) => (
                    <option key={value} value={value}>
                      {size.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="setting-row">
                <div>
                  <b>表格密度</b>
                  <small>调整订单、质检与事件表格的行距。</small>
                </div>
                <select
                  aria-label="表格密度"
                  value={f.preferences.density}
                  onChange={(e) =>
                    f.setPreferences({
                      density: e.target.value as "compact" | "comfortable",
                    })
                  }
                >
                  <option value="compact">紧凑</option>
                  <option value="comfortable">舒适</option>
                </select>
              </div>
              <div className="setting-row">
                <div>
                  <b>减少界面动效</b>
                  <small>
                    关闭控件过渡，相机直接定位；设备仍按生产状态运行。
                  </small>
                </div>
                <input
                  aria-label="减少界面动效"
                  type="checkbox"
                  checked={f.preferences.reducedMotion}
                  onChange={(e) =>
                    f.setPreferences({ reducedMotion: e.target.checked })
                  }
                />
              </div>
            </div>
          </Panel>
        </section>
        <section className="settings-section">
          <div className="settings-description">
            <h2>车间与演示</h2>
            <p>
              为投屏和不同性能的设备配置显示。这里的车间设置与三维页面保持同步。
            </p>
          </div>
          <Panel title="三维显示与模拟偏好">
            <div className="settings-content">
              <div className="setting-row">
                <div>
                  <b>三维车间画质</b>
                  <small>低画质减少像素密度并关闭动态、接触阴影。</small>
                </div>
                <select
                  aria-label="三维车间画质"
                  value={f.preferences.lowQuality ? "low" : "standard"}
                  onChange={(e) =>
                    f.setPreferences({ lowQuality: e.target.value === "low" })
                  }
                >
                  <option value="standard">标准画质</option>
                  <option value="low">低画质</option>
                </select>
              </div>
              <div className="setting-row">
                <div>
                  <b>显示设备标签</b>
                  <small>在三维车间中显示设备编号与当前状态。</small>
                </div>
                <input
                  aria-label="显示设备标签"
                  type="checkbox"
                  checked={f.preferences.showLabels}
                  onChange={(e) =>
                    f.setPreferences({ showLabels: e.target.checked })
                  }
                />
              </div>
              <div className="setting-row">
                <div>
                  <b>默认模拟倍速</b>
                  <small>同时应用到当前模拟；重置演示后仍沿用此设置。</small>
                </div>
                <select
                  aria-label="默认模拟倍速"
                  value={f.preferences.defaultSpeed}
                  onChange={(e) =>
                    f.setPreferences({
                      defaultSpeed: Number(e.target.value) as 1 | 5 | 20,
                    })
                  }
                >
                  <option value="1">1×</option>
                  <option value="5">5×</option>
                  <option value="20">20×</option>
                </select>
              </div>
              <div className="settings-link">
                <button className="text-button" onClick={() => f.nav("twin")}>
                  在数字孪生车间查看效果 <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </Panel>
        </section>
        <section className="settings-section">
          <div className="settings-description">
            <h2>本地数据与偏好</h2>
            <p>
              备份生产记录与设置，或只恢复显示偏好。订单、故障和维修记录保留。
            </p>
          </div>
          <Panel title="当前浏览器工作空间">
            <div className="settings-content">
              <div className="setting-row">
                <div>
                  <b>导出完整备份</b>
                  <small>
                    {f.s.orders.length} 个订单 · {f.s.events.length} 条事件 ·
                    包含当前偏好。
                  </small>
                </div>
                <button
                  onClick={() => {
                    download(
                      "nexus-workspace-backup.json",
                      JSON.stringify(
                        {
                          version: APP_VERSION,
                          exportedAt: new Date().toISOString(),
                          simulation: f.s,
                          settings: {
                            theme: f.theme,
                            accent: f.accent,
                            ...f.preferences,
                          },
                        },
                        null,
                        2,
                      ),
                      "application/json",
                    );
                    f.notify("工作空间备份已导出");
                  }}
                >
                  <Download size={15} />
                  导出备份
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <b>恢复默认偏好</b>
                  <small>
                    恢复明暗模式、主题色、字号、画质、标签与默认倍速。
                  </small>
                </div>
                <button onClick={() => setConfirm(true)}>
                  <RotateCcw size={14} />
                  恢复默认设置
                </button>
              </div>
            </div>
          </Panel>
        </section>
      </div>
      {confirm && (
        <Modal title="恢复默认设置" onClose={() => setConfirm(false)}>
          <p>
            恢复深色、冰川青、标准字号、标准画质、设备标签和 5×
            默认倍速。订单、工件、告警和维修记录不会删除。
          </p>
          <button
            className="primary"
            onClick={() => {
              f.resetPreferences();
              setConfirm(false);
            }}
          >
            确认恢复默认设置
          </button>
        </Modal>
      )}
    </>
  );
}
