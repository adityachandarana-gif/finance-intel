"""
classifier.py — OpenRouter article classifier for Finance Intelligence Platform.

Uses OpenRouter's API (OpenAI-compatible) with Nemotron 3 Ultra 253B
(free tier) to classify finance articles into one of 19 editorial sections.

The model returns structured JSON with:
    - relevant (bool): whether the article belongs on the platform
    - section_id: one of the 19 valid section identifiers
    - relevance_score (1-10): how relevant the article is
    - brief_summary: 1-2 sentence summary
    - detailed_summary: 3-5 sentence summary with key facts
    - why_it_matters: significance for finance professionals

Articles scoring below 6 or marked irrelevant are discarded.

Rate Limiting:
    OpenRouter free tier has generous limits. We use a 1-second inter-request
    delay as a courtesy and to avoid transient 429s.
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any

import httpx

# ──────────────────────────────────────────────
# Valid section identifiers (19 sections)
# ──────────────────────────────────────────────
VALID_SECTION_IDS: list[str] = [
    "global_markets",
    "indian_economy",
    "economic_indicators",
    "private_equity",
    "venture_capital",
    "investment_banking",
    "ipo_capital_markets",
    "valuation_mechanics",
    "equity_research",
    "asset_management",
    "sector_investing",
    "banking_finserv",
    "regulatory",
    "global_context",
    "companies_tracking",
    "consulting_strategy",
    "ai_finance",
    "careers_recruiting",
    "thought_leadership",
]

# ──────────────────────────────────────────────
# NVIDIA NIM configuration
# ──────────────────────────────────────────────
NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

# Best model for structured JSON classification tasks (Nemotron 3 Ultra):
MODEL = "nvidia/nemotron-3-ultra-550b-a55b"

# Courtesy delay between requests (seconds)
_MIN_REQUEST_INTERVAL: float = 1.2
_last_request_time: float = 0.0

# Retry configuration
_MAX_RETRIES: int = 3
_BACKOFF_SECONDS: list[float] = [2.0, 4.0, 8.0]


def _get_api_key() -> str:
    """Retrieve the NVIDIA API key from environment."""
    key = os.environ.get("NVIDIA_API_KEY", "")
    if not key:
        raise EnvironmentError(
            "NVIDIA_API_KEY environment variable is not set."
        )
    return key


def _build_system_prompt() -> str:
    section_list = "\n".join(f"  - {sid}" for sid in VALID_SECTION_IDS)
    return f"""You are a financial news classifier for a finance intelligence platform
aimed at professionals in investment banking, private equity, venture capital,
asset management, and corporate finance in India and globally.

You MUST respond with ONLY a valid JSON object — no markdown fences, no preamble,
no explanation. The JSON must have exactly these keys:

{{
  "relevant": <bool — true if the article is relevant to finance professionals>,
  "section_id": "<one of the valid section IDs listed below>",
  "relevance_score": <integer 1-10, where 10 = extremely relevant>,
  "brief_summary": "<1-2 sentence summary for a homepage card>",
  "detailed_summary": "<3-5 sentence summary with key facts, numbers, parties>",
  "why_it_matters": "<1-2 sentences on why this matters to finance professionals>"
}}

Valid section_id values (pick exactly one):
{section_list}

Rules:
- If the article is not relevant to finance/business, set relevant=false, relevance_score=1.
- Focus on India-centric finance when possible, but global stories are valid.
- Discard pure advertising, listicles with no news, or celebrity gossip.
- Be precise with numbers, company names, and deal values in summaries.
- Use "thought_leadership" for articles citing specific named investors/analysts.
- detailed_summary should be information-dense and standalone.

Respond with ONLY the JSON object. No other text."""


def _build_user_prompt(title: str, source: str, text: str) -> str:
    context_note = ""
    if len(text.strip()) < 200:
        context_note = (
            "\n[Note: Text is very short — likely just a snippet. "
            "Classify on available info but keep relevance_score ≤ 7.]\n"
        )
    return f"""{context_note}Title: {title}
Source: {source}
Text: {text[:3000]}"""


def _enforce_rate_limit() -> None:
    global _last_request_time
    now = time.monotonic()
    elapsed = now - _last_request_time
    if elapsed < _MIN_REQUEST_INTERVAL:
        time.sleep(_MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time = time.monotonic()


def _parse_json_response(raw_text: str) -> dict[str, Any] | None:
    """Extract and parse JSON from the model response, handling markdown fences."""
    text = raw_text.strip()

    # Strip markdown code fences
    fence_match = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL).search(text)
    if fence_match:
        text = fence_match.group(1).strip()

    # Strip <think>...</think> blocks that some models emit
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting the first complete { ... } block
    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end > brace_start:
        try:
            return json.loads(text[brace_start : brace_end + 1])
        except json.JSONDecodeError:
            pass

    return None


def _validate_classification(data: dict[str, Any]) -> dict[str, Any] | None:
    """Validate required keys, types and clamp values."""
    required = {"relevant", "section_id", "relevance_score",
                "brief_summary", "detailed_summary", "why_it_matters"}

    if not required.issubset(data.keys()):
        missing = required - set(data.keys())
        print(f"[classifier] Missing keys: {missing}")
        return None

    try:
        data["relevance_score"] = max(1, min(10, int(data["relevance_score"])))
    except (ValueError, TypeError):
        print("[classifier] relevance_score is not numeric")
        return None

    if data["section_id"] not in VALID_SECTION_IDS:
        print(f"[classifier] Unknown section '{data['section_id']}', falling back to global_context")
        data["section_id"] = "global_context"

    data["relevant"] = bool(data["relevant"])
    return data


def _call_nvidia(
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    timeout: float = 45.0,
) -> str | None:
    """Make a single HTTP request to NVIDIA NIM API. Returns raw text or None."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 1024,
    }

    try:
        response = httpx.post(
            NVIDIA_BASE_URL,
            headers=headers,
            json=payload,
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        print(f"[classifier] HTTP {e.response.status_code}: {e.response.text[:200]}")
        raise
    except (KeyError, IndexError) as e:
        print(f"[classifier] Unexpected response shape: {e}")
        return None


def classify_article(
    title: str,
    source: str,
    text: str,
) -> dict[str, Any] | None:
    """Classify a finance article using NVIDIA NIM (Nemotron 3 Ultra).

    Args:
        title:  Article headline.
        source: Publisher / feed name.
        text:   Article body or summary text.

    Returns:
        Validated classification dict if relevant and score >= 6, else None.
        Never raises — all errors result in None (article is skipped).
    """
    api_key = _get_api_key()
    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(title, source, text)

    last_error: Exception | None = None

    for attempt in range(_MAX_RETRIES):
        try:
            _enforce_rate_limit()
            raw_text = _call_nvidia(api_key, MODEL, system_prompt, user_prompt)

            if not raw_text:
                print(f"[classifier] Empty response on attempt {attempt + 1}")
                last_error = ValueError("Empty response from NVIDIA NIM")
                continue

            parsed = _parse_json_response(raw_text)
            if parsed is None:
                print(
                    f"[classifier] Malformed JSON on attempt {attempt + 1}: "
                    f"{raw_text[:200]}"
                )
                last_error = ValueError("Malformed JSON")
                continue

            validated = _validate_classification(parsed)
            if validated is None:
                last_error = ValueError("Validation failed")
                continue

            # Apply relevance filter
            if not validated["relevant"] or validated["relevance_score"] < 6:
                return None

            return validated

        except httpx.HTTPStatusError as exc:
            last_error = exc
            status = exc.response.status_code
            if status == 429:
                wait = _BACKOFF_SECONDS[attempt] * 2
                print(f"[classifier] Rate limited (429), waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"[classifier] HTTP error {status} on attempt {attempt + 1}")
                time.sleep(_BACKOFF_SECONDS[attempt])

        except Exception as exc:
            last_error = exc
            print(f"[classifier] Error on attempt {attempt + 1}: {exc}")
            if attempt < _MAX_RETRIES - 1:
                time.sleep(_BACKOFF_SECONDS[attempt])

    print(f"[classifier] All {_MAX_RETRIES} attempts failed for: {title[:80]}")
    if last_error:
        print(f"[classifier] Last error: {last_error}")
    return None
