import { createAdminSupabase } from "./supabase/admin";
import { getAvatarUrl } from "./avatar";

export interface FollowCounts {
  followers: number;
  following: number;
}

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const admin = createAdminSupabase();
  const [{ count: followers }, { count: following }] = await Promise.all([
    admin.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
    admin.from("user_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId)
  ]);
  return { followers: followers ?? 0, following: following ?? 0 };
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("user_follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  return !!data;
}

export interface FollowUserRow {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: string;
}

// המשתמשים שהמשתמש הזה עוקב אחריהם (לרשימה קצרה בפרופיל).
export async function getFollowing(userId: string, limit = 30): Promise<FollowUserRow[]> {
  const admin = createAdminSupabase();
  const { data: rows } = await admin
    .from("user_follows")
    .select("following_id, created_at")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const ids = (rows ?? []).map((r) => r.following_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await admin.from("profiles").select("id, username, avatar_key, role").in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return Promise.all(
    ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map(async (p: any) => ({
        id: p.id,
        username: p.username,
        avatarUrl: await getAvatarUrl(p.avatar_key, p.role),
        role: p.role
      }))
  );
}
