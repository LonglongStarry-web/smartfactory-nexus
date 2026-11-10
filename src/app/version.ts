import packageInfo from "../../package.json";
export const APP_VERSION = packageInfo.version;
export interface Release {
  version: string;
  notes: string[];
}
const pattern = /^\d+\.\d+\.\d+$/;
export function compareVersions(a: string, b: string) {
  if (!pattern.test(a) || !pattern.test(b)) throw Error("版本号格式无效");
  const aa = a.split(".").map(Number),
    bb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (aa[i] !== bb[i]) return Math.sign(aa[i] - bb[i]);
  }
  return 0;
}
export async function checkRelease(signal?: AbortSignal): Promise<Release> {
  const response = await fetch("/version.json", {
    cache: "no-store",
    signal,
  });
  if (!response.ok)
    throw Error(`版本清单暂不可用（HTTP ${response.status}），请稍后重试。`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw Error("版本清单格式无效。");
  const release = data as Release;
  if (
    typeof release.version !== "string" ||
    !pattern.test(release.version) ||
    !Array.isArray(release.notes) ||
    !release.notes.every((n) => typeof n === "string")
  )
    throw Error("版本清单格式无效。");
  return { version: release.version, notes: release.notes };
}
