import { createAdminSupabase } from "./supabase/admin";
import { sendPushToUser } from "./push";

export type SubType = "developer" | "category" | "new_public" | "all_new";

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

  const userIds: string[] = [];
  for (const c of conditions) {
    const { data } = await admin
      .from("notification_subscriptions")
      .select("user_id")
      .eq("type", c.type)
      .eq("target_id", c.target);
    for (const r of data ?? []) userIds.push(r.user_id);
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
