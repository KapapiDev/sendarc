import { json, rateLimited, text, visitorHash, type Env, type PagesFunction } from "./_shared";

const EVENTS = new Set(["landing_view", "affixa_view", "download_cta", "business_beta_cta", "business_beta_submit", "release_download"]);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SENDARC_DB) return new Response(null, { status: 204 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ message: "Invalid event." }, 400); }
  const event = text(body.event, 40);
  const pathname = text(body.pathname, 160);
  if (!EVENTS.has(event) || !pathname.startsWith("/")) return json({ message: "Invalid event." }, 400);
  const hash = await visitorHash(request, env.ABUSE_HASH_SALT);
  if (await rateLimited(env.SENDARC_DB, hash, "events", 180)) return new Response(null, { status: 204 });
  let referrerHost: string;
  try { referrerHost = body.referrer ? new URL(text(body.referrer, 300)).hostname.slice(0, 120) : ""; } catch { referrerHost = ""; }
  await env.SENDARC_DB.prepare("INSERT INTO site_events(event_name,pathname,referrer_host,utm_source,utm_campaign,visitor_hash) VALUES(?,?,?,?,?,?)")
    .bind(event, pathname, referrerHost, text(body.utmSource, 100), text(body.utmCampaign, 100), hash).run();
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
};

export const onRequestGet: PagesFunction<Env> = async () => json({ message: "Method not allowed." }, 405);
