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

// Static ticker items — financial context cues
const TICKER_ITEMS = [
  { label: "NIFTY 50",    change: "+0.34%" },
  { label: "SENSEX",      change: "+0.28%" },
  { label: "USD/INR",     change: "83.42" },
  { label: "GOLD",        change: "+0.91%" },
  { label: "CRUDE OIL",   change: "-1.12%" },
  { label: "10Y YIELD",   change: "7.08%" },
  { label: "FII FLOW",    change: "+₹1,240Cr" },
  { label: "VIX",         change: "13.24" },
];

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
        <section className="hero animate-fade-in">
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

        {/* Live Ticker Bar */}
        <div className="ticker-bar">
          <div className="ticker-inner">
            {/* Duplicate for seamless loop */}
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => {
              const isNeg = item.change.startsWith("-");
              const isPos = item.change.startsWith("+");
              return (
                <span key={i} className="ticker-item">
                  <span>{item.label}</span>
                  <span className={isPos ? "ticker-up" : isNeg ? "ticker-down" : ""}>
                    {item.change}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <HomepageClient
        initialGroups={groups}
        initialSections={sections}
        initialArticles={articles}
      />
    </>
  );
}
