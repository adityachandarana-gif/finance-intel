"use client";

import { useState, useEffect, useCallback } from "react";
import { ArticleCard } from "@/components/ArticleCard";
import type { SectionGroup, Section, Article } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

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
          className={`tab-item ${activeGroup === "all" ? "active" : ""}`}
          onClick={() => onSelect("all")}
        >
          <span className="tab-icon">🌐</span>
          All
          {articleCounts["all"] > 0 && (
            <span className="tab-count">{articleCounts["all"]}</span>
          )}
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            className={`tab-item ${activeGroup === group.id ? "active" : ""}`}
            onClick={() => onSelect(group.id)}
          >
            <span className="tab-icon">{group.icon}</span>
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
    <div className="subsection-filters">
      <button
        className={`subsection-pill ${activeSubsection === "all" ? "active" : ""}`}
        onClick={() => onSelect("all")}
      >
        All in group
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

  // Get sections for the active group
  const groupSections = sections.filter((s) => s.group_id === activeGroup);

  // Get the relevant section IDs for filtering
  const getActiveSectionIds = useCallback((): string[] => {
    if (activeGroup === "all") return [];
    if (activeSubsection !== "all") return [activeSubsection];
    return sections.filter((s) => s.group_id === activeGroup).map((s) => s.id);
  }, [activeGroup, activeSubsection, sections]);

  // Compute article counts per group
  const articleCounts: Record<string, number> = { all: articles.length };
  groups.forEach((group) => {
    const groupSectionIds = sections
      .filter((s) => s.group_id === group.id)
      .map((s) => s.id);
    articleCounts[group.id] = articles.filter((a) =>
      groupSectionIds.includes(a.section_id)
    ).length;
  });

  // Filter articles based on active selections
  const filteredArticles = (() => {
    const sectionIds = getActiveSectionIds();
    if (sectionIds.length === 0) return articles;
    return articles.filter((a) => sectionIds.includes(a.section_id));
  })();

  // Fetch fresh articles when needed
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
          .limit(100);

        if (!error && data) {
          setArticles(data);
        }
      } catch {
        // Use initial articles on error
      } finally {
        setLoading(false);
      }
    }

    // Only refetch if we don't have initial articles
    if (initialArticles.length === 0) {
      fetchArticles();
    }
  }, [initialArticles.length]);

  // Find section for each article
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
            <div className="results-info">
              Showing <strong>{filteredArticles.length}</strong> article
              {filteredArticles.length !== 1 ? "s" : ""}
              {activeGroup !== "all" && (
                <>
                  {" "}
                  in{" "}
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
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <h3>No articles yet</h3>
            <p>
              The pipeline hasn&apos;t run yet, or no articles matched this
              filter. Articles are fetched twice daily at ~7:00 AM and ~7:00 PM
              IST.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
