import { NextResponse } from 'next/server';
import { getRecentArticles } from '@/lib/supabase';

export const revalidate = 1800; // Cache for 30 mins

export async function GET() {
  try {
    const articles = await getRecentArticles();
    return NextResponse.json({ articles });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}
