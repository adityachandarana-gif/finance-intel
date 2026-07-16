import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Types ────────────────────────────────────────────────────────────

export interface SectionGroup {
  id: string;
  display_name: string;
  icon: string;
  sort_order: number;
}

export interface Section {
  id: string;
  group_id: string;
  display_name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Article {
  id: string;
  title: string;
  source: string;
  original_url: string;
  published_at: string;
  fetched_at: string;
  section_id: string;
  relevance_score: number;
  brief_summary: string;
  detailed_summary: string;
  why_it_matters: string;
}

export interface RunLog {
  id: string;
  run_at: string;
  articles_pulled: number;
  articles_kept: number;
  articles_discarded: number;
  feeds_failed: number;
  llm_errors: number;
  duration_seconds: number | null;
  errors: string[];
}

// ── Data Fetching ────────────────────────────────────────────────────

export async function getSectionGroups(): Promise<SectionGroup[]> {
  const { data, error } = await supabase
    .from('section_groups')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function getSections(): Promise<Section[]> {
  const { data, error } = await supabase
    .from('sections')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function getTodayArticles(sectionIds?: string[]): Promise<Article[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let query = supabase
    .from('articles')
    .select('*')
    .gte('fetched_at', today.toISOString())
    .order('relevance_score', { ascending: false })
    .order('published_at', { ascending: false });

  if (sectionIds && sectionIds.length > 0) {
    query = query.in('section_id', sectionIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getRecentArticles(
  sectionIds?: string[],
  limit: number = 250
): Promise<Article[]> {
  // Get articles from last 48 hours if no articles today
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 48);

  let query = supabase
    .from('articles')
    .select('*')
    .gte('fetched_at', cutoff.toISOString())
    .order('relevance_score', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit);

  if (sectionIds && sectionIds.length > 0) {
    query = query.in('section_id', sectionIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getArticleById(id: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function getRelatedArticles(
  sectionId: string,
  excludeId: string,
  limit: number = 5
): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('section_id', sectionId)
    .neq('id', excludeId)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

export async function getArchiveArticles(params: {
  sectionIds?: string[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ articles: Article[]; count: number }> {
  const { sectionIds, search, dateFrom, dateTo, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .order('published_at', { ascending: false })
    .range(from, to);

  if (sectionIds && sectionIds.length > 0) {
    query = query.in('section_id', sectionIds);
  }
  if (dateFrom) {
    query = query.gte('published_at', dateFrom);
  }
  if (dateTo) {
    query = query.lte('published_at', dateTo);
  }
  if (search) {
    query = query.textSearch('search_vector', search, { type: 'websearch' });
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { articles: data || [], count: count || 0 };
}

export async function getLatestRunLog(): Promise<RunLog | null> {
  const { data, error } = await supabase
    .from('run_logs')
    .select('*')
    .order('run_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
}
