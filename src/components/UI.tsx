import { useEffect, useRef, type ReactNode } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { X, ArrowUpRight } from "lucide-react";
import { statusText } from "../simulation/engine";
import type { Status } from "../domain/types";
import { useAppearance } from "../hooks/useAppearance";
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);
export function Panel({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          {sub && <small>{sub}</small>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function Stat({
  label,
  value,
  unit,
  sub,
  onClick,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <button className="stat" onClick={onClick} disabled={!onClick}>
      <span>
        {label}
        {onClick && <ArrowUpRight size={13} />}
      </span>
      <strong>
        {value}
        <em>{unit}</em>
      </strong>
      <small>{sub}</small>
    </button>
  );
}
export function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge ${status}`}>
      <i />
      {statusText[status]}
    </span>
  );
}
export function Chart({
  option,
  height = 190,
}: {
  option: any;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts>(null);
  const { theme, accentColor } = useAppearance();
  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current);
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      c.dispose();
    };
  }, []);
  useEffect(() => {
    chart.current?.setOption(
      {
        textStyle: {
          fontFamily: "Segoe UI, Microsoft YaHei, sans-serif",
          color: theme === "dark" ? "#94A3B8" : "#526379",
          fontSize: 11,
        },
        color: [accentColor, "#7c96ae", "#34D399", "#FB7185"],
        tooltip: {
          trigger: "axis",
          backgroundColor: theme === "dark" ? "#18263A" : "#fff",
          borderWidth: 0,
          textStyle: { color: theme === "dark" ? "#E8EEF7" : "#15243a" },
        },
        grid: { left: 40, right: 18, top: 20, bottom: 28 },
        ...option,
      },
      true,
    );
  }, [option, theme, accentColor]);
  return <div ref={ref} className="chart" style={{ height }} />;
}
export function lineOption(
  xs: string[],
  series: { name: string; values: number[] }[],
  unit = "",
) {
  return {
    xAxis: {
      type: "category",
      data: xs,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: "value",
      name: unit,
      splitNumber: 3,
      minInterval: unit === "件" ? 1 : undefined,
      axisLabel: { color: "#94A3B8" },
      splitLine: { lineStyle: { color: "#26364a" } },
    },
    series: series.map((s, i) => ({
      type: "line",
      name: s.name,
      data: s.values,
      showSymbol: false,
      lineStyle: { width: 2, type: i ? "dashed" : "solid" },
    })),
  };
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          aria-label="关闭对话框"
          className="icon-button"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
