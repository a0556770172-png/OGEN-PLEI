import { createAdminSupabase } from "./supabase/admin";
import { addPoints } from "./points";

// "ציבורי ופרטי": העברת אפליקציה בין ציבורית (הצעה למאגר - נעולה לעריכה) לפרטית (בבעלות
// מפתח שיכול לערוך ולהעלות גרסאות), ו/או העברת הבעלות למשתמש אחר.
//
// מוניטין רטרואקטיבי: כל המוניטין שהאפליקציה הניבה עובר יחד איתה מהבעלים הקודם לחדש -
// הבונוס על ההעלאה/ההצעה, +2 על כל הורדה ו-+1 על כל לייק. כך הבעלים הקודם לא נשאר עם
// מוניטין על אפליקציה שכבר לא שלו, והחדש מקבל בדיוק את מה שהיא הרוויחה.
//
// איך זה נשאר מדויק גם אחרי כמה העברות הלוך ושוב: כל מה שנרשם ב-points_log עם app_id
// (העלאה, הורדות, והעברות קודמות) מסוכם לכל משתמש; לייקים לא נרשמים ביומן אלא תמיד
// מזוכים לבעלים הנוכחי, ולכן הם מועברים לפי מספר הלייקים הנוכחי ונרשמים בנפרד (LIKES_REASON)
// כדי לא להיספר פעמיים. בונוס של הצעה ציבורית נרשם בעבר בלי app_id - בהעברה הראשונה
// הוא "משוחזר" ליומן (BASE_REASON) בלי לשנות את המוניטין, כדי שגם הוא יעבור.

const BASE_REASON = "app_base_backfill";
const LIKES_REASON = "app_transfer_likes";
const SUGGESTION_POINTS = 5; // כמו ב-app/api/suggestions/[id]/route.ts

export type AppSource = "public_suggestion" | "developer_upload";

export type OwnershipPreview = {
  appId: string;
  appName: string;
  fromSource: AppSource;
  toSource: AppSource;
  from: { id: string; username: string };
  to: { id: string; username: string };
  ownerChanges: boolean;
  loggedPoints: number; // העלאה/הצעה + הורדות (+ העברות קודמות)
  likePointsOut: number; // לייקים שהבעלים הקודם מאבד
  likePointsIn: number; // לייקים שהחדש מקבל (בלי לייק שהוא עצמו נתן לאפליקציה)
};

type Admin = ReturnType<typeof createAdminSupabase>;

async function ensureBaseBackfilled(admin: Admin, app: { id: string; source: string }) {
  if (app.source !== "public_suggestion") return; // בהעלאה פרטית הבונוס כבר נרשם עם app_id
  const { count } = await admin
    .from("points_log")
    .select("id", { count: "exact", head: true })
    .eq("app_id", app.id)
    .eq("reason", BASE_REASON);
  if ((count ?? 0) > 0) return;
  const { data: suggestion } = await admin
    .from("app_suggestions")
    .select("suggested_by, points_awarded")
    .eq("created_app_id", app.id)
    .maybeSingle();
  if (!suggestion?.points_awarded || !suggestion.suggested_by) return;
  // רישום בלבד - המציע כבר קיבל את הנקודות האלה בזמן אישור ההצעה.
  await admin.from("points_log").insert({ profile_id: suggestion.suggested_by, delta: SUGGESTION_POINTS, reason: BASE_REASON, app_id: app.id });
}

async function loggedPointsFor(admin: Admin, appId: string, profileId: string): Promise<number> {
  const { data } = await admin
    .from("points_log")
    .select("delta, reason")
    .eq("app_id", appId)
    .eq("profile_id", profileId)
    .limit(10000);
  return (data ?? []).filter((r) => r.reason !== LIKES_REASON).reduce((sum, r) => sum + (r.delta ?? 0), 0);
}

// לייק שבעל האפליקציה עצמו נתן (לפני שהפכה לשלו) מעולם לא זיכה אותו - לכן כל צד מאבד/מקבל
// רק את הלייקים של אחרים.
async function likeCounts(admin: Admin, appId: string, fromId: string, toId: string) {
  const countBy = async (userId?: string) => {
    let q = admin.from("app_likes").select("id", { count: "exact", head: true }).eq("app_id", appId);
    if (userId) q = q.eq("user_id", userId);
    const { count } = await q;
    return count ?? 0;
  };
  const [total, byFrom, byTo] = await Promise.all([countBy(), countBy(fromId), countBy(toId)]);
  return { out: total - byFrom, in: total - byTo };
}

export async function findUserByUsername(username: string) {
  const admin = createAdminSupabase();
  const clean = username.trim();
  if (!clean) return null;
  const escaped = clean.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data } = await admin.from("profiles").select("id, username, role").ilike("username", escaped).limit(1).maybeSingle();
  return data;
}

// מחשב מה יקרה בהעברה - בלי לשנות כלום (לתצוגה מקדימה לפני אישור).
export async function previewOwnership(appId: string, toSource: AppSource, toUserId: string | null): Promise<OwnershipPreview | { error: string }> {
  const admin = createAdminSupabase();
  const { data: app } = await admin
    .from("apps")
    .select("id, name, source, developer_id, developer:profiles!apps_developer_id_fkey(id, username)")
    .eq("id", appId)
    .single();
  if (!app) return { error: "האפליקציה לא נמצאה" };

  const fromSource: AppSource = app.source === "public_suggestion" ? "public_suggestion" : "developer_upload";
  const fromUser = { id: app.developer_id as string, username: (app as any).developer?.username ?? "—" };

  let toUser = fromUser;
  if (toUserId && toUserId !== fromUser.id) {
    const { data: p } = await admin.from("profiles").select("id, username, role").eq("id", toUserId).single();
    if (!p) return { error: "המשתמש החדש לא נמצא" };
    toUser = { id: p.id, username: p.username };
  }

  // אפליקציה פרטית מנוהלת בדשבורד המפתח - הבעלים שלה חייב להיות מפתח (או מנהל).
  if (toSource === "developer_upload") {
    const { data: owner } = await admin.from("profiles").select("role").eq("id", toUser.id).single();
    if (owner?.role !== "developer" && owner?.role !== "admin") {
      return { error: `${toUser.username} הוא משתמש רגיל ולא מפתח - אפליקציה פרטית חייבת להיות בבעלות מפתח (הוא יכול להירשם כמפתח מהפרופיל)` };
    }
  }

  const ownerChanges = toUser.id !== fromUser.id;
  if (!ownerChanges && toSource === fromSource) return { error: "אין שינוי - האפליקציה כבר במצב הזה ובבעלות הזו" };

  let loggedPoints = 0;
  let likePointsOut = 0;
  let likePointsIn = 0;
  if (ownerChanges) {
    loggedPoints = await loggedPointsFor(admin, app.id, fromUser.id);
    // בונוס הצעה ציבורית שעוד לא שוחזר ליומן - נספר כאן בתצוגה המקדימה (ישוחזר בביצוע).
    if (fromSource === "public_suggestion") {
      const { count } = await admin.from("points_log").select("id", { count: "exact", head: true }).eq("app_id", app.id).eq("reason", BASE_REASON);
      if ((count ?? 0) === 0) {
        const { data: s } = await admin.from("app_suggestions").select("suggested_by, points_awarded").eq("created_app_id", app.id).maybeSingle();
        if (s?.points_awarded && s.suggested_by === fromUser.id) loggedPoints += SUGGESTION_POINTS;
      }
    }
    const likes = await likeCounts(admin, app.id, fromUser.id, toUser.id);
    likePointsOut = likes.out;
    likePointsIn = likes.in;
  }

  return {
    appId: app.id,
    appName: app.name,
    fromSource,
    toSource,
    from: fromUser,
    to: toUser,
    ownerChanges,
    loggedPoints: Math.max(0, loggedPoints),
    likePointsOut,
    likePointsIn
  };
}

// מבצע את ההעברה בפועל. מחזיר את התצוגה המקדימה שבוצעה.
export async function transferOwnership(appId: string, toSource: AppSource, toUserId: string | null) {
  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("id, source").eq("id", appId).single();
  if (!app) return { error: "האפליקציה לא נמצאה" } as const;
  if (toUserId) await ensureBaseBackfilled(admin, app);

  const preview = await previewOwnership(appId, toSource, toUserId);
  if ("error" in preview) return preview;

  const { error } = await admin.from("apps").update({ source: toSource, developer_id: preview.to.id }).eq("id", appId);
  if (error) return { error: "שגיאה בעדכון האפליקציה" } as const;

  if (preview.ownerChanges) {
    const { from, to, loggedPoints, likePointsOut, likePointsIn } = preview;
    const rows = [];
    if (loggedPoints) {
      rows.push({ profile_id: from.id, delta: -loggedPoints, reason: "app_transfer_out", app_id: appId });
      rows.push({ profile_id: to.id, delta: loggedPoints, reason: "app_transfer_in", app_id: appId });
    }
    if (likePointsOut) rows.push({ profile_id: from.id, delta: -likePointsOut, reason: LIKES_REASON, app_id: appId });
    if (likePointsIn) rows.push({ profile_id: to.id, delta: likePointsIn, reason: LIKES_REASON, app_id: appId });
    if (rows.length) await admin.from("points_log").insert(rows);
    if (loggedPoints + likePointsOut) await addPoints(from.id, -(loggedPoints + likePointsOut));
    if (loggedPoints + likePointsIn) await addPoints(to.id, loggedPoints + likePointsIn);
  }

  return preview;
}
