-- ============================================================
-- Finance Intelligence Platform – Seed Data
-- Description: Populates section_groups and sections tables
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING
-- ============================================================

-- -----------------------------------------------------------
-- 1. Section Groups (main navigation tabs)
-- -----------------------------------------------------------
insert into section_groups (id, display_name, icon, sort_order) values
  ('markets_economy',     'Markets & Economy',       '📊', 1),
  ('deals_transactions',  'Deals & Transactions',    '💼', 2),
  ('research_investing',  'Research & Investing',     '🔍', 3),
  ('industry_regulation', 'Industry & Regulation',    '🏦', 4),
  ('strategy_ai_careers', 'Strategy, AI & Careers',   '🚀', 5)
on conflict (id) do nothing;

-- -----------------------------------------------------------
-- 2. Sections (sub-categories within each group)
-- -----------------------------------------------------------

-- ── Markets & Economy ────────────────────────────────────────
insert into sections (id, group_id, display_name, description, sort_order) values
  ('global_markets',
   'markets_economy',
   'Global Financial Markets',
   'Stock/bond markets, interest rates, inflation, central banks, commodities, forex',
   1),
  ('indian_economy',
   'markets_economy',
   'Indian Economy & Policy',
   'GDP, Union Budget, RBI, SEBI, NITI Aayog, GST, FDI, fiscal policy',
   2),
  ('economic_indicators',
   'markets_economy',
   'Economic Indicators',
   'CPI, WPI, PMI, IIP, unemployment data, macro indicators',
   3)
on conflict (id) do nothing;

-- ── Deals & Transactions ─────────────────────────────────────
insert into sections (id, group_id, display_name, description, sort_order) values
  ('private_equity',
   'deals_transactions',
   'Private Equity',
   'PE deals, buyouts, growth equity, fundraising, exits, distressed assets',
   1),
  ('venture_capital',
   'deals_transactions',
   'Venture Capital',
   'Startup funding rounds, VC funds, unicorns, venture debt',
   2),
  ('investment_banking',
   'deals_transactions',
   'Investment Banking',
   'M&A advisory, ECM/DCM, bulge bracket, boutique banks',
   3),
  ('ipo_capital_markets',
   'deals_transactions',
   'IPOs & Capital Markets',
   'IPOs, QIPs, rights issues, FPOs, public offerings',
   4),
  ('valuation_mechanics',
   'deals_transactions',
   'Valuation & Deal Mechanics',
   'DCF, LBO, comps, precedent transactions, deal multiples',
   5)
on conflict (id) do nothing;

-- ── Research & Investing ─────────────────────────────────────
insert into sections (id, group_id, display_name, description, sort_order) values
  ('equity_research',
   'research_investing',
   'Equity Research',
   'Sell-side/buy-side research, upgrades/downgrades, earnings calls',
   1),
  ('asset_management',
   'research_investing',
   'Asset Management & Hedge Funds',
   'Mutual funds, hedge fund strategies, portfolio managers, quant funds',
   2),
  ('sector_investing',
   'research_investing',
   'Sector-Specific Investing',
   'Fintech, healthcare, renewables, consumer, real estate, infrastructure',
   3)
on conflict (id) do nothing;

-- ── Industry & Regulation ────────────────────────────────────
insert into sections (id, group_id, display_name, description, sort_order) values
  ('banking_finserv',
   'industry_regulation',
   'Banking & Financial Services',
   'Banks, NBFCs, digital banking, UPI, credit growth',
   1),
  ('regulatory',
   'industry_regulation',
   'Regulatory & Structural',
   'SEBI AIF rules, FEMA, FDI policy, insider trading regulations',
   2),
  ('global_context',
   'industry_regulation',
   'Global Investing Context',
   'Global M&A trends, cross-border PE, emerging markets',
   3),
  ('companies_tracking',
   'industry_regulation',
   'Companies to Track',
   'Major banks, conglomerates, global financial institutions',
   4)
on conflict (id) do nothing;

-- ── Strategy, AI & Careers ───────────────────────────────────
insert into sections (id, group_id, display_name, description, sort_order) values
  ('consulting_strategy',
   'strategy_ai_careers',
   'Consulting & Strategy',
   'McKinsey, BCG, Bain, Big 4 insights and reports',
   1),
  ('ai_finance',
   'strategy_ai_careers',
   'AI + Finance',
   'AI in finance, fintech innovation, algo trading, generative AI',
   2),
  ('careers_recruiting',
   'strategy_ai_careers',
   'Career & Recruiting',
   'IB internships, PE analyst hiring, ER jobs, certifications',
   3),
  ('thought_leadership',
   'strategy_ai_careers',
   'People & Thought Leadership',
   'Industry leaders, investor letters, market commentary',
   4)
on conflict (id) do nothing;
