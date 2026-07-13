import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getArticleById,
  getRelatedArticles,
  getSections,
} from "@/lib/supabase";
import { ArticleCard } from "@/components/ArticleCard";
import type { Metadata } from "next";

export const revalidate = 3600; // Revalidate every hour

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return { title: "Article Not Found" };

  return {
    title: `${article.title} — FinPulse`,
    description: article.brief_summary,
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export default async function ArticlePage({ params }: PageProps) {
  const { id } = await params;

  let article;
  let relatedArticles = [];
  let sections = [];

  try {
    article = await getArticleById(id);
    if (!article) notFound();

    [relatedArticles, sections] = await Promise.all([
      getRelatedArticles(article.section_id, article.id),
      getSections(),
    ]);
  } catch {
    notFound();
  }

  if (!article) notFound();

  const section = sections.find((s) => s.id === article.section_id);

  return (
    <article className="article-detail animate-fade-in">
      <Link href="/" className="article-detail-back">
        ← Back to feed
      </Link>

      <div className="article-detail-header">
        <div className="article-detail-meta">
          <span className="article-source">{article.source}</span>
          {section && (
            <span className="article-section-tag">{section.display_name}</span>
          )}
          <span
            className={`article-relevance ${
              article.relevance_score >= 8
                ? "relevance-high"
                : "relevance-medium"
            }`}
          >
            ⚡ {article.relevance_score}/10
          </span>
        </div>
        <h1>{article.title}</h1>
        <div className="article-detail-date">
          {formatDate(article.published_at)}
        </div>
      </div>

      <div className="article-detail-body">
        <div className="detail-section">
          <div className="detail-section-label">Summary</div>
          <p>{article.detailed_summary}</p>
        </div>

        <div className="detail-section">
          <div className="detail-section-label">Why It Matters</div>
          <div className="why-it-matters-box">
            <p>{article.why_it_matters}</p>
          </div>
        </div>
      </div>

      <a
        href={article.original_url}
        target="_blank"
        rel="noopener noreferrer"
        className="article-detail-source"
      >
        Read Original on {article.source} →
      </a>

      {relatedArticles.length > 0 && (
        <div className="related-articles">
          <h3>Related Articles</h3>
          <div className="related-grid">
            {relatedArticles.map((related, index) => (
              <ArticleCard
                key={related.id}
                article={related}
                section={sections.find((s) => s.id === related.section_id)}
                index={index}
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
