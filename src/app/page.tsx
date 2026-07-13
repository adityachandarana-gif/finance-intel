import {
  getSectionGroups,
  getSections,
  getRecentArticles,
  type SectionGroup,
  type Section,
  type Article,
} from "@/lib/supabase";
import { HomepageClient } from "@/components/HomepageClient";

export const revalidate = 1800; // ISR: revalidate every 30 minutes

export default async function HomePage() {
  let groups: SectionGroup[] = [];
  let sections: Section[] = [];
  let articles: Article[] = [];

  try {
    [groups, sections, articles] = await Promise.all([
      getSectionGroups(),
      getSections(),
      getRecentArticles(),
    ]);
  } catch {
    // Supabase may not be configured yet — render with empty data
  }

  return (
    <>
      <div className="app-container">
        <section className="hero">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            AI-Curated · Updated Twice Daily
          </div>
          <h1>Finance Intelligence</h1>
          <p>
            Your daily briefing on PE, VC, IB, equity research, markets, and
            careers — classified, summarized, and scored by AI.
          </p>
        </section>
      </div>

      <HomepageClient
        initialGroups={groups}
        initialSections={sections}
        initialArticles={articles}
      />
    </>
  );
}
