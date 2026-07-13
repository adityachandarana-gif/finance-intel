# FinPulse — Finance Intelligence Platform

AI-curated finance & investing news covering PE, VC, IB, equity research, macro, markets, and careers. Updated twice daily via automated pipeline.

## 🏗 Architecture

```
GitHub Actions (2x/day) → RSS Feeds → Gemini Flash-Lite → Supabase → Next.js (Vercel)
```

- **Pipeline**: Python script fetches 12+ RSS feeds, deduplicates, classifies with Gemini AI, stores in Supabase
- **Frontend**: Next.js 15 with ISR, dark theme, 5 section tabs covering 19 subsections
- **Cost**: $0 (all free tiers)

## 📊 Sections

| Tab | Subsections |
|-----|-------------|
| 📊 Markets & Economy | Global Markets, Indian Economy, Economic Indicators |
| 💼 Deals & Transactions | PE, VC, IB, IPOs, Valuation & Deal Mechanics |
| 🔍 Research & Investing | Equity Research, Asset Management, Sector Investing |
| 🏦 Industry & Regulation | Banking, Regulatory, Global Context, Companies |
| 🚀 Strategy, AI & Careers | Consulting, AI+Finance, Careers, Thought Leadership |

## 🚀 Setup

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com)
2. Run `supabase/migrations/001_initial_schema.sql` in the SQL Editor
3. Run `supabase/seed.sql` to seed sections
4. Copy your project URL and keys from Settings → API

### 2. Environment Variables

**For the frontend** — create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**For the pipeline** — create `.env` (or set in GitHub Actions secrets):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

### 3. GitHub Actions Secrets
Add these in your repo → Settings → Secrets and variables → Actions:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `GEMINI_API_KEY`

### 4. Vercel Deployment
1. Import repo at [vercel.com](https://vercel.com)
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables
3. Deploy

### 5. Google Alerts RSS (Optional)
For topics without dedicated RSS feeds, create Google Alerts with "Deliver to: RSS feed" and add the feed URLs to `scripts/feeds.py`.

## 🛠 Local Development

```bash
# Frontend
npm install
npm run dev

# Pipeline (requires Python 3.11+)
pip install -r requirements.txt
python scripts/fetch_and_summarize.py
```

## 📁 Project Structure

```
├── .github/workflows/       # GitHub Actions (daily-news + keep-alive)
├── scripts/                 # Python pipeline
│   ├── fetch_and_summarize.py   # Main orchestrator
│   ├── feeds.py                 # RSS feed registry
│   ├── classifier.py            # Gemini Flash-Lite integration
│   ├── dedup.py                 # Title+URL deduplication
│   └── db.py                    # Supabase client
├── src/
│   ├── app/                     # Next.js pages
│   ├── components/              # React components
│   └── lib/                     # Supabase client + types
├── supabase/
│   ├── migrations/              # SQL schema
│   └── seed.sql                 # Section seed data
└── requirements.txt             # Python dependencies
```

## License

MIT
