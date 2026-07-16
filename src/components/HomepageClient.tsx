"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArticleCard } from "@/components/ArticleCard";
import type { SectionGroup, Section, Article } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

// ── SVG Icon Map (replaces emoji — per skill: no emoji as structural icons) ──
const TAB_ICONS: Record<string, React.ReactElement> = {
  all: (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  markets: (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  india: (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  deals: (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  ),
  corporate: (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
  careers: (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  default: (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
};

function getTabIcon(groupId: string): React.ReactElement {
  const key = groupId.toLowerCase();
  for (const [k, icon] of Object.entries(TAB_ICONS)) {
    if (key.includes(k)) return icon;
  }
  return TAB_ICONS.default;
}

// ── Stat Bar ─────────────────────────────────────────────────────────
function StatBar({ total, groups, articles }: {
  total: number;
  groups: SectionGroup[];
  articles: Article[];
}) {
  const sources = new Set(articles.map(a => a.source)).size;
  const highRelevance = articles.filter(a => a.relevance_score >= 8).length;
  return (
    <div className="stat-bar animate-fade-in">
      <div className="stat-item">
        <div className="stat-value">{total}</div>
        <div className="stat-label">Articles</div>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <div className="stat-value">{groups.length}</div>
        <div className="stat-label">Sections</div>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <div className="stat-value">{sources}</div>
        <div className="stat-label">Sources</div>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <div className="stat-value">{highRelevance}</div>
        <div className="stat-label">High Relevance</div>
      </div>
    </div>
  );
}

// ── Tab Bar ──────────────────────────────────────────────────────────
function TabBar({
  groups,
  activeGroup,
  onSelect,
  articleCounts,
}: {
  groups: SectionGroup[];
  activeGroup: string;
  onSelect: (id: string) => void;
  articleCounts: Record<string, number>;
}) {
  return (
    <div className="tab-bar-container">
      <div className="tab-bar">
        <button
          id="tab-all"
          className={`tab-item ${activeGroup === "all" ? "active" : ""}`}
          onClick={() => onSelect("all")}
        >
          {TAB_ICONS.all}
          All
          {articleCounts["all"] > 0 && (
            <span className="tab-count">{articleCounts["all"]}</span>
          )}
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            id={`tab-${group.id}`}
            className={`tab-item ${activeGroup === group.id ? "active" : ""}`}
            onClick={() => onSelect(group.id)}
          >
            {getTabIcon(group.id)}
            {group.display_name}
            {(articleCounts[group.id] || 0) > 0 && (
              <span className="tab-count">{articleCounts[group.id]}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Subsection Filters ───────────────────────────────────────────────
function SubsectionFilters({
  sections,
  activeSubsection,
  onSelect,
}: {
  sections: Section[];
  activeSubsection: string;
  onSelect: (id: string) => void;
}) {
  if (sections.length === 0) return null;

  return (
    <div className="subsection-filters animate-fade-in">
      <button
        className={`subsection-pill ${activeSubsection === "all" ? "active" : ""}`}
        onClick={() => onSelect("all")}
      >
        All
      </button>
      {sections.map((section) => (
        <button
          key={section.id}
          className={`subsection-pill ${
            activeSubsection === section.id ? "active" : ""
          }`}
          onClick={() => onSelect(section.id)}
        >
          {section.display_name}
        </button>
      ))}
    </div>
  );
}

// ── Main Homepage ────────────────────────────────────────────────────
export function HomepageClient({
  initialGroups,
  initialSections,
  initialArticles,
}: {
  initialGroups: SectionGroup[];
  initialSections: Section[];
  initialArticles: Article[];
}) {
  const [groups] = useState(initialGroups);
  const [sections] = useState(initialSections);
  const [articles, setArticles] = useState(initialArticles);
  const [activeGroup, setActiveGroup] = useState("all");
  const [activeSubsection, setActiveSubsection] = useState("all");
  const [loading, setLoading] = useState(false);

  const groupSections = sections.filter((s) => s.group_id === activeGroup);

  const getActiveSectionIds = useCallback((): string[] => {
    if (activeGroup === "all") return [];
    if (activeSubsection !== "all") return [activeSubsection];
    return sections.filter((s) => s.group_id === activeGroup).map((s) => s.id);
  }, [activeGroup, activeSubsection, sections]);

  const articleCounts: Record<string, number> = { all: articles.length };
  groups.forEach((group) => {
    const groupSectionIds = sections
      .filter((s) => s.group_id === group.id)
      .map((s) => s.id);
    articleCounts[group.id] = articles.filter((a) =>
      groupSectionIds.includes(a.section_id)
    ).length;
  });

  const filteredArticles = (() => {
    const sectionIds = getActiveSectionIds();
    if (sectionIds.length === 0) return articles;
    return articles.filter((a) => sectionIds.includes(a.section_id));
  })();

  useEffect(() => {
    async function fetchArticles() {
      setLoading(true);
      try {
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - 48);

        const { data, error } = await supabase
          .from("articles")
          .select("*")
          .gte("fetched_at", cutoff.toISOString())
          .order("relevance_score", { ascending: false })
          .order("published_at", { ascending: false })
          .limit(250);

        if (!error && data) {
          setArticles(data);
        }
      } catch {
        // Use initial articles on error
      } finally {
        setLoading(false);
      }
    }

    if (initialArticles.length === 0) {
      fetchArticles();
    }
  }, [initialArticles.length]);

  const getSectionForArticle = (sectionId: string) =>
    sections.find((s) => s.id === sectionId);

  return (
    <>
      <TabBar
        groups={groups}
        activeGroup={activeGroup}
        onSelect={(id) => {
          setActiveGroup(id);
          setActiveSubsection("all");
        }}
        articleCounts={articleCounts}
      />

      {activeGroup !== "all" && (
        <SubsectionFilters
          sections={groupSections}
          activeSubsection={activeSubsection}
          onSelect={setActiveSubsection}
        />
      )}

      <div className="app-container">
        {loading ? (
          <div className="articles-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="loading-skeleton skeleton-card" />
            ))}
          </div>
        ) : filteredArticles.length > 0 ? (
          <>
            {activeGroup === "all" && (
              <StatBar
                total={articles.length}
                groups={groups}
                articles={articles}
              />
            )}
            <div className="results-info">
              Showing <strong>{filteredArticles.length}</strong> article
              {filteredArticles.length !== 1 ? "s" : ""}
              {activeGroup !== "all" && (
                <>
                  {" "}in{" "}
                  <strong>
                    {groups.find((g) => g.id === activeGroup)?.display_name}
                  </strong>
                </>
              )}
            </div>
            <div className="articles-grid">
              {filteredArticles.map((article, index) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  section={getSectionForArticle(article.section_id)}
                  index={index}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state animate-fade-in">
            <div className="empty-state-icon">
              {/* Satellite / signal icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12" y2="20"/>
              </svg>
            </div>
            <h3>No articles yet</h3>
            <p>
              The pipeline hasn&apos;t run yet, or no articles matched this
              filter. Articles are fetched twice daily at ~7:00 AM and ~7:00 PM IST.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
