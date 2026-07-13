"""
feeds.py — RSS Feed Registry for Finance Intelligence Platform.

Central registry of all RSS feeds to be polled by the ingestion pipeline.
Each feed entry contains a human-readable name, the RSS URL, and a category
tag used for logging and diagnostics (not for article classification — that
is handled by the Gemini classifier).

Categories:
    - india_business   : Indian business news, markets, economy
    - india_pe_vc      : Indian private equity, venture capital, startups
    - global           : International business, markets, tech finance

To add a new feed, append a dict with keys: name, url, category.
"""

FEEDS: list[dict[str, str]] = [
    # ──────────────────────────────────────────────
    # India Business / Markets
    # ──────────────────────────────────────────────
    {
        "name": "Moneycontrol",
        "url": "https://www.moneycontrol.com/rss/latestnews.xml",
        "category": "india_business",
    },
    {
        "name": "Economic Times Markets",
        "url": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
        "category": "india_business",
    },
    {
        "name": "LiveMint Markets",
        "url": "https://www.livemint.com/rss/markets",
        "category": "india_business",
    },
    {
        "name": "Business Standard Markets",
        "url": "https://www.business-standard.com/rss/markets-106.rss",
        "category": "india_business",
    },
    {
        "name": "Financial Express",
        "url": "https://www.financialexpress.com/feed/",
        "category": "india_business",
    },

    # ──────────────────────────────────────────────
    # India PE / VC / Startups
    # ──────────────────────────────────────────────
    {
        "name": "VCCircle",
        "url": "https://www.vccircle.com/feed",
        "category": "india_pe_vc",
    },
    {
        "name": "Inc42",
        "url": "https://inc42.com/feed/",
        "category": "india_pe_vc",
    },
    {
        "name": "Entrackr",
        "url": "https://entrackr.com/feed/",
        "category": "india_pe_vc",
    },
    {
        "name": "YourStory",
        "url": "https://yourstory.com/feed",
        "category": "india_pe_vc",
    },

    # ──────────────────────────────────────────────
    # Global
    # ──────────────────────────────────────────────
    {
        "name": "Reuters Business",
        "url": "https://feeds.reuters.com/reuters/businessNews",
        "category": "global",
    },
    {
        "name": "MarketWatch Top Stories",
        "url": "https://feeds.marketwatch.com/marketwatch/topstories",
        "category": "global",
    },
    {
        "name": "TechCrunch",
        "url": "https://techcrunch.com/feed/",
        "category": "global",
    },

    # ──────────────────────────────────────────────
    # Google Alerts (user-configured)
    # ──────────────────────────────────────────────
    # To add Google Alerts RSS feeds:
    #   1. Go to https://www.google.com/alerts
    #   2. Create an alert for your desired keyword (e.g. "Indian IPO", "PE deal India")
    #   3. In alert settings, choose "RSS feed" as the delivery method
    #   4. Copy the generated RSS URL and add it here:
    #
    # Example:
    # {
    #     "name": "Google Alert — Indian IPO",
    #     "url": "https://www.google.com/alerts/feeds/XXXXXXXX/YYYYYYYY",
    #     "category": "india_business",
    # },
]
