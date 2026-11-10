import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaults,
  type Preferences,
  type ThemeMode,
  type Accent,
} from "../app/preferences";
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
import {
  restoreFactoryState,
  serializeFactoryState,
} from "../simulation/persistence";
interface Store {
  s: SimulationState;
  page: string;
  selected: string;
  toast: string;
  theme: ThemeMode;
  accent: Accent;
  preferences: Preferences;
  appearance: (patch: { theme?: ThemeMode; accent?: Accent }) => void;
  setPreferences: (patch: Partial<Preferences>) => void;
  resetPreferences: () => void;
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
      accent: "cyan",
      preferences: { ...defaults },
      appearance: (patch) => set(patch),
      setPreferences: (patch) =>
        set((state) => ({
          preferences: { ...state.preferences, ...patch },
          ...(patch.defaultSpeed === undefined
            ? {}
            : { s: { ...state.s, speed: patch.defaultSpeed } }),
        })),
      resetPreferences: () => {
        set((state) => ({
          theme: "dark",
          accent: "cyan",
          preferences: { ...defaults },
          s: { ...state.s, speed: defaults.defaultSpeed },
        }));
        get().notify("显示和演示偏好已恢复默认，生产记录已保留");
      },
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
        s.speed = get().preferences.defaultSpeed;
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
      setTheme: () => {
        const current = get().theme;
        const dark =
          current === "system"
            ? window.matchMedia("(prefers-color-scheme: dark)").matches
            : current === "dark";
        set({ theme: dark ? "light" : "dark" });
      },
    }),
    {
      name: "nexus-simulation-v1",
      partialize: (state) => ({
        s: serializeFactoryState(state.s),
        theme: state.theme,
        accent: state.accent,
        preferences: state.preferences,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<Store>;
        let s = current.s;
        let toast = "";
        if (saved.s) {
          try {
            s = restoreFactoryState(saved.s);
          } catch {
            toast = "生产存档无法读取，已恢复初始场景；显示偏好已保留";
          }
        }
        return {
          ...current,
          s,
          toast,
          theme: saved.theme ?? current.theme,
          accent: saved.accent ?? current.accent,
          preferences: { ...defaults, ...saved.preferences },
        };
      },
      version: 1,
    },
  ),
);
