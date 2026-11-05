import { createAdminSupabase } from "./supabase/admin";
import { getAvatarUrl } from "./avatar";
import { memo } from "./memo";
import { forumSnippet } from "./forumText";

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
  // מתי הכותב ערך את הטקסט (null = לא נערך)
  editedAt: string | null;
  // אם זו תגובה לתגובה מסוימת - מי ומה (קטע קצר), לתצוגת "בתגובה ל..."
  replyTo: { id: string; username: string; snippet: string } | null;
  // משתמשים שהוזכרו בהודעה (@שם)
  mentions: { id: string; username: string }[];
}

export type ForumSort = "new" | "top";

async function enrich(rows: any[], viewerId: string | null): Promise<ForumPost[]> {
  if (rows.length === 0) return [];
  const admin = createAdminSupabase();
  const ids = rows.map((r) => r.id);
  // תגובות שעונות לתגובה מסוימת - שולפים את ההודעה שהן עונות לה (לתצוגת "בתגובה ל...")
  const replyToIds = [...new Set(rows.map((r) => r.reply_to_id).filter(Boolean))] as string[];
  const { data: replyTargets } = replyToIds.length
    ? await admin.from("forum_posts").select("id, user_id, body, hidden").in("id", replyToIds)
    : { data: [] as any[] };
  const authorIds = [...new Set([...rows.map((r) => r.user_id), ...(replyTargets ?? []).map((t: any) => t.user_id)])];

  // הזכרות (@שם) - מי הוזכר בכל הודעה
  const { data: mentionRows } = await admin.from("forum_mentions").select("post_id, user_id").in("post_id", ids);
  const mentionUserIds = [...new Set((mentionRows ?? []).map((m: any) => m.user_id))] as string[];
  const { data: mentionProfiles } = mentionUserIds.length
    ? await admin.from("profiles").select("id, username").in("id", mentionUserIds)
    : { data: [] as any[] };
  const mentionName = new Map((mentionProfiles ?? []).map((p: any) => [p.id, p.username]));
  const mentionsByPost = new Map<string, { id: string; username: string }[]>();
  for (const m of mentionRows ?? []) {
    const username = mentionName.get((m as any).user_id);
    if (!username) continue;
    const list = mentionsByPost.get((m as any).post_id) ?? [];
    list.push({ id: (m as any).user_id, username });
    mentionsByPost.set((m as any).post_id, list);
  }

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

  const targetMap = new Map<string, { id: string; username: string; snippet: string }>();
  for (const t of replyTargets ?? []) {
    targetMap.set(t.id, {
      id: t.id,
      username: authorMap.get(t.user_id)?.username ?? "משתמש",
      snippet: t.hidden ? "(הודעה מוסתרת)" : forumSnippet(t.body)
    });
  }

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
    isMine: !!viewerId && r.user_id === viewerId,
    editedAt: r.edited_at ?? null,
    replyTo: r.reply_to_id ? targetMap.get(r.reply_to_id) ?? null : null,
    mentions: mentionsByPost.get(r.id) ?? []
  }));
}

// רשימת הפוסטים הראשיים (threads). staff רואה גם מוסתרים.
// limit = כמה פוסטים רגילים (לא נעוצים) לשלוף. הנעוצים תמיד נכללים. ב"הכי אהובים" צריך את כל
// הפוסטים כדי למיין לפי לייקים, ולכן שם נשלפים עד 200 כמו קודם (והקורא חותך).
export async function getForumThreads(
  viewerId: string | null,
  opts: { sort?: ForumSort; isStaff?: boolean; limit?: number } = {}
): Promise<ForumPost[]> {
  const admin = createAdminSupabase();
  let rows: any[] = [];
  if (opts.sort === "top" || !opts.limit) {
    let q = admin.from("forum_posts").select("*").is("parent_id", null).limit(200);
    if (!opts.isStaff) q = q.eq("hidden", false);
    const { data } = await q;
    rows = data ?? [];
  } else {
    let pinnedQ = admin.from("forum_posts").select("*").is("parent_id", null).eq("pinned", true);
    let recentQ = admin
      .from("forum_posts")
      .select("*")
      .is("parent_id", null)
      .eq("pinned", false)
      .order("created_at", { ascending: false })
      .limit(Math.min(opts.limit, 200));
    if (!opts.isStaff) {
      pinnedQ = pinnedQ.eq("hidden", false);
      recentQ = recentQ.eq("hidden", false);
    }
    const [{ data: pinnedRows }, { data: recentRows }] = await Promise.all([pinnedQ, recentQ]);
    rows = [...(pinnedRows ?? []), ...(recentRows ?? [])];
  }
  const posts = await enrich(rows, viewerId);

  const sorted = posts.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (opts.sort === "top" && a.likeCount !== b.likeCount) return b.likeCount - a.likeCount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return sorted;
}

// כמה תגובות בכל עמוד של דיון
export const FORUM_REPLIES_PAGE_SIZE = 30;

// פוסט בודד + עמוד אחד מהתגובות שלו (30 בעמוד). focusPost - תגובה מסוימת: מחשבים באיזה עמוד היא נמצאת
// ומחזירים אותו (קישורים ישירים והתראות מובילים אליה).
export async function getForumThread(
  id: string,
  viewerId: string | null,
  isStaff = false,
  opts: { page?: number; focusPost?: string | null } = {}
): Promise<{ post: ForumPost; replies: ForumPost[]; total: number; page: number; pages: number } | null> {
  const admin = createAdminSupabase();
  const { data: root } = await admin.from("forum_posts").select("*").eq("id", id).is("parent_id", null).maybeSingle();
  if (!root) return null;
  if (root.hidden && !isStaff) return null;

  const pageSize = FORUM_REPLIES_PAGE_SIZE;
  let countQ = admin.from("forum_posts").select("id", { count: "exact", head: true }).eq("parent_id", id);
  if (!isStaff) countQ = countQ.eq("hidden", false);
  const { count } = await countQ;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  let page = Math.min(Math.max(1, opts.page ?? 1), pages);

  if (opts.focusPost) {
    const { data: focus } = await admin.from("forum_posts").select("created_at, parent_id").eq("id", opts.focusPost).maybeSingle();
    if (focus && focus.parent_id === id) {
      let beforeQ = admin
        .from("forum_posts")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", id)
        .lt("created_at", focus.created_at);
      if (!isStaff) beforeQ = beforeQ.eq("hidden", false);
      const { count: before } = await beforeQ;
      page = Math.min(pages, Math.floor((before ?? 0) / pageSize) + 1);
    }
  }

  const from = (page - 1) * pageSize;
  let rq = admin
    .from("forum_posts")
    .select("*")
    .eq("parent_id", id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);
  if (!isStaff) rq = rq.eq("hidden", false);
  const { data: replyRows } = await rq;

  const [[post], replies] = await Promise.all([enrich([root], viewerId), enrich(replyRows ?? [], viewerId)]);
  return { post, replies, total, page, pages };
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
  return memo("forum-stats", 30_000, async () => {
    const admin = createAdminSupabase();
    const { data } = await admin.from("forum_posts").select("user_id, parent_id").eq("hidden", false);
    const rows = data ?? [];
    return {
      threads: rows.filter((r) => !r.parent_id).length,
      posters: new Set(rows.map((r) => r.user_id)).size
    };
  });
}
