import { createServerSupabase } from "./supabase/server";
import { createAdminSupabase } from "./supabase/admin";
import { publicAssetUrl } from "./r2";
import type { AppRow } from "@/types/database";
import { isUuid } from "./appPath";
import { memo } from "./memo";

export async function getApprovedApps(): Promise<AppRow[]> {
  const supabase = createServerSupabase();
  // אפליקציות נעוצות ע"י מנהל (pinned) קודם - החדשה שבהן ראשונה - ואז השאר לפי מועד הפרסום
  // האחרון (published_at): אפליקציה שקיבלה גרסה חדשה מאושרת עולה למעלה כאילו היא חדשה.
  const { data, error } = await supabase
    .from("apps")
    .select("*, developer:profiles!apps_developer_id_fkey(username)")
    .eq("status", "approved")
    .order("pinned", { ascending: false })
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  // עמידות: אם עמודות הנעיצה עדיין לא קיימות (המיגרציה 0033 לא הורצה במסד) - המיון לעיל
  // נכשל. במקרה כזה נופלים חזרה למיון הרגיל לפי תאריך בלבד, כדי שהעמוד הראשי לא יישבר.
  if (error) {
    const { data: fallback } = await supabase
      .from("apps")
      .select("*, developer:profiles!apps_developer_id_fkey(username)")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    return (fallback as unknown as AppRow[]) ?? [];
  }

  return (data as unknown as AppRow[]) ?? [];
}

// מצמצם אפליקציה למה שכרטיס בעמוד הבית באמת צריך: בלי שדות ריקים/שקריים ובלי מה שנטען רק בפתיחת החלונית
// (פוסט, צילומי מסך, סרטון) או כפול (icon_key - הכתובת כבר נשלחת כ-iconUrl). קטן פי כמה ברשימה של מאות.
const CARD_DROP_KEYS = new Set(["icon_key", "updated_at", "published_at", "package_name", "pinned_at", "screenshot_keys", "video_key", "description_html"]);
export function slimForCard(app: AppRow): AppRow {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(app)) {
    if (v === null || v === undefined || v === false || CARD_DROP_KEYS.has(k)) continue;
    if (k === "file_key" && app.file_name) continue;
    out[k] = v;
  }
  return out as unknown as AppRow;
}

// רשימת הכרטיסים בעמוד הבית: רק העמודות שהכרטיס והחלונית באמת משתמשים בהן - בלי פוסט הפרסום
// המלא (description_html, שהיה רוב משקל הדף - מגה-בייטים). הפוסט נטען בנפרד כשהחלונית נפתחת
// (api/apps/[id]/description) והחיפוש בתוכנו נעשה בשרת (api/apps/search). התוצאה משותפת בין
// גולשים ל-10 שניות.
const LITE_COLUMNS =
  "id, developer_id, name, short_description, version, category, icon_key, file_name, file_key, file_size_bytes, min_android_version, status, downloads_count, platform_override, download_paused, download_paused_until, source, developer_name, offline_support, pinned, pinned_at, last_updated_at, published_at, created_at, updated_at, slug, screenshot_keys, video_key, package_name";

// שאילתת השרת עצמה (admin) - התוצאה משותפת לכל הגולשים, ולכן לא תלויה בהרשאות של מי שפתח אותה
// ראשון. נחשפים בה רק שדות ציבוריים (שם המפתח מוצג ממילא ברשימת המשתמשים).
export async function getApprovedAppsLite(): Promise<AppRow[]> {
  return memo("apps:approved-lite", 20_000, async () => {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("apps")
      .select(`${LITE_COLUMNS}, developer:profiles!apps_developer_id_fkey(username)`)
      .eq("status", "approved")
      .order("pinned", { ascending: false })
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    // עמידות: אם עמודה חסרה (מיגרציה שעוד לא רצה) - חוזרים לשליפה המלאה הישנה
    if (error) return getApprovedApps();
    return ((data ?? []) as unknown as AppRow[]).map((a) => ({ ...a, description_html: "" }));
  });
}

export async function getAppById(id: string): Promise<AppRow | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("apps")
    .select("*, developer:profiles!apps_developer_id_fkey(username, points, is_pro)")
    .eq("id", id)
    .single();
  return (data as unknown as AppRow) ?? null;
}

// מקבל id (קישורים ישנים) או slug (/apps/com.myapp או /apps/UserName/myapp).
export async function getAppByKey(key: string): Promise<AppRow | null> {
  if (isUuid(key)) return getAppById(key);
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("apps")
    .select("*, developer:profiles!apps_developer_id_fkey(username, points, is_pro)")
    .eq("slug", key.toLowerCase())
    .maybeSingle();
  return (data as unknown as AppRow) ?? null;
}

export async function getIconUrl(iconKey: string | null): Promise<string | null> {
  if (!iconKey) return null;
  try {
    return publicAssetUrl(iconKey);
  } catch {
    return null;
  }
}
