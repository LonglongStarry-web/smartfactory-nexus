import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  initialState,
  tick,
  assign,
  inject,
  createMaintenance,
  restore,
  addOrder,
  event,
} from "../simulation/engine";
import type {
  SimulationState,
  ProductionOrder,
  Mode,
  Algorithm,
} from "../domain/types";
interface Store {
  s: SimulationState;
  page: string;
  selected: string;
  toast: string;
  theme: string;
  update: (f: (s: SimulationState) => void) => void;
  notify: (t: string) => void;
  nav: (p: string) => void;
  select: (id: string) => void;
  toggle: () => void;
  step: () => void;
  reset: (scene?: string) => void;
  fault: (id: string, k: string) => void;
  repair: (id: string) => void;
  finish: (id: string) => void;
  check: (id: string, i: number) => void;
  order: (
    x: Pick<
      ProductionOrder,
      "product" | "quantity" | "priority" | "planned" | "due"
    >,
  ) => void;
  mode: (m: Mode) => void;
  algorithm: (a: Algorithm) => void;
  setTheme: () => void;
}
export const useFactory = create<Store>()(
  persist(
    (set, get) => ({
      s: initialState(),
      page: location.hash.slice(1) || "dashboard",
      selected: "CNC-01",
      toast: "",
      theme: "dark",
      update: (f) =>
        set((state) => {
          const s = structuredClone(state.s);
          f(s);
          return { s };
        }),
      notify: (t) => {
        set({ toast: t });
        setTimeout(() => set({ toast: "" }), 3500);
      },
      nav: (page) => {
        location.hash = page;
        set({ page });
      },
      select: (selected) => set({ selected }),
      toggle: () =>
        get().update((s) => {
          s.running = !s.running;
          event(
            s,
            s.running ? "开始加工" : "暂停",
            s.running ? "生产模拟启动" : "生产模拟已暂停",
          );
          assign(s);
        }),
      step: () => {
        if (get().s.running) get().update((s) => tick(s, s.speed));
      },
      reset: (scene = "normal") => {
        const s = initialState();
        if (scene !== "normal") {
          s.running = true;
          tick(s, 120);
          if (scene === "fault") inject(s, "CNC-01", "温度异常");
          if (scene === "urgent")
            addOrder(s, {
              product: "应急法兰 U-01",
              quantity: 30,
              priority: 0,
              planned: s.time,
              due: s.time + 450,
            });
        }
        set({ s, selected: "CNC-01" });
        get().notify("演示场景已重置");
      },
      fault: (id, k) => {
        get().update((s) => inject(s, id, k));
        get().notify(`${id} 异常已注入，排产已更新`);
      },
      repair: (id) => {
        get().update((s) => createMaintenance(s, id));
        get().notify("维修工单已创建");
      },
      finish: (id) => {
        try {
          get().update((s) => restore(s, id));
          get().notify("设备恢复，维修记录已保存");
        } catch (e) {
          get().notify((e as Error).message);
        }
      },
      check: (id, i) =>
        get().update((s) => {
          const w = s.maintenance.find(
            (w) => w.deviceId === id && w.completed === undefined,
          );
          if (w) w.steps[i] = !w.steps[i];
        }),
      order: (x) => {
        get().update((s) => addOrder(s, x));
        get().notify("订单已保存，调度重新计算");
      },
      mode: (mode) =>
        get().update((s) => {
          s.mode = mode;
          event(s, "运行模式", `模式切换至 ${mode}`);
          assign(s);
        }),
      algorithm: (algorithm) =>
        get().update((s) => {
          s.algorithm = algorithm;
          event(s, "调度策略", `策略切换至 ${algorithm}`);
          assign(s);
        }),
      setTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    {
      name: "nexus-simulation-v1",
      partialize: (state) => ({
        s: { ...state.s, running: false },
        theme: state.theme,
      }),
      version: 1,
    },
  ),
);
