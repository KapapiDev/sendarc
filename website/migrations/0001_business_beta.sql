CREATE TABLE IF NOT EXISTS business_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  company TEXT NOT NULL,
  seats_range TEXT NOT NULL,
  current_workflow TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS site_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  event_name TEXT NOT NULL,
  pathname TEXT NOT NULL,
  referrer_host TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  visitor_hash TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS abuse_windows (
  visitor_hash TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (visitor_hash, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON site_events(created_at);
CREATE INDEX IF NOT EXISTS idx_abuse_window_start ON abuse_windows(window_start);
