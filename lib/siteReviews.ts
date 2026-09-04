import { createAdminSupabase } from "./supabase/admin";
import { getAvatarUrl } from "./avatar";

export interface SiteReviewRow {
  id: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  role: string;
  isPro: boolean;
  hidden: boolean;
}

export interface SiteReviewsData {
  reviews: SiteReviewRow[];
  count: number;
  avg: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export async function getSiteReviews(opts: { includeHidden?: boolean } = {}): Promise<SiteReviewsData & { hidden?: boolean[] }> {
  const admin = createAdminSupabase();
  let q = admin
    .from("site_reviews")
    .select("id, rating, comment, hidden, created_at, user:profiles!site_reviews_user_id_fkey(username, avatar_key, role, is_pro)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (!opts.includeHidden) q = q.eq("hidden", false);
  const { data } = await q;

  const rows = (data ?? []) as any[];
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of rows) {
    distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
    sum += r.rating;
  }

  const reviews: SiteReviewRow[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      username: r.user?.username ?? "משתמש",
      avatarUrl: await getAvatarUrl(r.user?.avatar_key ?? null, r.user?.role),
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      role: r.user?.role ?? "user",
      isPro: !!r.user?.is_pro,
      hidden: !!r.hidden
    }))
  );

  return {
    reviews,
    count: rows.length,
    avg: rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0,
    distribution: distribution as SiteReviewsData["distribution"]
  };
}

export async function getMySiteReview(userId: string): Promise<{ rating: number; comment: string | null } | null> {
  const admin = createAdminSupabase();
  const { data } = await admin.from("site_reviews").select("rating, comment").eq("user_id", userId).maybeSingle();
  return data ? { rating: data.rating, comment: data.comment } : null;
}
