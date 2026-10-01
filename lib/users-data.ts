import { createAdminSupabase } from "./supabase/admin";
import { getAvatarUrl } from "./avatar";
import type { AppRow } from "@/types/database";

// פרטים ציבוריים בלבד (לא חושפים אימייל/טלפון/סטטוס חסימה וכו') - נשלף כאן בצד השרת
// עם ה-admin client (עוקף RLS) ומחזירים ללקוח רק את השדות הבטוחים האלה.
export interface PublicUserSummary {
  id: string;
  username: string;
  role: string;
  is_moderator: boolean;
  is_pro: boolean;
  avatarUrl: string | null;
  appsCount: number;
  points: number;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface PublicUserDetail extends PublicUserSummary {
  apps: AppRow[];
  notes: string | null;
  displayEmail: string | null;
  mitmachimUrl: string | null;
  points: number;
}

export async function getUsersStats() {
  const admin = createAdminSupabase();
  const [{ count: totalUsers }, { count: totalDevelopers }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).in("role", ["developer", "admin"])
  ]);
  return { totalUsers: totalUsers ?? 0, totalDevelopers: totalDevelopers ?? 0 };
}

// PostgREST מחזיר לכל היותר ~1000 שורות בשאילתה אחת (גם בלי limit) - לכן דפדוף עד הסוף,
// אחרת משתמשים (ואפליקציות לספירה) מעבר לתקרה פשוט נעלמו מעמוד המשתמשים (ראו גם lib/admin-data.ts).
const PAGE_SIZE = 1000;
async function fetchAllRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await query(from, from + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

// כל המשתמשים, מהמוניטין הגבוה לנמוך.
export async function getPublicUsersList(): Promise<PublicUserSummary[]> {
  const admin = createAdminSupabase();
  const rows = await fetchAllRows<any>((from, to) =>
    admin
      .from("profiles")
      .select("id, username, role, is_moderator, is_pro, avatar_key, points, created_at, last_seen_at")
      .order("points", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: true })
      .range(from, to)
  );

  const appsData = await fetchAllRows<{ developer_id: string }>((from, to) =>
    admin.from("apps").select("developer_id").neq("status", "archived").order("id").range(from, to)
  );
  const appsCountByDev = new Map<string, number>();
  for (const row of appsData) {
    appsCountByDev.set(row.developer_id, (appsCountByDev.get(row.developer_id) ?? 0) + 1);
  }

  return Promise.all(
    rows.map(async (p) => ({
      id: p.id,
      username: p.username,
      role: p.role,
      is_moderator: p.is_moderator,
      is_pro: p.is_pro,
      avatarUrl: await getAvatarUrl(p.avatar_key, p.role),
      appsCount: appsCountByDev.get(p.id) ?? 0,
      points: p.points ?? 0,
      createdAt: p.created_at,
      lastSeenAt: p.last_seen_at
    }))
  );
}

export async function getPublicUserDetail(id: string): Promise<PublicUserDetail | null> {
  const admin = createAdminSupabase();
  // select("*") - עמיד לכך שמיגרציה 0039 (mitmachim_url) עוד לא רצה.
  const { data: p } = await admin.from("profiles").select("*").eq("id", id).single();
  if (!p) return null;

  const { data: appsData } = await admin
    .from("apps")
    .select("*")
    .eq("developer_id", id)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  return {
    id: p.id,
    username: p.username,
    role: p.role,
    is_moderator: p.is_moderator,
    is_pro: p.is_pro,
    avatarUrl: await getAvatarUrl(p.avatar_key),
    appsCount: (appsData ?? []).length,
    createdAt: p.created_at,
    lastSeenAt: p.last_seen_at,
    apps: (appsData as AppRow[]) ?? [],
    notes: p.notes ?? null,
    // תגית המייל מוצגת רק אם בעל החשבון בחר להציג אותה - שדה נפרד לגמרי מהמייל האמיתי שנרשם בו
    displayEmail: p.show_email_tag && p.display_email ? p.display_email : null,
    mitmachimUrl: (p as any).mitmachim_url ?? null,
    points: p.points ?? 0
  };
}
