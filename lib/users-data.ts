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
  createdAt: string;
  lastSeenAt: string | null;
}

export interface PublicUserDetail extends PublicUserSummary {
  apps: AppRow[];
}

export async function getUsersStats() {
  const admin = createAdminSupabase();
  const [{ count: totalUsers }, { count: totalDevelopers }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).in("role", ["developer", "admin"])
  ]);
  return { totalUsers: totalUsers ?? 0, totalDevelopers: totalDevelopers ?? 0 };
}

export async function getPublicUsersList(): Promise<PublicUserSummary[]> {
  const admin = createAdminSupabase();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, role, is_moderator, is_pro, avatar_key, created_at, last_seen_at")
    .order("created_at", { ascending: false });

  const rows = profiles ?? [];
  const { data: appsData } = await admin.from("apps").select("developer_id").neq("status", "archived");
  const appsCountByDev = new Map<string, number>();
  for (const row of appsData ?? []) {
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
      createdAt: p.created_at,
      lastSeenAt: p.last_seen_at
    }))
  );
}

export async function getPublicUserDetail(id: string): Promise<PublicUserDetail | null> {
  const admin = createAdminSupabase();
  const { data: p } = await admin
    .from("profiles")
    .select("id, username, role, is_moderator, is_pro, avatar_key, created_at, last_seen_at")
    .eq("id", id)
    .single();
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
    apps: (appsData as AppRow[]) ?? []
  };
}
