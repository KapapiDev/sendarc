-- Stop retaining identifiers in event history. The empty legacy column stays
-- for schema compatibility; current handlers never write it.
UPDATE site_events SET visitor_hash = '' WHERE visitor_hash <> '';
CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON business_leads(updated_at);
