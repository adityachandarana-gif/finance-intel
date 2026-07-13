-- ============================================================
-- Finance Intelligence Platform – Initial Schema
-- Migration: 001_initial_schema.sql
-- Description: Creates core tables, indexes, and RLS policies
-- ============================================================

-- -----------------------------------------------------------
-- Section groups (main navigation tabs in the UI)
-- -----------------------------------------------------------
create table section_groups (
  id text primary key,
  display_name text not null,
  icon text not null,
  sort_order int not null
);

-- -----------------------------------------------------------
-- Subsections (filters / categories within each tab)
-- -----------------------------------------------------------
create table sections (
  id text primary key,
  group_id text not null references section_groups(id),
  display_name text not null,
  description text,
  sort_order int not null,
  is_active boolean default true
);

-- -----------------------------------------------------------
-- Articles – the main content table
--   • dedup_hash  – content-based hash to prevent duplicates
--   • url_hash    – URL-based hash for fast lookup
--   • search_vector – auto-generated tsvector for full-text search
-- -----------------------------------------------------------
create table articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text not null,
  original_url text not null,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  section_id text not null references sections(id),
  relevance_score int not null check (relevance_score between 1 and 10),
  brief_summary text not null,
  detailed_summary text not null,
  why_it_matters text not null,
  dedup_hash text not null,
  url_hash text,
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(brief_summary,'') || ' ' || coalesce(detailed_summary,''))
  ) stored,
  unique(dedup_hash),
  unique(url_hash)
);

-- Composite index: fetch articles by section sorted newest-first
create index idx_articles_section_date on articles(section_id, published_at desc);

-- Index for the "latest articles" feed across all sections
create index idx_articles_fetched on articles(fetched_at desc);

-- GIN index powering full-text search
create index idx_articles_search on articles using gin(search_vector);

-- -----------------------------------------------------------
-- Run logs – audit trail for each pipeline execution
-- -----------------------------------------------------------
create table run_logs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  articles_pulled int not null default 0,
  articles_kept int not null default 0,
  articles_discarded int not null default 0,
  feeds_failed int not null default 0,
  llm_errors int not null default 0,
  duration_seconds float,
  errors text[] default '{}'
);

-- -----------------------------------------------------------
-- Row Level Security – enable on every table, allow public reads
-- The backend (service_role key) bypasses RLS for writes.
-- -----------------------------------------------------------
alter table section_groups enable row level security;
alter table sections enable row level security;
alter table articles enable row level security;
alter table run_logs enable row level security;

create policy "Public read access" on section_groups for select using (true);
create policy "Public read access" on sections for select using (true);
create policy "Public read access" on articles for select using (true);
create policy "Public read access" on run_logs for select using (true);
