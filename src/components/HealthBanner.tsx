import { getLatestRunLog } from "@/lib/supabase";

export async function HealthBanner() {
  let status: "healthy" | "stale" | "error" = "error";
  let message = "No data available yet — waiting for first pipeline run";
  let articleCount = 0;

  try {
    const log = await getLatestRunLog();
    if (log) {
      const runTime = new Date(log.run_at);
      const now = new Date();
      const hoursSince = (now.getTime() - runTime.getTime()) / (1000 * 60 * 60);

      articleCount = log.articles_kept;

      if (hoursSince < 14) {
        status = "healthy";
        message = `Last updated: ${runTime.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })} IST · ${articleCount} new article${articleCount !== 1 ? "s" : ""}`;
      } else if (hoursSince < 26) {
        status = "stale";
        message = `Last update was ${Math.round(hoursSince)}h ago · ${articleCount} articles`;
      } else {
        status = "error";
        message = `Pipeline hasn't run in ${Math.round(hoursSince)}h — may need attention`;
      }
    }
  } catch {
    // Supabase not configured yet — show default message
  }

  return (
    <div className={`health-banner ${status}`}>
      <span className="health-dot" />
      <span>{message}</span>
    </div>
  );
}
