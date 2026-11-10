export type ThemeMode = "dark" | "light" | "system";
export type Accent = "cyan" | "blue" | "emerald" | "amber";
export type FontSize = "standard" | "medium" | "large" | "xlarge";
export const fontSizes: Record<FontSize, { name: string; scale: number }> = {
  standard: { name: "标准（100%）", scale: 1 },
  medium: { name: "较大（115%）", scale: 1.15 },
  large: { name: "大号（130%）", scale: 1.3 },
  xlarge: { name: "特大（145%）", scale: 1.45 },
};
export interface Preferences {
  lowQuality: boolean;
  showLabels: boolean;
  defaultSpeed: 1 | 5 | 20;
  reducedMotion: boolean;
  density: "compact" | "comfortable";
  fontSize: FontSize;
}
export const defaults: Preferences = {
  lowQuality: false,
  showLabels: true,
  defaultSpeed: 5,
  reducedMotion: false,
  density: "compact",
  fontSize: "standard",
};
export const accents: Record<
  Accent,
  { name: string; dark: string; light: string }
> = {
  cyan: { name: "冰川青", dark: "#22d3ee", light: "#087f98" },
  blue: { name: "远山蓝", dark: "#60a5fa", light: "#1d4ed8" },
  emerald: { name: "森林绿", dark: "#34d399", light: "#087f5b" },
  amber: { name: "琥珀金", dark: "#fbbf24", light: "#92400e" },
};
