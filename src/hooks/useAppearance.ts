import { useSyncExternalStore } from "react";
import { useFactory } from "../store/useFactory";
import { accents } from "../app/preferences";
const subscribe = (callback: () => void) => {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const snapshot = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;
export function useAppearance() {
  const theme = useFactory((s) => s.theme);
  const accent = useFactory((s) => s.accent);
  const dark = useSyncExternalStore(subscribe, snapshot, () => true);
  const resolved = theme === "system" ? (dark ? "dark" : "light") : theme;
  return { theme: resolved, accentColor: accents[accent][resolved] };
}
