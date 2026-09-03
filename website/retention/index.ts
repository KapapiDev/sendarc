import type { ExportedHandler } from "@cloudflare/workers-types";

// No public HTTP handler. All cutoffs use the scheduled UTC time, so retries
// cannot delete newer records. Repeated runs are safe.
export default {
  async scheduled(controller, env) {
    const at = new Date(controller.scheduledTime).toISOString();
    const results = await env.SENDARC_DB.batch([
      env.SENDARC_DB.prepare("DELETE FROM abuse_windows WHERE window_start < ?")
        .bind(Math.floor(controller.scheduledTime / 1000) - 86400),
      env.SENDARC_DB.prepare("DELETE FROM site_events WHERE created_at <= strftime('%Y-%m-%dT%H:%M:%fZ', ?, '-90 days')").bind(at),
      env.SENDARC_DB.prepare("DELETE FROM business_leads WHERE updated_at <= strftime('%Y-%m-%dT%H:%M:%fZ', ?, '-12 months', 'floor')").bind(at),
    ]);
    // Counts only: never log lead fields, hashes or database error payloads.
    console.log(JSON.stringify({ event: "retention_complete", scheduledAt: at,
      abuseDeleted: results[0]?.meta.changes ?? 0,
      eventsDeleted: results[1]?.meta.changes ?? 0,
      leadsDeleted: results[2]?.meta.changes ?? 0 }));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
