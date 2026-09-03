import { json, rateLimited, readObject, type Env, type PagesFunction } from "./_shared";
import { campaignLabel, referrerHost, validEvent } from "../../src/lib/analytics";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SENDARC_DB || !env.ABUSE_HASH_SALT) return new Response(null, { status: 204 });
  const body = await readObject(request, 2048);
  if (!body || !validEvent(body.event, body.pathname)) return json({ message: "Invalid event." }, 400);
  if (await rateLimited(env.SENDARC_DB, request, env.ABUSE_HASH_SALT, "events", 180)) return new Response(null, { status: 204 });
  await env.SENDARC_DB.prepare("INSERT INTO site_events(event_name,pathname,referrer_host,utm_source,utm_campaign) VALUES(?,?,?,?,?)")
    .bind(body.event, body.pathname, referrerHost(body.referrerHost), campaignLabel(body.utmSource), campaignLabel(body.utmCampaign)).run();
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
};

export const onRequestGet: PagesFunction<Env> = async () => json({ message: "Method not allowed." }, 405);
