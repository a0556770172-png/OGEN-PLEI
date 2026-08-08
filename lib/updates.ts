import { createAdminSupabase } from "./supabase/admin";

// פיצ'ר 5: התראות חכמות על עדכוני גרסה.
// מזהה עבור משתמש מסוים אילו אפליקציות הוא כבר הוריד בעבר - וכעת קיימת להן גרסה חדשה
// יותר (הגרסה שהוריד שונה מהגרסה המפורסמת הנוכחית). משמש גם ל-Badge על ריבוע האפליקציה
// בעמוד הראשי, וגם לחלונית הכניסה שמסכמת את כל העדכונים הזמינים.

export interface AppUpdateInfo {
  appId: string;
  name: string;
  downloadedVersion: string | null;
  currentVersion: string;
}

// מחזיר מפה של appId -> פרטי העדכון, רק לאפליקציות מאושרות שהמשתמש הוריד גרסה ישנה שלהן.
export async function getUserAppUpdates(userId: string): Promise<Map<string, AppUpdateInfo>> {
  const result = new Map<string, AppUpdateInfo>();
  if (!userId) return result;

  const admin = createAdminSupabase();

  // כל אירועי ההורדה של המשתמש, מהחדש לישן - כדי לשמור את הגרסה שהוא הוריד לאחרונה לכל אפליקציה.
  const { data: events } = await admin
    .from("download_events")
    .select("app_id, downloaded_version, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!events || events.length === 0) return result;

  // גרסת ההורדה האחרונה לכל אפליקציה (הרשומה הראשונה שנתקלים בה כי הרשימה ממויינת יורד).
  const lastDownloaded = new Map<string, string | null>();
  for (const ev of events) {
    if (!lastDownloaded.has(ev.app_id)) lastDownloaded.set(ev.app_id, ev.downloaded_version ?? null);
  }

  const appIds = [...lastDownloaded.keys()];
  const { data: apps } = await admin
    .from("apps")
    .select("id, name, version, status")
    .in("id", appIds)
    .eq("status", "approved");

  for (const app of apps ?? []) {
    const downloaded = lastDownloaded.get(app.id) ?? null;
    // רק אם ידועה הגרסה שהורדה (הורדות ישנות מלפני המעקב הן null - לא מסמנים כדי לא ליצור
    // התראת שווא) והיא שונה מהגרסה המפורסמת כרגע.
    if (downloaded && downloaded !== app.version) {
      result.set(app.id, {
        appId: app.id,
        name: app.name,
        downloadedVersion: downloaded,
        currentVersion: app.version
      });
    }
  }

  return result;
}
