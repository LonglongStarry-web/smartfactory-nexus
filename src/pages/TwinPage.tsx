import { useState } from "react";
import { Focus, RotateCcw, Tags, ChevronRight } from "lucide-react";
import { useFactory } from "../store/useFactory";
import Twin from "../features/digital-twin/Twin";
import DeviceDetail from "../components/DeviceDetail";
export default function TwinPage() {
  const f = useFactory();
  const [labels, setLabels] = useState(true),
    [low, setLow] = useState(false),
    [preset, setPreset] = useState(0),
    [focus, setFocus] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="breadcrumb">
            空间管控 <ChevronRight size={12} /> 柔性制造实验车间
          </div>
          <h1>数字孪生车间</h1>
          <p>程序化设备模型与实时业务状态联动 · 动画属于演示级运动</p>
        </div>
        <div className="toolbar">
          <button onClick={() => setLabels(!labels)}>
            <Tags size={15} />
            {labels ? "隐藏标签" : "显示标签"}
          </button>
          <button onClick={() => setLow(!low)}>
            {low ? "低画质" : "标准画质"}
          </button>
        </div>
      </div>
      <div className="twin-layout">
        <section className="full-scene panel">
          <div className="scene-tools">
            <button
              onClick={() => {
                setFocus(false);
                setPreset(preset + 1);
              }}
            >
              切换工厂视角
            </button>
            <button
              onClick={() => {
                setFocus(false);
                setPreset(preset + 3 - (preset % 3));
              }}
              aria-label="重置摄像机"
            >
              <RotateCcw size={16} />
            </button>
            <button onClick={() => setFocus(!focus)}>
              <Focus size={16} /> 聚焦设备
            </button>
          </div>
          <Twin labels={labels} low={low} preset={preset} focus={focus} />
          <div className="scene-hint">
            拖动旋转 · 右键平移 · 滚轮缩放 · 点击设备查看详情
          </div>
        </section>
        <aside>
          <label className="field">
            选择设备
            <select
              value={f.selected}
              onChange={(e) => f.select(e.target.value)}
            >
              {f.s.devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} · {d.name}
                </option>
              ))}
            </select>
          </label>
          <DeviceDetail />
        </aside>
      </div>
    </>
  );
}
