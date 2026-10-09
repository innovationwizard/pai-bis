-- ============================================================================
-- Migration 079: schema mercadeo
-- ============================================================================
-- Read model for the five Mercadeo pages. Spec: docs/handoff-mercadeo-build.md
-- and docs/pai-bis.md.
--
-- Run this once, by hand, in the Supabase SQL editor. This session has no
-- DATABASE_URL and no psql, and it does not apply the file.
--
-- After it commits:
--   1. Project Settings → Data API → Exposed schemas: add mercadeo.
--      The NOTIFY at the bottom reloads PostgREST. It does not expose the
--      schema by itself.
--   2. From the repo root: python3 scripts/mercadeo/load.py
--
-- This file does not drop or rewrite schema ventas, reservations, créditos,
-- entregas, or the old sales-feed tables. It does not read ventas.v_sale.
-- The pages join that view at read time through pipedrive_deal_id.
--
-- Primary keys are UUID v7, supplied here for the six cost centers and by
-- the load for every fact. No key defaults to gen_random_uuid().
-- ============================================================================

DO $pre$
BEGIN
  IF to_regprocedure('public.jwt_role()') IS NULL THEN
    RAISE EXCEPTION
      'public.jwt_role() is missing. Migration 040 has to be applied first.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'mercadeo') THEN
    RAISE EXCEPTION
      'schema mercadeo already exists. This migration is the initial store, not a patch.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    RAISE EXCEPTION
      'Supabase roles authenticated, service_role, and authenticator are required.';
  END IF;
END
$pre$;

CREATE SCHEMA mercadeo;

COMMENT ON SCHEMA mercadeo IS
  'Read model for the five Mercadeo pages. master, torredecontrol, gerencia, ventas, and marketing may select. Those five may update lead_range. The load writes facts with the service role. Sales stay in ventas.v_sale.';

-- ---------------------------------------------------------------------------
-- Cost centers. Puerta Abierta is not a building.
-- ---------------------------------------------------------------------------

CREATE TABLE mercadeo.cost_center (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL UNIQUE,
  is_building boolean NOT NULL,
  CONSTRAINT cost_center_slug_present CHECK (btrim(slug) <> ''),
  CONSTRAINT cost_center_name_present CHECK (btrim(name) <> '')
);

COMMENT ON TABLE mercadeo.cost_center IS
  'Five buildings plus Puerta Abierta. Puerta Abierta is its own cost center and is never added into a building total.';

CREATE TABLE mercadeo.lead_range (
  cost_center_id uuid PRIMARY KEY REFERENCES mercadeo.cost_center (id) ON DELETE RESTRICT,
  min_leads integer,
  max_leads integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_range_pair CHECK (
    (min_leads IS NULL AND max_leads IS NULL)
    OR (min_leads IS NOT NULL AND max_leads IS NOT NULL AND min_leads >= 0 AND min_leads <= max_leads)
  )
);

COMMENT ON TABLE mercadeo.lead_range IS
  'Current monthly lead range for one cost center. Both ends empty means there is no meta. A change applies to every month on screen. There is no history. The actual compared with this range is Meta Clientes potenciales only.';

-- ---------------------------------------------------------------------------
-- Facts
-- ---------------------------------------------------------------------------

CREATE TABLE mercadeo.ad_day (
  id uuid PRIMARY KEY,
  platform text NOT NULL,
  cost_center_id uuid NOT NULL REFERENCES mercadeo.cost_center (id) ON DELETE RESTRICT,
  account_name text NOT NULL,
  campaign_name text NOT NULL,
  day date NOT NULL,
  currency text NOT NULL,
  spend numeric(18,2) NOT NULL,
  impressions numeric(18,2) NOT NULL,
  reach numeric(18,2),
  clicks numeric(18,2) NOT NULL,
  leads numeric(18,2) NOT NULL,
  lead_forms numeric(18,2) NOT NULL,
  CONSTRAINT ad_day_platform CHECK (platform IN ('meta', 'google')),
  CONSTRAINT ad_day_currency CHECK (currency IN ('GTQ', 'USD')),
  CONSTRAINT ad_day_campaign_present CHECK (btrim(campaign_name) <> ''),
  CONSTRAINT ad_day_amounts CHECK (
    spend >= 0 AND impressions >= 0 AND clicks >= 0 AND leads >= 0 AND lead_forms >= 0
    AND (reach IS NULL OR reach >= 0)
  ),
  CONSTRAINT ad_day_grain UNIQUE (platform, cost_center_id, campaign_name, day)
);

COMMENT ON TABLE mercadeo.ad_day IS
  'One platform, account, campaign, and day. Meta comes from the performance workbook. Google comes from the Google Ads export. leads is Meta Clientes potenciales and is zero on a Google row. lead_forms is Google form submits and is zero on a Meta row. The lead meta and the CPL do not read lead_forms. USD stays USD. The page converts it at 7.80.';

CREATE INDEX ad_day_center_day ON mercadeo.ad_day (cost_center_id, day);

CREATE TABLE mercadeo.budget_month (
  id uuid PRIMARY KEY,
  cost_center_id uuid NOT NULL REFERENCES mercadeo.cost_center (id) ON DELETE RESTRICT,
  line_code text NOT NULL,
  month_start date NOT NULL,
  presupuestado numeric(18,2),
  real_gtq numeric(18,2),
  CONSTRAINT budget_month_line CHECK (
    line_code IN ('meta', 'google', 'tiktok', 'linkedin', 'pauta_digital', 'wati')
  ),
  CONSTRAINT budget_month_first CHECK (month_start = date_trunc('month', month_start)::date),
  CONSTRAINT budget_month_amounts CHECK (
    (presupuestado IS NULL OR presupuestado >= 0)
    AND (real_gtq IS NULL OR real_gtq >= 0)
  ),
  CONSTRAINT budget_month_grain UNIQUE (cost_center_id, line_code, month_start)
);

COMMENT ON TABLE mercadeo.budget_month IS
  'One pauta line, cost center, and month, already in quetzales. real_gtq null means sin ejecución and is not a zero. Meta and Google spend on the pages come from ad_day. This real is the finance booking and is not that spend. TikTok, LinkedIn, Pauta Digital, and Wati have no day, so their real is the actual.';

CREATE TABLE mercadeo.deal_attribution (
  id uuid PRIMARY KEY,
  pipedrive_deal_id text NOT NULL,
  platform text NOT NULL,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  form_id text,
  form_name text,
  lead_id text,
  taken_from text NOT NULL,
  CONSTRAINT deal_attribution_platform CHECK (platform IN ('meta', 'tiktok')),
  CONSTRAINT deal_attribution_from CHECK (taken_from IN ('deal', 'person')),
  CONSTRAINT deal_attribution_deal_present CHECK (btrim(pipedrive_deal_id) <> ''),
  CONSTRAINT deal_attribution_grain UNIQUE (pipedrive_deal_id, platform)
);

COMMENT ON TABLE mercadeo.deal_attribution IS
  'Campaign, ad set, and ad copied onto a Pipedrive deal. Meta fields start 10 September 2025. When the deal campaign id and the person campaign id both exist and differ, taken_from is deal. When the deal campaign id is empty and the person has one, taken_from is person. TikTok is the deal only. A sale joins ventas.v_sale through pipedrive_deal_id. Spend is not on this row.';

CREATE INDEX deal_attribution_campaign ON mercadeo.deal_attribution (platform, campaign_name);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

REVOKE ALL ON SCHEMA mercadeo FROM PUBLIC;
GRANT USAGE ON SCHEMA mercadeo TO authenticator, authenticated, service_role;

ALTER TABLE mercadeo.cost_center ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercadeo.lead_range ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercadeo.ad_day ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercadeo.budget_month ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercadeo.deal_attribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY mercadeo_select_cost_center ON mercadeo.cost_center
  FOR SELECT TO authenticated
  USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia', 'ventas', 'marketing'));

CREATE POLICY mercadeo_select_lead_range ON mercadeo.lead_range
  FOR SELECT TO authenticated
  USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia', 'ventas', 'marketing'));

CREATE POLICY mercadeo_update_lead_range ON mercadeo.lead_range
  FOR UPDATE TO authenticated
  USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia', 'ventas', 'marketing'))
  WITH CHECK (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia', 'ventas', 'marketing'));

CREATE POLICY mercadeo_select_ad_day ON mercadeo.ad_day
  FOR SELECT TO authenticated
  USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia', 'ventas', 'marketing'));

CREATE POLICY mercadeo_select_budget_month ON mercadeo.budget_month
  FOR SELECT TO authenticated
  USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia', 'ventas', 'marketing'));

CREATE POLICY mercadeo_select_deal_attribution ON mercadeo.deal_attribution
  FOR SELECT TO authenticated
  USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia', 'ventas', 'marketing'));

GRANT SELECT ON ALL TABLES IN SCHEMA mercadeo TO authenticated;
GRANT UPDATE ON mercadeo.lead_range TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mercadeo TO service_role;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA mercadeo FROM authenticated, anon, PUBLIC;
REVOKE UPDATE ON mercadeo.cost_center, mercadeo.ad_day, mercadeo.budget_month, mercadeo.deal_attribution
  FROM authenticated, anon, PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA mercadeo
  GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA mercadeo
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

-- ---------------------------------------------------------------------------
-- Structural members and the initial lead ranges. Not a measured fact.
-- ---------------------------------------------------------------------------

INSERT INTO mercadeo.cost_center (id, slug, name, sort_order, is_building) VALUES
  ('01a122e5-99a2-7211-92b2-8a204d024f7a', 'benestare', 'Benestare', 1, true),
  ('01a122e5-99a2-7cc9-b96a-301cfd6d5a1d', 'bosque-las-tapias', 'Bosque Las Tapias', 2, true),
  ('01a122e5-99a2-7223-a6f7-fddf495a05a6', 'boulevard-5', 'Boulevard 5', 3, true),
  ('01a122e5-99a2-713a-851b-4eccefe5144a', 'casa-elisa', 'Casa Elisa', 4, true),
  ('01a122e5-99a2-70f7-9ce1-cdad047b0dad', 'santa-elena', 'Santa Elena', 5, true),
  ('01a122e5-99a2-77e1-94c6-c91bd2cb2418', 'puerta-abierta', 'Puerta Abierta', 6, false);

INSERT INTO mercadeo.lead_range (cost_center_id, min_leads, max_leads) VALUES
  ('01a122e5-99a2-7211-92b2-8a204d024f7a', 350, 400),
  ('01a122e5-99a2-7cc9-b96a-301cfd6d5a1d', 250, 300),
  ('01a122e5-99a2-7223-a6f7-fddf495a05a6', 150, 200),
  ('01a122e5-99a2-713a-851b-4eccefe5144a', NULL, NULL),
  ('01a122e5-99a2-70f7-9ce1-cdad047b0dad', 50, 100),
  ('01a122e5-99a2-77e1-94c6-c91bd2cb2418', NULL, NULL);

NOTIFY pgrst, 'reload schema';
