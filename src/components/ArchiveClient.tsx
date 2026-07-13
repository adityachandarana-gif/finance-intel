"use client";

import { useState, useEffect, useCallback } from "react";
import { ArticleCard } from "@/components/ArticleCard";
import type { SectionGroup, Section, Article } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

export function ArchiveClient({
  initialGroups,
  initialSections,
}: {
  initialGroups: SectionGroup[];
  initialSections: Section[];
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filteredSections = selectedGroup
    ? initialSections.filter((s) => s.group_id === selectedGroup)
    : initialSections;

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("articles")
        .select("*", { count: "exact" })
        .order("published_at", { ascending: false })
        .range(from, to);

      // Apply section filter
      if (selectedSection) {
        query = query.eq("section_id", selectedSection);
      } else if (selectedGroup) {
        const sectionIds = initialSections
          .filter((s) => s.group_id === selectedGroup)
          .map((s) => s.id);
        if (sectionIds.length > 0) {
          query = query.in("section_id", sectionIds);
        }
      }

      // Apply date filters
      if (dateFrom) {
        query = query.gte("published_at", dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt("published_at", endDate.toISOString().split("T")[0]);
      }

      // Apply text search
      if (search.trim()) {
        query = query.textSearch("search_vector", search.trim(), {
          type: "websearch",
        });
      }

      const { data, count, error } = await query;

      if (error) throw error;
      setArticles(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Archive fetch error:", err);
      setArticles([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, selectedGroup, selectedSection, dateFrom, dateTo, search, initialSections]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedGroup, selectedSection, dateFrom, dateTo, search]);

  // Reset section when group changes
  useEffect(() => {
    setSelectedSection("");
  }, [selectedGroup]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const getSectionForArticle = (sectionId: string) =>
    initialSections.find((s) => s.id === sectionId);

  return (
    <div className="app-container">
      <div className="archive-header">
        <h1>📚 Archive</h1>
        <p>Browse and search all articles across the entire history.</p>
      </div>

      {/* Filters */}
      <div className="archive-filters">
        <input
          type="text"
          className="filter-input"
          placeholder="🔍 Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          id="archive-search"
        />
        <select
          className="filter-select"
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          id="archive-group-filter"
        >
          <option value="">All Groups</option>
          {initialGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.icon} {group.display_name}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value)}
          id="archive-section-filter"
        >
          <option value="">All Sections</option>
          {filteredSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.display_name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="filter-date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          id="archive-date-from"
          title="From date"
        />
        <input
          type="date"
          className="filter-date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          id="archive-date-to"
          title="To date"
        />
      </div>

      {/* Results info */}
      <div className="results-info">
        {loading ? (
          "Loading..."
        ) : (
          <>
            Found <strong>{totalCount}</strong> article
            {totalCount !== 1 ? "s" : ""}
            {search && (
              <>
                {" "}
                matching &ldquo;<strong>{search}</strong>&rdquo;
              </>
            )}
          </>
        )}
      </div>

      {/* Articles */}
      {loading ? (
        <div className="articles-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="loading-skeleton skeleton-card" />
          ))}
        </div>
      ) : articles.length > 0 ? (
        <div className="articles-grid">
          {articles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              section={getSectionForArticle(article.section_id)}
              index={index}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>No articles found</h3>
          <p>Try adjusting your filters or search terms.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Previous
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (page <= 4) {
              pageNum = i + 1;
            } else if (page >= totalPages - 3) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = page - 3 + i;
            }
            return (
              <button
                key={pageNum}
                className={`pagination-btn ${page === pageNum ? "active" : ""}`}
                onClick={() => setPage(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
