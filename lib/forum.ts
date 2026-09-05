import { createAdminSupabase } from "./supabase/admin";
import { getAvatarUrl } from "./avatar";

// כל לייק על פוסט ראשי בפורום מזכה את הכותב במוניטין אחד (פעם אחת לכל נותן-לייק).
export const FORUM_LIKE_POINTS = 1;

export interface ForumAuthor {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  isModerator: boolean;
  isPro: boolean;
  forumBanned: boolean;
}

export interface ForumPost {
  id: string;
  parentId: string | null;
  author: ForumAuthor;
  title: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
  pinned: boolean;
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
  isMine: boolean;
}

export type ForumSort = "new" | "top";

async function enrich(rows: any[], viewerId: string | null): Promise<ForumPost[]> {
  if (rows.length === 0) return [];
  const admin = createAdminSupabase();
  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.user_id))];

  const [{ data: authors }, { data: likes }, { data: replyCounts }] = await Promise.all([
    admin.from("profiles").select("id, username, avatar_key, role, is_moderator, is_pro, forum_banned").in("id", authorIds),
    admin.from("forum_post_likes").select("post_id, user_id").in("post_id", ids),
    admin.from("forum_posts").select("parent_id").in("parent_id", ids).eq("hidden", false)
  ]);

  const authorEntries: [string, ForumAuthor][] = await Promise.all(
    (authors ?? []).map(
      async (a): Promise<[string, ForumAuthor]> => [
        a.id,
        {
          id: a.id,
          username: a.username,
          avatarUrl: await getAvatarUrl(a.avatar_key, a.role),
          role: a.role,
          isModerator: !!a.is_moderator,
          isPro: !!a.is_pro,
          forumBanned: !!a.forum_banned
        }
      ]
    )
  );
  const authorMap = new Map<string, ForumAuthor>(authorEntries);

  const likeCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const l of likes ?? []) {
    likeCount.set(l.post_id, (likeCount.get(l.post_id) ?? 0) + 1);
    if (viewerId && l.user_id === viewerId) likedByMe.add(l.post_id);
  }
  const replyCount = new Map<string, number>();
  for (const r of replyCounts ?? []) {
    if (r.parent_id) replyCount.set(r.parent_id, (replyCount.get(r.parent_id) ?? 0) + 1);
  }

  const fallbackAuthor: ForumAuthor = {
    id: "",
    username: "משתמש",
    avatarUrl: null,
    role: "user",
    isModerator: false,
    isPro: false,
    forumBanned: false
  };

  return rows.map((r) => ({
    id: r.id,
    parentId: r.parent_id ?? null,
    author: authorMap.get(r.user_id) ?? fallbackAuthor,
    title: r.title ?? null,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    hidden: !!r.hidden,
    pinned: !!r.pinned,
    likeCount: likeCount.get(r.id) ?? 0,
    likedByMe: likedByMe.has(r.id),
    replyCount: replyCount.get(r.id) ?? 0,
    isMine: !!viewerId && r.user_id === viewerId
  }));
}

// רשימת הפוסטים הראשיים (threads). staff רואה גם מוסתרים.
export async function getForumThreads(
  viewerId: string | null,
  opts: { sort?: ForumSort; isStaff?: boolean } = {}
): Promise<ForumPost[]> {
  const admin = createAdminSupabase();
  let q = admin.from("forum_posts").select("*").is("parent_id", null).limit(200);
  if (!opts.isStaff) q = q.eq("hidden", false);
  const { data } = await q;
  const posts = await enrich(data ?? [], viewerId);

  const sorted = posts.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (opts.sort === "top" && a.likeCount !== b.likeCount) return b.likeCount - a.likeCount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return sorted;
}

// פוסט בודד + התגובות שלו.
export async function getForumThread(
  id: string,
  viewerId: string | null,
  isStaff = false
): Promise<{ post: ForumPost; replies: ForumPost[] } | null> {
  const admin = createAdminSupabase();
  const { data: root } = await admin.from("forum_posts").select("*").eq("id", id).is("parent_id", null).maybeSingle();
  if (!root) return null;
  if (root.hidden && !isStaff) return null;

  let rq = admin.from("forum_posts").select("*").eq("parent_id", id).order("created_at", { ascending: true });
  if (!isStaff) rq = rq.eq("hidden", false);
  const { data: replyRows } = await rq;

  const [[post], replies] = await Promise.all([enrich([root], viewerId), enrich(replyRows ?? [], viewerId)]);
  return { post, replies };
}

// לפאנל הפיקוח: כל מה שנכתב בפורום (פוסטים ותגובות, כולל מוסתרים), החדש קודם.
export async function getForumModerationFeed(limit = 150): Promise<ForumPost[]> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("forum_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return enrich(data ?? [], null);
}

export async function getForumStats(): Promise<{ threads: number; posters: number }> {
  const admin = createAdminSupabase();
  const { data } = await admin.from("forum_posts").select("user_id, parent_id").eq("hidden", false);
  const rows = data ?? [];
  return {
    threads: rows.filter((r) => !r.parent_id).length,
    posters: new Set(rows.map((r) => r.user_id)).size
  };
}
