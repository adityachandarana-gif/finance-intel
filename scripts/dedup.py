"""
dedup.py — Deduplication utilities for Finance Intelligence Platform.

Provides three layers of deduplication:
    1. Title normalization — strips noise so semantically identical headlines
       produce the same hash even when formatting or source suffixes differ.
    2. Hash computation — deterministic SHA-256 hashes for both the normalized
       title and the canonical URL.
    3. Database duplicate check — queries the articles table within a sliding
       time window to see if either hash already exists.

The two-hash strategy catches:
    - Same article syndicated across sources (title hash matches)
    - Same URL fetched in a subsequent run (url hash matches)
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime, timedelta, timezone

# Common suffixes appended by publishers (case-insensitive, stripped during normalization)
_SOURCE_SUFFIXES: list[str] = [
    "moneycontrol",
    "economic times",
    "livemint",
    "business standard",
    "financial express",
    "reuters",
    "techcrunch",
    "marketwatch",
    "inc42",
    "entrackr",
    "yourstory",
    "vccircle",
    "mint",
    "et markets",
    "the economic times",
    "bloomberg",
    "cnbc",
]

# Pre-compiled regex patterns for performance
_PUNCTUATION_RE = re.compile(r"[^\w\s]", re.UNICODE)
_WHITESPACE_RE = re.compile(r"\s+")
_TRAILING_DASH_RE = re.compile(r"\s*[-–—|:]\s*$")


def normalize_title(title: str) -> str:
    """Normalize an article title for deduplication.

    Steps:
        1. Unicode NFKD normalization (decompose ligatures, etc.)
        2. Lowercase
        3. Strip known source-name suffixes (e.g. "… - Reuters")
        4. Remove all punctuation
        5. Collapse whitespace to single spaces and strip edges

    Args:
        title: Raw article title string.

    Returns:
        A cleaned, deterministic string suitable for hashing.
    """
    if not title:
        return ""

    # Unicode normalize → lowercase
    text = unicodedata.normalize("NFKD", title).lower().strip()

    # Strip source-name suffixes like "… - Moneycontrol" or "… | Reuters"
    for suffix in _SOURCE_SUFFIXES:
        # Match patterns like "- Source", "| Source", ": Source" at end of string
        pattern = re.compile(
            rf"\s*[-–—|:]\s*{re.escape(suffix)}\s*$", re.IGNORECASE
        )
        text = pattern.sub("", text)

    # Clean up any trailing separator left behind
    text = _TRAILING_DASH_RE.sub("", text)

    # Remove punctuation (keeps letters, digits, whitespace)
    text = _PUNCTUATION_RE.sub(" ", text)

    # Collapse whitespace
    text = _WHITESPACE_RE.sub(" ", text).strip()

    return text


def compute_hashes(title: str, url: str) -> tuple[str, str]:
    """Compute deterministic deduplication hashes for an article.

    Args:
        title: Raw article title (will be normalized before hashing).
        url:   Canonical article URL.

    Returns:
        A tuple of (title_dedup_hash, url_hash), both hex-encoded SHA-256.
    """
    normalized = normalize_title(title)
    title_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    url_hash = hashlib.sha256(url.strip().encode("utf-8")).hexdigest()
    return title_hash, url_hash


def check_duplicates(
    supabase_client,
    dedup_hash: str,
    url_hash: str,
    hours: int = 72,
) -> bool:
    """Check whether an article is a duplicate by querying the database.

    Looks for matching title_dedup_hash OR url_hash in the articles table
    within the specified time window.

    Args:
        supabase_client: Initialized Supabase client instance.
        dedup_hash:      SHA-256 hex digest of the normalized title.
        url_hash:        SHA-256 hex digest of the article URL.
        hours:           Lookback window in hours (default 72 = 3 days).

    Returns:
        True if a duplicate is found, False otherwise.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    try:
        # Check title hash
        result = (
            supabase_client.table("articles")
            .select("id", count="exact")
            .eq("dedup_hash", dedup_hash)
            .gte("published_at", cutoff)
            .execute()
        )
        if result.count and result.count > 0:
            return True

        # Check URL hash
        if url_hash:
            result = (
                supabase_client.table("articles")
                .select("id", count="exact")
                .eq("url_hash", url_hash)
                .gte("published_at", cutoff)
                .execute()
            )
            if result.count and result.count > 0:
                return True

    except Exception as exc:
        # Log but don't crash — if we can't check, allow the article through
        # (the DB unique constraint will catch true duplicates on insert)
        print(f"[dedup] Warning: duplicate check failed — {exc}")

    return False
