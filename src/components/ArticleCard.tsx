import Link from "next/link";
import type { Article, Section } from "@/lib/supabase";

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function ArticleCard({
  article,
  section,
  index = 0,
}: {
  article: Article;
  section?: Section;
  index?: number;
}) {
  const staggerClass = index <= 6 ? `stagger-${Math.min(index + 1, 6)}` : "";
  const isHighRelevance = article.relevance_score >= 8;

  return (
    <Link
      href={`/article/${article.id}`}
      className={`article-card animate-fade-in ${staggerClass}`}
      id={`article-${article.id}`}
    >
      {/* Header: source + section tag + time | relevance score */}
      <div className="article-card-header">
        <div className="article-card-meta">
          <span className="article-source">{article.source}</span>
          {section && (
            <span className="article-section-tag">{section.display_name}</span>
          )}
          <span className="article-time">{timeAgo(article.published_at)}</span>
        </div>
        <div
          className={`article-relevance ${
            isHighRelevance ? "relevance-high" : "relevance-medium"
          }`}
          title={`Relevance score: ${article.relevance_score}/10`}
        >
          {/* Bolt icon (SVG) replacing ⚡ emoji */}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          {article.relevance_score}
        </div>
      </div>

      {/* Title */}
      <h3 className="article-card-title">{article.title}</h3>

      {/* Brief Summary */}
      <p className="article-card-summary">{article.brief_summary}</p>

      {/* Footer: why it matters + read more */}
      <div className="article-card-footer">
        <span className="article-why">
          {article.why_it_matters}
        </span>
        <span className="article-read-more">
          Read
          {/* Arrow-right SVG */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </span>
      </div>
    </Link>
  );
}
