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

async function profilesToRows(ids: string[]): Promise<FollowUserRow[]> {
  if (ids.length === 0) return [];
  const admin = createAdminSupabase();
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

// המשתמשים שהמשתמש הזה עוקב אחריהם.
export async function getFollowing(userId: string, limit = 60): Promise<FollowUserRow[]> {
  const admin = createAdminSupabase();
  const { data: rows } = await admin
    .from("user_follows")
    .select("following_id, created_at")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return profilesToRows((rows ?? []).map((r) => r.following_id));
}

// המשתמשים שעוקבים אחרי המשתמש הזה.
export async function getFollowers(userId: string, limit = 60): Promise<FollowUserRow[]> {
  const admin = createAdminSupabase();
  const { data: rows } = await admin
    .from("user_follows")
    .select("follower_id, created_at")
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return profilesToRows((rows ?? []).map((r) => r.follower_id));
}
