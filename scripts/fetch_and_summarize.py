"""
fetch_and_summarize.py — Main ingestion pipeline for Finance Intelligence Platform.

This is the entry point called by GitHub Actions (or run locally). It:
    1. Loads environment variables
    2. Connects to Supabase and bulk-fetches recent hashes for dedup
    3. Fetches all RSS feeds concurrently (async httpx, concurrency=5)
    4. For each article: dedup → classify (sync, rate-limited) → insert
    5. Logs run statistics to Supabase (always, even on total failure)
    6. Prints a summary to stdout for GitHub Actions logs

Design decisions:
    - Feed fetching is async (httpx + asyncio) for speed
    - LLM calls are synchronous to respect the 15 RPM free-tier limit
    - Every error is caught and counted — one bad feed or article never
      crashes the pipeline
    - Run logs are written unconditionally as the last step
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
from datetime import datetime, timezone
from html import unescape
from typing import Any

import feedparser
import httpx
from dotenv import load_dotenv

# Add the scripts directory to path so imports work both locally and in CI
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from classifier import classify_article
from db import get_client, get_existing_hashes, insert_article, log_run
from dedup import compute_hashes
from feeds import FEEDS

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
FEED_TIMEOUT_SECONDS: int = 10
MAX_CONCURRENT_FEEDS: int = 5
DEDUP_WINDOW_HOURS: int = 72
USER_AGENT: str = (
    "FinanceIntelligencePlatform/1.0 "
    "(RSS Aggregator; +https://github.com/your-org/finance-intel)"
)


# ──────────────────────────────────────────────
# Feed fetching (async)
# ──────────────────────────────────────────────

async def fetch_single_feed(
    client: httpx.AsyncClient,
    feed: dict[str, str],
    semaphore: asyncio.Semaphore,
) -> tuple[str, list[dict[str, Any]], str | None]:
    """Fetch and parse a single RSS feed.

    Args:
        client:    Shared async HTTP client.
        feed:      Feed dict with keys: name, url, category.
        semaphore: Concurrency limiter.

    Returns:
        Tuple of (feed_name, list_of_entries, error_message_or_None).
        On failure, list_of_entries is empty and error_message is set.
    """
    feed_name = feed["name"]

    async with semaphore:
        try:
            response = await client.get(
                feed["url"],
                timeout=FEED_TIMEOUT_SECONDS,
                follow_redirects=True,
            )
            response.raise_for_status()

            # feedparser works on the raw bytes/text
            parsed = feedparser.parse(response.text)

            if parsed.bozo and not parsed.entries:
                # bozo=True means feedparser encountered issues
                return (feed_name, [], f"Feed parse error: {parsed.bozo_exception}")

            entries: list[dict[str, Any]] = []
            for entry in parsed.entries:
                article = _extract_entry(entry, feed)
                if article:
                    entries.append(article)

            return (feed_name, entries, None)

        except httpx.TimeoutException:
            return (feed_name, [], f"Timeout after {FEED_TIMEOUT_SECONDS}s")
        except httpx.HTTPStatusError as exc:
            return (feed_name, [], f"HTTP {exc.response.status_code}")
        except Exception as exc:
            return (feed_name, [], f"Unexpected error: {exc}")


def _extract_entry(entry: Any, feed: dict[str, str]) -> dict[str, Any] | None:
    """Extract structured data from a single feedparser entry.

    Args:
        entry: A feedparser entry object.
        feed:  The parent feed dict.

    Returns:
        A dict with title, url, published_at, text, source, category —
        or None if the entry lacks a title or link.
    """
    title = entry.get("title", "").strip()
    link = entry.get("link", "").strip()

    if not title or not link:
        return None

    # Unescape HTML entities in title
    title = unescape(title)

    # Extract the best available text content
    text = ""
    if entry.get("content"):
        # Atom-style: content is a list of dicts
        text = entry["content"][0].get("value", "")
    elif entry.get("summary"):
        text = entry["summary"]
    elif entry.get("description"):
        text = entry["description"]

    text = unescape(_strip_html(text))

    # Parse published date
    published_at = _parse_date(entry)

    return {
        "title": title,
        "url": link,
        "published_at": published_at,
        "text": text,
        "source": feed["name"],
        "feed_category": feed["category"],
    }


def _strip_html(html_text: str) -> str:
    """Crudely strip HTML tags from a string.

    This is intentionally simple — we don't need perfect HTML parsing,
    just enough to get readable text from RSS content fields.
    """
    import re
    clean = re.sub(r"<[^>]+>", " ", html_text)
    clean = re.sub(r"\s+", " ", clean)
    return clean.strip()


def _parse_date(entry: Any) -> str:
    """Extract a published date from a feedparser entry.

    Falls back to the current UTC time if no date is available.

    Returns:
        ISO 8601 timestamp string.
    """
    # feedparser normalizes dates into a time_struct as published_parsed
    if entry.get("published_parsed"):
        try:
            dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            return dt.isoformat()
        except (TypeError, ValueError):
            pass

    if entry.get("updated_parsed"):
        try:
            dt = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
            return dt.isoformat()
        except (TypeError, ValueError):
            pass

    # Fallback to now
    return datetime.now(timezone.utc).isoformat()


async def fetch_all_feeds() -> tuple[list[dict[str, Any]], int]:
    """Fetch all feeds concurrently and return combined entries.

    Returns:
        Tuple of (all_articles, feeds_failed_count).
    """
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_FEEDS)
    all_articles: list[dict[str, Any]] = []
    feeds_failed = 0

    async with httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    ) as client:
        tasks = [
            fetch_single_feed(client, feed, semaphore)
            for feed in FEEDS
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, Exception):
            feeds_failed += 1
            print(f"[fetch] Feed task raised exception: {result}")
            continue

        feed_name, entries, error = result
        if error:
            feeds_failed += 1
            print(f"[fetch] ✗ {feed_name}: {error}")
        else:
            print(f"[fetch] ✓ {feed_name}: {len(entries)} entries")
            all_articles.extend(entries)

    return all_articles, feeds_failed


# ──────────────────────────────────────────────
# Main pipeline
# ──────────────────────────────────────────────

def run_pipeline() -> dict[str, Any]:
    """Execute the full ingestion pipeline.

    Returns:
        A stats dict with run metrics.
    """
    started_at = datetime.now(timezone.utc).isoformat()
    stats: dict[str, Any] = {
        "started_at": started_at,
        "finished_at": None,
        "articles_pulled": 0,
        "articles_kept": 0,
        "articles_discarded": 0,
        "feeds_failed": 0,
        "llm_errors": 0,
        "status": "success",
        "error_message": None,
    }

    supabase_client = None

    try:
        # ── Step 1: Initialize Supabase ──
        print("\n" + "=" * 60)
        print("Finance Intelligence Platform — Ingestion Pipeline")
        print("=" * 60)
        print(f"Started at: {started_at}")
        print(f"Feeds configured: {len(FEEDS)}")
        print(f"Dedup window: {DEDUP_WINDOW_HOURS}h")
        print()

        supabase_client = get_client()
        print("[init] Supabase client initialized")

        # ── Step 2: Bulk-fetch existing hashes ──
        existing_hashes = get_existing_hashes(supabase_client, hours=DEDUP_WINDOW_HOURS)
        print(f"[init] {len(existing_hashes)} existing hashes loaded for dedup\n")

        # ── Step 3: Fetch all feeds ──
        print("─" * 40)
        print("Fetching RSS feeds...")
        print("─" * 40)

        all_articles, feeds_failed = asyncio.run(fetch_all_feeds())
        stats["feeds_failed"] = feeds_failed
        stats["articles_pulled"] = len(all_articles)

        print(f"\n[fetch] Total articles pulled: {len(all_articles)}")
        print(f"[fetch] Feeds failed: {feeds_failed}\n")

        if not all_articles:
            print("[pipeline] No articles fetched — nothing to process")
            stats["status"] = "success_empty"
            return stats

        # ── Step 4: Process each article ──
        print("─" * 40)
        print("Processing articles (dedup → classify → insert)...")
        print("─" * 40)

        for i, article in enumerate(all_articles, 1):
            title = article["title"]
            url = article["url"]
            source = article["source"]
            text = article.get("text", "")

            # Dedup check (in-memory, fast)
            title_hash, url_hash = compute_hashes(title, url)

            if title_hash in existing_hashes or url_hash in existing_hashes:
                stats["articles_discarded"] += 1
                continue

            # Add to in-memory set to catch duplicates within this run
            existing_hashes.add(title_hash)
            existing_hashes.add(url_hash)

            # Classify with Gemini (sync, rate-limited)
            try:
                classification = classify_article(title, source, text)
            except Exception as exc:
                stats["llm_errors"] += 1
                print(f"[classify] Unhandled error for '{title[:50]}': {exc}")
                continue

            if classification is None:
                stats["articles_discarded"] += 1
                continue

            # Build DB record
            db_record = {
                "title": title,
                "url": url,
                "source": source,
                "published_at": article["published_at"],
                "feed_category": article["feed_category"],
                "section_id": classification["section_id"],
                "relevance_score": classification["relevance_score"],
                "brief_summary": classification["brief_summary"],
                "detailed_summary": classification["detailed_summary"],
                "why_it_matters": classification["why_it_matters"],
                "dedup_hash": title_hash,
                "url_hash": url_hash,
            }

            # Insert to DB
            success = insert_article(supabase_client, db_record)
            if success:
                stats["articles_kept"] += 1
                print(
                    f"  [{i}/{len(all_articles)}] ✓ [{classification['section_id']}] "
                    f"(score={classification['relevance_score']}) "
                    f"{title[:60]}"
                )
            else:
                stats["articles_discarded"] += 1

    except EnvironmentError as exc:
        stats["status"] = "error"
        stats["error_message"] = str(exc)
        print(f"\n[FATAL] Environment error: {exc}")

    except Exception as exc:
        stats["status"] = "error"
        stats["error_message"] = f"{type(exc).__name__}: {str(exc)[:500]}"
        print(f"\n[FATAL] Unexpected error: {exc}")

    finally:
        stats["finished_at"] = datetime.now(timezone.utc).isoformat()

        # ── Step 5: Log run (ALWAYS) ──
        if supabase_client:
            try:
                log_run(supabase_client, stats)
            except Exception as exc:
                print(f"[FATAL] Could not write run log: {exc}")

    return stats


def print_summary(stats: dict[str, Any]) -> None:
    """Print a human-readable run summary to stdout.

    This output is visible in GitHub Actions logs.
    """
    print("\n" + "=" * 60)
    print("PIPELINE RUN SUMMARY")
    print("=" * 60)
    print(f"  Status:             {stats['status']}")
    print(f"  Started:            {stats['started_at']}")
    print(f"  Finished:           {stats['finished_at']}")
    print(f"  Feeds failed:       {stats['feeds_failed']}")
    print(f"  Articles pulled:    {stats['articles_pulled']}")
    print(f"  Articles kept:      {stats['articles_kept']}")
    print(f"  Articles discarded: {stats['articles_discarded']}")
    print(f"  LLM errors:         {stats['llm_errors']}")

    if stats.get("error_message"):
        print(f"  Error:              {stats['error_message']}")

    print("=" * 60)

    # Exit with non-zero code only on total failure
    if stats["status"] == "error" and stats["articles_kept"] == 0:
        print("\n⚠ Pipeline failed with zero articles kept.")
        sys.exit(1)


# ──────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────

if __name__ == "__main__":
    # Load .env file if it exists (local dev); in CI, env vars are set directly
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
    load_dotenv(dotenv_path=env_path, override=False)

    stats = run_pipeline()
    print_summary(stats)
