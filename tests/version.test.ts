import { describe, it, expect, vi, afterEach } from "vitest";
import { compareVersions, checkRelease } from "../src/app/version";
afterEach(() => vi.unstubAllGlobals());
describe("部署版本检查", () => {
  it("不返回或记录旧清单中的更新时间字段", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              version: "1.1.1",
              publishedAt: "old date",
              checkedAt: "old time",
              notes: ["说明"],
            }),
          ),
        ),
    );
    expect(await checkRelease()).toEqual({ version: "1.1.1", notes: ["说明"] });
  });
  it("按数字比较语义版本并拒绝异常格式", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.1.0", "1.1.0")).toBe(0);
    expect(compareVersions("1.0.9", "1.1.0")).toBe(-1);
    expect(() => compareVersions("latest", "1.0.0")).toThrow();
  });
  it("实际请求禁用缓存的发布清单", async () => {
    const release = {
      version: "1.2.0",
      notes: ["改进"],
    };
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(release)));
    vi.stubGlobal("fetch", fetcher);
    expect(await checkRelease()).toEqual(release);
    expect(fetcher).toHaveBeenCalledWith(
      "/version.json",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
  it("清单404和损坏数据不会被当成最新版本", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response('{"version":"hello"}')),
    );
    await expect(checkRelease()).rejects.toThrow("HTTP 404");
    await expect(checkRelease()).rejects.toThrow("格式无效");
  });
});
