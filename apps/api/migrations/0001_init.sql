-- Predictive governance dashboard: initial schema.
-- Synthetic Uzbekistan public-sector data model. See docs/PLAN.md section 2.

CREATE TABLE regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name_uz TEXT NOT NULL,
  name_ru TEXT NOT NULL,
  name_en TEXT NOT NULL,
  population INTEGER NOT NULL,
  is_capital INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_id INTEGER REFERENCES regions(id),
  code TEXT NOT NULL UNIQUE,
  name_uz TEXT NOT NULL,
  name_ru TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sector TEXT NOT NULL CHECK (sector IN (
    'social_protection', 'utilities_water', 'utilities_power', 'transport',
    'healthcare', 'education', 'tax', 'land_cadastre'
  )),
  org_type TEXT NOT NULL CHECK (org_type IN ('ministry', 'municipal', 'soe', 'agency')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_agencies_region ON agencies(region_id);
CREATE INDEX idx_agencies_sector ON agencies(sector);

CREATE TABLE service_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL REFERENCES agencies(id),
  region_id INTEGER NOT NULL REFERENCES regions(id),
  category TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_person', 'online', 'call_center')),
  submitted_at TEXT NOT NULL,
  resolved_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'in_progress', 'resolved', 'rejected')),
  processing_days REAL,
  citizen_age_bracket TEXT CHECK (citizen_age_bracket IN ('18_29', '30_44', '45_59', '60_plus')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent'))
);
CREATE INDEX idx_sr_agency_date ON service_requests(agency_id, submitted_at);
CREATE INDEX idx_sr_region_date ON service_requests(region_id, submitted_at);

-- Pre-aggregated daily series. Forecasting/anomaly detection read from here,
-- never from raw service_requests, so recomputation cost stays bounded.
CREATE TABLE daily_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL REFERENCES agencies(id),
  region_id INTEGER NOT NULL REFERENCES regions(id),
  metric TEXT NOT NULL CHECK (metric IN (
    'requests_submitted', 'requests_resolved', 'avg_processing_days', 'complaints_count'
  )),
  metric_date TEXT NOT NULL,
  value REAL NOT NULL,
  UNIQUE(agency_id, metric, metric_date)
);
CREATE INDEX idx_dm_lookup ON daily_metrics(agency_id, metric, metric_date);

CREATE TABLE complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL REFERENCES agencies(id),
  region_id INTEGER NOT NULL REFERENCES regions(id),
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  submitted_at TEXT NOT NULL,
  resolved_at TEXT,
  sentiment_score REAL
);
CREATE INDEX idx_complaints_agency_date ON complaints(agency_id, submitted_at);

CREATE TABLE utility_consumption_monthly (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL REFERENCES agencies(id),
  region_id INTEGER NOT NULL REFERENCES regions(id),
  year_month TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('water', 'electricity', 'gas')),
  consumption_units REAL NOT NULL,
  billed_amount REAL NOT NULL,
  collected_amount REAL NOT NULL,
  arrears_amount REAL NOT NULL,
  meter_count INTEGER NOT NULL,
  UNIQUE(agency_id, region_id, year_month, service_type)
);
CREATE INDEX idx_ucm_agency_date ON utility_consumption_monthly(agency_id, year_month);

CREATE TABLE budget_spend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL REFERENCES agencies(id),
  region_id INTEGER REFERENCES regions(id),
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  category TEXT NOT NULL CHECK (category IN ('personnel', 'capex', 'maintenance', 'subsidies')),
  planned_amount REAL NOT NULL,
  actual_amount REAL NOT NULL
);
CREATE INDEX idx_budget_agency_period ON budget_spend(agency_id, year, quarter);

CREATE TABLE forecast_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('agency', 'region', 'national')),
  entity_id INTEGER,
  metric TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('holt_winters', 'ses')),
  params_json TEXT NOT NULL,
  horizon_days INTEGER NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  result_json TEXT NOT NULL,
  backtest_mape REAL
);
CREATE INDEX idx_forecast_lookup ON forecast_runs(entity_type, entity_id, metric, generated_at);

CREATE TABLE anomaly_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('agency', 'region')),
  entity_id INTEGER NOT NULL,
  metric TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('zscore', 'iqr')),
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  observed_value REAL NOT NULL,
  expected_value REAL NOT NULL,
  score REAL NOT NULL,
  threshold REAL NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'serious', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT
);
CREATE INDEX idx_anomaly_status ON anomaly_flags(status, severity);
CREATE INDEX idx_anomaly_entity ON anomaly_flags(entity_type, entity_id);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id_hash TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ministry_admin', 'municipal_viewer', 'soe_analyst')),
  region_id INTEGER REFERENCES regions(id),
  agency_id INTEGER REFERENCES agencies(id),
  locale_pref TEXT NOT NULL DEFAULT 'uz' CHECK (locale_pref IN ('uz', 'ru', 'en')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_hash TEXT
);

CREATE TABLE narrative_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  metric TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('uz', 'ru', 'en')),
  prompt_hash TEXT NOT NULL,
  narrative_text TEXT NOT NULL,
  grounding_json TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('model', 'template')),
  model TEXT,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity_type, entity_id, metric, locale, prompt_hash)
);
