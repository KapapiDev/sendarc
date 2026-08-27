import { json, rateLimited, text, visitorHash, type Env, type PagesFunction } from "./_shared";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEATS = new Set(["1", "2-5", "6-20", "21-50", "51-200", "201+"]);
const WORKFLOWS = new Set(["affixa", "mapi-bridge", "desktop-client", "other"]);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SENDARC_DB) return json({ message: "Beta storage is not configured yet." }, 503);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return json({ message: "Expected JSON." }, 415);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ message: "Invalid JSON." }, 400); }

  if (text(body.website, 200)) return json({ ok: true });
  const startedAt = Number(body.startedAt);
  if (!Number.isFinite(startedAt) || Date.now() - startedAt < 1500 || Date.now() - startedAt > 86400000) return json({ message: "Please reload and try again." }, 400);

  const email = text(body.email, 254).toLowerCase();
  const company = text(body.company, 120);
  const seats = text(body.seats, 20);
  const workflow = text(body.workflow, 40);
  const note = text(body.note, 1000);
  const utmSource = text(body.utmSource, 100);
  const utmCampaign = text(body.utmCampaign, 100);
  if (!EMAIL.test(email) || company.length < 2 || !SEATS.has(seats) || !WORKFLOWS.has(workflow)) return json({ message: "Check the required fields." }, 400);

  const hash = await visitorHash(request, env.ABUSE_HASH_SALT);
  if (await rateLimited(env.SENDARC_DB, hash, "business-beta", 8)) return json({ message: "Too many requests. Try again later." }, 429);

  await env.SENDARC_DB.prepare("INSERT INTO business_leads(email,company,seats_range,current_workflow,note,utm_source,utm_campaign) VALUES(?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),company=excluded.company,seats_range=excluded.seats_range,current_workflow=excluded.current_workflow,note=excluded.note,utm_source=excluded.utm_source,utm_campaign=excluded.utm_campaign")
    .bind(email, company, seats, workflow, note, utmSource, utmCampaign).run();
  return json({ ok: true }, 201);
};

export const onRequestGet: PagesFunction<Env> = async () => json({ message: "Method not allowed." }, 405);
