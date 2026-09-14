import { createAdminSupabase } from "./supabase/admin";
import { sendPushToUser } from "./push";

export type SubType =
  | "developer"
  | "category"
  | "new_public"
  | "all_new"
  | "app"
  | "community"
  | "forum_thread";

// מוסיף שורות ל-feed באתר ושולח Web Push (best-effort) לכל הנמענים.
async function deliver(userIds: string[], notif: { kind: string; title: string; body: string; url: string }) {
  const uniq = [...new Set(userIds)];
  if (uniq.length === 0) return;
  const admin = createAdminSupabase();

  await admin.from("user_notifications").insert(
    uniq.map((uid) => ({ user_id: uid, kind: notif.kind, title: notif.title, body: notif.body, url: notif.url }))
  );

  // Push בבאצ'ים קטנים כדי לא להציף.
  const BATCH = 25;
  for (let i = 0; i < uniq.length; i += BATCH) {
    await Promise.all(
      uniq.slice(i, i + BATCH).map((uid) =>
        sendPushToUser(uid, { title: notif.title, body: notif.body, url: notif.url }).catch(() => {})
      )
    );
  }
}

// נקרא ברגע שאפליקציה עוברת ל-approved (חדשה / גרסה חדשה / הצעה ציבורית שאושרה).
// אידמפוטנטי-ish: את "was_published" מסמנים כאן, כך שאם ייקרא שוב לאותה אפליקציה זה
// כבר ייחשב "עדכון" ולא "חדש" (בלי לשלוח כפילות מהותית).
export async function notifyForApprovedApp(appId: string): Promise<void> {
  const admin = createAdminSupabase();
  const { data: app } = await admin
    .from("apps")
    .select("id, name, category, developer_id, source, was_published, developer:profiles!apps_developer_id_fkey(username)")
    .eq("id", appId)
    .single();
  if (!app) return;

  const isUpdate = !!app.was_published;
  const isPublic = app.source === "public_suggestion";
  const devName = (app as any).developer?.username ?? "מפתח";

  if (!app.was_published) {
    await admin.from("apps").update({ was_published: true }).eq("id", appId);
  }

  const conditions: { type: SubType; target: string }[] = [
    { type: "developer", target: app.developer_id },
    { type: "category", target: app.category },
    { type: "all_new", target: "" }
  ];
  if (isPublic && !isUpdate) conditions.push({ type: "new_public", target: "" });
  // מנוי לאפליקציה ספציפית - רלוונטי רק לגרסה חדשה (אפליקציה חדשה עדיין אין למי לעקוב אחריה).
  if (isUpdate) conditions.push({ type: "app", target: app.id });

  const userIds: string[] = [];
  for (const c of conditions) {
    const { data } = await admin
      .from("notification_subscriptions")
      .select("user_id")
      .eq("type", c.type)
      .eq("target_id", c.target);
    for (const r of data ?? []) userIds.push(r.user_id);
  }

  // עוקבים חברתיים של המפתח (user_follows) - מקבלים התראה על אפליקציה חדשה שלו (לא על עדכון).
  if (!isUpdate) {
    const { data: followers } = await admin
      .from("user_follows")
      .select("follower_id")
      .eq("following_id", app.developer_id);
    for (const r of followers ?? []) userIds.push(r.follower_id);
  }

  // לא מתריעים למפתח על האפליקציה של עצמו.
  const targets = [...new Set(userIds)].filter((id) => id !== app.developer_id);
  if (targets.length === 0) return;

  const title = isUpdate
    ? `${devName} עדכן: ${app.name}`
    : isPublic
    ? `אפליקציה ציבורית חדשה: ${app.name}`
    : `${devName} פרסם: ${app.name}`;

  await deliver(targets, {
    kind: isUpdate ? "app_update" : isPublic ? "new_public" : "new_app",
    title,
    body: "לחצו לצפייה בחנות",
    url: `/apps/${app.id}`
  });
}

// נקרא כשמתפרסמת תגובת טקסט חדשה (לא רק דירוג בכוכבים) על אפליקציה - מתריע למפתח שהעלה אותה.
export async function notifyForAppComment(appId: string, reviewerUsername: string, comment: string): Promise<void> {
  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("id, name, developer_id").eq("id", appId).maybeSingle();
  if (!app || !app.developer_id) return;

  await deliver([app.developer_id], {
    kind: "app_comment",
    title: `${reviewerUsername} הגיב/ה על ${app.name}`,
    body: comment.slice(0, 100),
    url: `/apps/${app.id}`
  });
}

// נקרא כשמשתמש מפרסם פוסט ראשי חדש בפורום - מתריע לעוקבים החברתיים שלו (user_follows).
export async function notifyForNewForumThread(postId: string): Promise<void> {
  const admin = createAdminSupabase();
  const { data: post } = await admin
    .from("forum_posts")
    .select("id, user_id, title, body, hidden, author:profiles!forum_posts_user_id_fkey(username)")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.hidden) return;

  const { data: followers } = await admin.from("user_follows").select("follower_id").eq("following_id", post.user_id);
  const targets = [...new Set((followers ?? []).map((r) => r.follower_id))].filter((id) => id !== post.user_id);

  const name = (post as any).author?.username ?? "משתמש";
  const snippet = (post.title || post.body).slice(0, 70);
  const notif = {
    kind: "forum_post",
    title: `${name} כתב בפורום: ${snippet}`,
    body: "לחצו לצפייה ולתגובה",
    url: `/forum/${post.id}`
  };
  if (targets.length > 0) await deliver(targets, notif);

  // הצוות (מנהל בפועל + פיקוח) רואה בפעמון ההתראות כל פוסט חדש בפורום, גם בלי לעקוב.
  await notifyStaffInApp(notif, post.user_id);
}

// נקרא כשמתפרסמת תגובה חדשה בפורום - מתריע לעוקבי הדיון (type='forum_thread').
export async function notifyForForumReply(replyId: string): Promise<void> {
  const admin = createAdminSupabase();
  const { data: reply } = await admin
    .from("forum_posts")
    .select("id, user_id, parent_id, body, hidden, author:profiles!forum_posts_user_id_fkey(username)")
    .eq("id", replyId)
    .maybeSingle();
  if (!reply || reply.hidden || !reply.parent_id) return;

  const { data: root } = await admin.from("forum_posts").select("id, title, body").eq("id", reply.parent_id).maybeSingle();
  if (!root) return;

  const { data: subs } = await admin
    .from("notification_subscriptions")
    .select("user_id")
    .eq("type", "forum_thread")
    .eq("target_id", reply.parent_id);
  const targets = [...new Set((subs ?? []).map((r) => r.user_id))].filter((id) => id !== reply.user_id);

  const name = (reply as any).author?.username ?? "משתמש";
  const threadTitle = (root.title || root.body).slice(0, 60);
  const notif = {
    kind: "forum_reply",
    title: `${name} הגיב ל: ${threadTitle}`,
    body: reply.body.slice(0, 90),
    url: `/forum/${reply.parent_id}`
  };
  if (targets.length > 0) await deliver(targets, notif);

  // הצוות רואה בפעמון ההתראות כל תגובה חדשה בפורום, גם אם לא עוקב אחרי הדיון.
  await notifyStaffInApp(notif, reply.user_id);
}

// התראה בתוך האתר (feed + push) לכל המנהלים - למקרים שהמנהל חייב לדעת עליהם מיד.
export async function notifyAdminsInApp(notif: {
  kind: string;
  title: string;
  body: string;
  url: string;
}): Promise<void> {
  const admin = createAdminSupabase();
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  await deliver((admins ?? []).map((a) => a.id), notif);
}

// התראה בתוך האתר (feed + push) לכל הצוות - מנהל בפועל וגם צוות פיקוח (is_moderator).
// excludeUserId - לא לשלוח למי שביצע את הפעולה עצמה (למשל חבר צוות שכתב את הפוסט).
export async function notifyStaffInApp(
  notif: { kind: string; title: string; body: string; url: string },
  excludeUserId?: string
): Promise<void> {
  const admin = createAdminSupabase();
  const { data: staff } = await admin.from("profiles").select("id, role, is_moderator").or("role.eq.admin,is_moderator.eq.true");
  const ids = (staff ?? []).map((s) => s.id).filter((id) => id !== excludeUserId);
  await deliver(ids, notif);
}

// נקרא כשמתפרסמת בקשת קהילה חדשה.
export async function notifyForCommunityRequest(requestId: string, title: string, byUserId: string): Promise<void> {
  const admin = createAdminSupabase();
  const { data } = await admin.from("notification_subscriptions").select("user_id").eq("type", "community").eq("target_id", "");
  const targets = [...new Set((data ?? []).map((r) => r.user_id))].filter((id) => id !== byUserId);
  if (targets.length === 0) return;
  await deliver(targets, {
    kind: "community_request",
    title: `בקשת קהילה חדשה: ${title}`,
    body: "מישהו מבקש אפליקציה/תוכנה - אולי תוכלו לעזור",
    url: "/community"
  });
}
