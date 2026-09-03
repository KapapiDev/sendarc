import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { abuseHash, readObject, type Env } from "../../functions/api/_shared";
import { onRequestPost as eventPost } from "../../functions/api/events";
import { onRequestPost as betaPost } from "../../functions/api/business-beta";
import { campaignLabel, referrerFromURL, referrerHost, validEvent } from "../../src/lib/analytics";
import retention from "../../retention/index";

const post = (body: unknown) => new Request("https://example.com/api/test", {
  method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9" }, body: JSON.stringify(body),
});
const lead = () => ({ email: "synthetic@example.com", company: "Test only", seats: "2-5", workflow: "affixa", startedAt: Date.now() - 2000 });
// These schema files contain only simple statements, not triggers or literals
// with semicolons. Production migrations use Wrangler's migration runner.
const migrationSQL = (name: string) => readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8")
  .replace(/--[^\n]*/g, "").split(";").map((sql) => sql.trim()).filter(Boolean);

describe("privacy boundaries", () => {
  it("accepts coarse campaign labels only", () => {
    expect(campaignLabel("affixa_search-2026")).toBe("affixa_search-2026");
    for (const value of ["a@b.com", "https://x.com", "secret=value", "a".repeat(65), {}, null]) expect(campaignLabel(value)).toBe("");
  });
  it("removes referrer paths and queries before transmission", () => {
    expect(referrerFromURL("https://search.example.com/private?token=secret#person")).toBe("search.example.com");
    for (const value of ["https://example.com/?secret", "person@example.com", "127.0.0.1", "example.com/path"]) expect(referrerHost(value)).toBe("");
    expect(referrerFromURL("file:///private/user.txt")).toBe("");
  });
  it("does not accept arbitrary paths or client-declared saved leads", () => {
    expect(validEvent("landing_view", "/")).toBe(true);
    expect(validEvent("download_cta", "/docs/")).toBe(true);
    for (const path of ["/?token=secret", "/person@example.com/", "//evil.com/", "/unknown/"]) expect(validEvent("download_cta", path)).toBe(false);
    expect(validEvent("business_beta_submit", "/")).toBe(false);
    expect(validEvent("landing_view", "/download/")).toBe(false);
  });
  it("rotates and separates abuse hashes by hour, endpoint and secret", async () => {
    const request = post({});
    const a = await abuseHash(request, "test-secret", "events", 3600);
    expect(a).toBe(await abuseHash(request, "test-secret", "events", 3600));
    expect(a).not.toBe(await abuseHash(request, "test-secret", "events", 7200));
    expect(a).not.toBe(await abuseHash(request, "test-secret", "business-beta", 3600));
    expect(a).not.toBe(await abuseHash(request, "other-secret", "events", 3600));
  });
  it("bounds even chunked JSON and rejects non-object payloads", async () => {
    for (const body of [null, [], "text", 1]) expect(await readObject(post(body), 100)).toBeNull();
    expect(await readObject(post({ note: "a".repeat(100) }), 32)).toBeNull();
    expect(await readObject(post({ ok: true }), 32)).toEqual({ ok: true });
  });
});

describe("real local D1 privacy and retention", () => {
  let platform: PlatformProxy<Cloudflare.Env>;
  let env: Env;
  beforeAll(async () => {
    platform = await getPlatformProxy<Cloudflare.Env>({ configPath: "retention/wrangler.jsonc", persist: false, remoteBindings: false, envFiles: [] });
    env = { ...platform.env, ABUSE_HASH_SALT: "test-only-not-a-production-secret" };
    for (const name of ["0001_business_beta.sql", "0002_privacy_retention.sql"]) {
      const statements = migrationSQL(name);
      await platform.env.SENDARC_DB.batch(statements.map((sql) => platform.env.SENDARC_DB.prepare(sql)));
    }
  }, 30000);
  beforeEach(async () => {
    const db = platform.env.SENDARC_DB;
    await db.batch(["DELETE FROM business_leads", "DELETE FROM site_events", "DELETE FROM abuse_windows"].map((sql) => db.prepare(sql)));
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await platform?.dispose(); });

  it("stores an event without a visitor identifier or unsafe fields", async () => {
    const response = await eventPost({ env, request: post({ event: "landing_view", pathname: "/", referrerHost: "search.example.com", referrer: "https://example.com?token=secret", utmSource: "search", utmCampaign: "person@example.com", subject: "private" }) });
    expect(response.status).toBe(204);
    const db = platform.env.SENDARC_DB;
    const row = await db.prepare("SELECT * FROM site_events").first();
    expect(row).toMatchObject({ referrer_host: "search.example.com", utm_source: "search", utm_campaign: "", visitor_hash: "" });
    expect(JSON.stringify(row)).not.toMatch(/private|secret|person@|203\.0/);
    expect(await db.prepare("SELECT count(*) AS n FROM abuse_windows").first("n")).toBe(1);
  });
  it("does not store malformed, oversized, arbitrary-path or forged submit events", async () => {
    for (const body of [null, [], { event: "business_beta_submit", pathname: "/" }, { event: "landing_view", pathname: "/?token=x" }, { event: "landing_view", pathname: "/", extra: "a".repeat(3000) }]) {
      expect((await eventPost({ env, request: post(body) })).status).toBe(400);
    }
    expect(await platform.env.SENDARC_DB.prepare("SELECT count(*) AS n FROM site_events").first("n")).toBe(0);
  });
  it("fails closed without a private abuse key", async () => {
    expect((await betaPost({ env: platform.env, request: post(lead()) })).status).toBe(503);
    expect((await eventPost({ env: platform.env, request: post({ event: "landing_view", pathname: "/" }) })).status).toBe(204);
    expect(await platform.env.SENDARC_DB.prepare("SELECT count(*) AS n FROM abuse_windows").first("n")).toBe(0);
  });
  it("counts saved submissions only; honeypot and invalid attempts do not count", async () => {
    expect((await betaPost({ env, request: post({ ...lead(), website: "spam" }) })).status).toBe(200);
    expect((await betaPost({ env, request: post({ ...lead(), email: "bad" }) })).status).toBe(400);
    expect((await betaPost({ env, request: post({ ...lead(), utmSource: "search", utmCampaign: "private@example.com" }) })).status).toBe(201);
    const db = platform.env.SENDARC_DB;
    expect(await db.prepare("SELECT count(*) AS n FROM business_leads").first("n")).toBe(1);
    const events = await db.prepare("SELECT * FROM site_events").all();
    expect(events.results).toHaveLength(1);
    expect(events.results[0]).toMatchObject({ event_name: "business_beta_submit", utm_source: "search", utm_campaign: "", visitor_hash: "" });
    expect(JSON.stringify(events.results)).not.toContain("synthetic@example.com");
  });
  it("keeps the lead and success event atomic when storage fails", async () => {
    const db = platform.env.SENDARC_DB;
    await db.prepare("CREATE TRIGGER fail_event BEFORE INSERT ON site_events BEGIN SELECT RAISE(ABORT, 'test failure'); END").run();
    try {
      await expect(betaPost({ env, request: post(lead()) })).rejects.toThrow();
      expect(await db.prepare("SELECT count(*) AS n FROM business_leads").first("n")).toBe(0);
    } finally { await db.prepare("DROP TRIGGER fail_event").run(); }
  });
  it("enforces eight saved requests per hour even under concurrency", async () => {
    const responses = await Promise.all(Array.from({ length: 10 }, () => betaPost({ env, request: post(lead()) })));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(8);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(2);
    expect(await platform.env.SENDARC_DB.prepare("SELECT count(*) AS n FROM site_events").first("n")).toBe(8);
  });
  it("deletes expired records, preserves fresh and recently updated leads, and is idempotent", async () => {
    const db = platform.env.SENDARC_DB;
    const scheduledTime = Date.parse("2026-09-04T00:17:00.000Z");
    const cutoff = scheduledTime / 1000 - 86400;
    for (const [i, at] of ["2025-09-04T00:16:59.999Z", "2025-09-04T00:17:00.000Z", "2025-09-04T00:17:00.001Z", "2026-09-03T00:00:00.000Z"].entries()) {
      await db.prepare("INSERT INTO business_leads(email,company,seats_range,current_workflow,created_at,updated_at) VALUES(?,'test','1','other','2024-01-01T00:00:00.000Z',?)").bind(`test-${i}@example.com`, at).run();
    }
    for (const delta of [-1, 0, 1]) {
      await db.prepare("INSERT INTO site_events(event_name,pathname,created_at) VALUES('landing_view','/',?)").bind(new Date(scheduledTime - 90 * 86400000 + delta).toISOString()).run();
      await db.prepare("INSERT INTO abuse_windows(visitor_hash,endpoint,window_start) VALUES(?,'events',?)").bind(`synthetic-${delta}`, cutoff + delta).run();
    }
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const controller = { scheduledTime, cron: "17 * * * *", noRetry() {} };
    await retention.scheduled(controller, platform.env);
    expect(await db.prepare("SELECT count(*) AS n FROM business_leads").first("n")).toBe(2);
    expect(await db.prepare("SELECT count(*) AS n FROM site_events").first("n")).toBe(1);
    expect(await db.prepare("SELECT count(*) AS n FROM abuse_windows").first("n")).toBe(2);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({ abuseDeleted: 1, eventsDeleted: 2, leadsDeleted: 2 });
    await retention.scheduled(controller, platform.env);
    expect(JSON.parse(String(log.mock.calls[1]?.[0]))).toMatchObject({ abuseDeleted: 0, eventsDeleted: 0, leadsDeleted: 0 });
  });
  it("handles a leap-day 12-month cutoff without deleting March records", async () => {
    const db = platform.env.SENDARC_DB;
    for (const [i, at] of ["2023-02-28T12:00:00.000Z", "2023-03-01T00:00:00.000Z"].entries()) {
      await db.prepare("INSERT INTO business_leads(email,company,seats_range,current_workflow,updated_at) VALUES(?,'test','1','other',?)").bind(`leap-${i}@example.com`, at).run();
    }
    vi.spyOn(console, "log").mockImplementation(() => {});
    await retention.scheduled({ scheduledTime: Date.parse("2024-02-29T12:00:00Z"), cron: "17 * * * *", noRetry() {} }, platform.env);
    expect(await db.prepare("SELECT count(*) AS n FROM business_leads").first("n")).toBe(1);
  });
  it("scrubs legacy event identifiers without deleting event counts", async () => {
    const db = platform.env.SENDARC_DB;
    await db.prepare("INSERT INTO site_events(event_name,pathname,visitor_hash) VALUES('landing_view','/','old-stable-identifier')").run();
    await db.batch(migrationSQL("0002_privacy_retention.sql").map((statement) => db.prepare(statement)));
    expect(await db.prepare("SELECT visitor_hash FROM site_events").first("visitor_hash")).toBe("");
    expect(await db.prepare("SELECT count(*) AS n FROM site_events").first("n")).toBe(1);
  });
});
