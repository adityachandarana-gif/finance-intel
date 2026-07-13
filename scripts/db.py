"""
db.py — Supabase database client for Finance Intelligence Platform.

Provides a thin, resilient abstraction over the Supabase Python client
for the operations the ingestion pipeline needs:

    - insert_article     : Insert a classified article (idempotent on hash)
    - check_duplicate_hashes : Per-article duplicate check (used as fallback)
    - get_existing_hashes    : Bulk-fetch all recent hashes (primary dedup path)
    - log_run            : Write pipeline run statistics to run_logs

All functions catch and log exceptions rather than propagating them, so a
transient DB issue never crashes the entire pipeline run.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from supabase import Client, create_client


def get_client() -> Client:
    """Initialize and return a Supabase client from environment variables.

    Reads:
        SUPABASE_URL — Project URL (e.g. https://xxx.supabase.co)
        SUPABASE_KEY — Service-role key (NOT the anon key, so we bypass RLS)

    Returns:
        An authenticated Supabase Client instance.

    Raises:
        EnvironmentError: If required env vars are missing.
    """
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_KEY", "")

    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_KEY environment variables must be set. "
            "Check your .env file or CI secrets."
        )

    return create_client(url, key)


def insert_article(client: Client, article_data: dict[str, Any]) -> bool:
    """Insert a single article into the articles table.

    Handles unique-constraint violations (duplicate dedup_hash or url_hash)
    silently — these are expected when two feeds publish the same story and
    both pass the in-memory dedup check due to race timing.

    Args:
        client:       Authenticated Supabase client.
        article_data: Dict matching the articles table schema. Expected keys:
                      title, original_url, source, published_at, section_id,
                      relevance_score, brief_summary, detailed_summary,
                      why_it_matters, dedup_hash, url_hash.

    Returns:
        True if the article was inserted successfully, False otherwise.
    """
    try:
        result = client.table("articles").insert(article_data).execute()

        # The supabase-py v2 client returns data on success
        if result.data:
            return True

        print(f"[db] Insert returned no data for: {article_data.get('title', '?')[:60]}")
        return False

    except Exception as exc:
        error_msg = str(exc).lower()

        # Unique constraint violations are expected and silently handled
        if "duplicate" in error_msg or "unique" in error_msg or "23505" in error_msg:
            # PostgreSQL error code 23505 = unique_violation
            return False

        print(f"[db] Insert failed for '{article_data.get('title', '?')[:60]}': {exc}")
        return False


def check_duplicate_hashes(
    client: Client,
    dedup_hash: str,
    url_hash: str | None = None,
    hours: int = 72,
) -> bool:
    """Check if an article's hashes already exist in the database.

    This is the per-article fallback. For batch processing, prefer
    get_existing_hashes() which makes a single query for all recent hashes.

    Args:
        client:     Authenticated Supabase client.
        dedup_hash: SHA-256 hex digest of the normalized title.
        url_hash:   SHA-256 hex digest of the article URL (optional).
        hours:      Lookback window in hours (default 72).

    Returns:
        True if either hash is found within the time window.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    try:
        # Check title dedup hash
        result = (
            client.table("articles")
            .select("id", count="exact")
            .eq("dedup_hash", dedup_hash)
            .gte("published_at", cutoff)
            .execute()
        )
        if result.count and result.count > 0:
            return True

        # Check URL hash if provided
        if url_hash:
            result = (
                client.table("articles")
                .select("id", count="exact")
                .eq("url_hash", url_hash)
                .gte("published_at", cutoff)
                .execute()
            )
            if result.count and result.count > 0:
                return True

    except Exception as exc:
        print(f"[db] Duplicate hash check failed: {exc}")
        # Fail open — let the article through; unique constraint will catch it

    return False


def get_existing_hashes(client: Client, hours: int = 72) -> set[str]:
    """Bulk-fetch all dedup hashes from the last N hours.

    This is far more efficient than per-article queries when processing
    a full batch of feeds. The returned set is used for fast in-memory
    dedup before any LLM calls are made.

    Args:
        client: Authenticated Supabase client.
        hours:  Lookback window in hours (default 72).

    Returns:
        A set of dedup_hash strings. Empty set on error (fail open).
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    hashes: set[str] = set()

    try:
        # Supabase paginates at 1000 rows by default; we may need multiple pages
        page_size = 1000
        offset = 0

        while True:
            result = (
                client.table("articles")
                .select("dedup_hash, url_hash")
                .gte("published_at", cutoff)
                .range(offset, offset + page_size - 1)
                .execute()
            )

            if not result.data:
                break

            for row in result.data:
                if row.get("dedup_hash"):
                    hashes.add(row["dedup_hash"])
                if row.get("url_hash"):
                    hashes.add(row["url_hash"])

            # If we got fewer rows than page_size, we've reached the end
            if len(result.data) < page_size:
                break

            offset += page_size

        print(f"[db] Loaded {len(hashes)} existing hashes from last {hours}h")

    except Exception as exc:
        print(f"[db] Failed to fetch existing hashes: {exc}")
        # Return empty set — pipeline will still work via per-insert dedup

    return hashes


def log_run(client: Client, stats: dict[str, Any]) -> None:
    """Write a pipeline run log entry to the run_logs table.

    This is called at the end of every pipeline run, regardless of success
    or failure, to maintain an audit trail.

    Args:
        client: Authenticated Supabase client.
        stats:  Dict with run statistics. Expected keys:
                started_at, finished_at, articles_pulled, articles_kept,
                articles_discarded, feeds_failed, llm_errors, status,
                error_message (optional).
    """
    try:
        duration: float | None = None
        started = stats.get("started_at")
        finished = stats.get("finished_at")
        if started and finished:
            try:
                start_dt = datetime.fromisoformat(started)
                finish_dt = datetime.fromisoformat(finished)
                duration = (finish_dt - start_dt).total_seconds()
            except ValueError:
                pass

        errors = []
        if stats.get("error_message"):
            errors.append(stats.get("error_message"))

        log_entry = {
            "run_at": stats.get("started_at") or datetime.now(timezone.utc).isoformat(),
            "duration_seconds": duration,
            "articles_pulled": stats.get("articles_pulled", 0),
            "articles_kept": stats.get("articles_kept", 0),
            "articles_discarded": stats.get("articles_discarded", 0),
            "feeds_failed": stats.get("feeds_failed", 0),
            "llm_errors": stats.get("llm_errors", 0),
            "errors": errors,
        }

        client.table("run_logs").insert(log_entry).execute()
        print("[db] Run log entry written successfully")

    except Exception as exc:
        # This is the last-resort logging — print to stdout for GitHub Actions
        print(f"[db] CRITICAL: Failed to write run log: {exc}")
        print(f"[db] Run stats were: {stats}")
