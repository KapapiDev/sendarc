import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildCanonical, DOWNLOAD_ROUTE, KAPAPI_SENDARC_URL, KAPAPI_URL, SUPPORT_EMAIL } from "../../src/lib/site";
import { json, text, abuseHash } from "../../functions/api/_shared";
import { onRequestPost as submitBeta } from "../../functions/api/business-beta";

describe("site configuration", () => {
  it("builds stable canonical URLs", () => {
    expect(buildCanonical(new URL("https://example.com/base/"), "/privacy/")).toBe("https://example.com/privacy/");
    expect(DOWNLOAD_ROUTE).toBe("/download/");
    expect(SUPPORT_EMAIL).toBe("maxtop9843@gmail.com");
    expect(KAPAPI_URL).toBe("https://kapapi.dev/");
    expect(KAPAPI_SENDARC_URL).toBe("https://kapapi.dev/sendarc/");
  });

  it("bounds submitted text", () => expect(text("  abcdef  ", 4)).toBe("abcd"));

  it("returns no-store JSON", async () => {
    const response = json({ ok: true }, 201);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("hashes an address without retaining the raw value", async () => {
    const request = new Request("https://example.com", { headers: { "CF-Connecting-IP": "203.0.113.9" } });
    const hash = await abuseHash(request, "test-salt", "events", 3600);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("203.0.113.9");
  });

  it("fails closed when beta storage is unavailable", async () => {
    const request = new Request("https://example.com/api/business-beta", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const response = await submitBeta({ request, env: {} });
    expect(response.status).toBe(503);
  });

  it("routes production API requests through Pages Functions", () => {
    const routesPath = fileURLToPath(new URL("../../public/_routes.json", import.meta.url));
    const routes = JSON.parse(readFileSync(routesPath, "utf8")) as { include: string[]; exclude: string[] };
    expect(routes.include).toContain("/api/*");
    expect(routes.exclude).not.toContain("/*");
  });
});
