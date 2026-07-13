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

  return (
    <Link
      href={`/article/${article.id}`}
      className={`article-card animate-fade-in ${staggerClass}`}
      id={`article-${article.id}`}
    >
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
            article.relevance_score >= 8 ? "relevance-high" : "relevance-medium"
          }`}
        >
          <span>⚡</span>
          {article.relevance_score}
        </div>
      </div>

      <h3 className="article-card-title">{article.title}</h3>
      <p className="article-card-summary">{article.brief_summary}</p>

      <div className="article-card-footer">
        <span className="article-why">💡 {article.why_it_matters}</span>
        <span className="article-read-more">
          Read more →
        </span>
      </div>
    </Link>
  );
}
