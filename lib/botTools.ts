import { createAdminSupabase } from "./supabase/admin";
import { getIconUrl } from "./apps-data";
import { getCategoriesServer } from "./categories";
import { getUserAppUpdates } from "./updates";
import { getSiteSettingsServer } from "./settings";
import { DEFAULT_SITE_RULES_HTML } from "./siteRulesDefault";
import { LIMITS, MAX_SUGGESTION_MB, REFERRAL } from "./constants";
import type { Profile } from "@/types/database";

// ============================================================
// כלים (Tools) שהסוכן קורא להם דרך function-calling של Gemini.
// כל כלי: הצהרה (schema ל-Gemini) + executor שרץ בשרת.
// כלים "כותבים" לא מבצעים בפועל - הם מחזירים proposedAction שה-UI מציג
// לאישור, ואז app/api/bot/confirm מבצע.
// ============================================================

export interface BotAppCard {
  id: string;
  name: string;
  category: string;
  type: "apk" | "software";
  downloads: number;
  rating: number | null;
  iconUrl: string | null;
}

export interface ProposedAction {
  kind: "support_ticket" | "app_suggestion";
  payload: Record<string, any>;
  summary: string;
}

// פעולת לקוח - הצ'אט מבצע אותה בדפדפן (ניווט בין דפים / הפעלת הורדה).
// auto=true פירושו שהמשתמש ביקש במפורש "פשוט תעשה" והצ'אט מבצע אחרי ספירה קצרה עם ביטול.
export interface ClientAction {
  kind: "navigate" | "download";
  url?: string; // ל-navigate
  appId?: string; // ל-download
  label: string;
  auto?: boolean;
}

// נתיבים פנימיים מותרים לניווט אוטומטי של הבוט.
const ALLOWED_NAV = [
  "/",
  "/community",
  "/about",
  "/site-rules",
  "/support",
  "/suggest-app",
  "/profile",
  "/profile/become-developer",
  "/dashboard/developer/upload",
  "/users"
];

export interface ToolContext {
  userId: string;
  profile: Profile;
  isStaff: boolean;
  isDeveloper: boolean;
  conversationId: string;
}

export interface ToolOutcome {
  result: any; // נשלח חזרה ל-Gemini (קומפקטי)
  appCards?: BotAppCard[];
  proposedAction?: ProposedAction;
  clientAction?: ClientAction;
  summary: string; // ללוג
}

function isApkFile(name?: string | null, key?: string | null) {
  return /\.(apk|apks|xapk)$/i.test(name || "") || /\.(apk|apks|xapk)$/i.test(key || "");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

async function toCards(rows: any[]): Promise<BotAppCard[]> {
  return Promise.all(
    rows.map(async (a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      type: isApkFile(a.file_name, a.file_key) ? ("apk" as const) : ("software" as const),
      downloads: a.downloads_count ?? 0,
      rating: a.__rating ?? null,
      iconUrl: await getIconUrl(a.icon_key ?? null)
    }))
  );
}

async function attachRatings(admin: any, rows: any[]): Promise<any[]> {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const { data: reviews } = await admin.from("app_reviews").select("app_id, rating").in("app_id", ids);
  const agg = new Map<string, { sum: number; n: number }>();
  for (const r of reviews ?? []) {
    const cur = agg.get(r.app_id) ?? { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    agg.set(r.app_id, cur);
  }
  return rows.map((r) => {
    const a = agg.get(r.id);
    return { ...r, __rating: a ? Math.round((a.sum / a.n) * 10) / 10 : null, __reviewCount: a?.n ?? 0 };
  });
}

// ---------- הצהרות הכלים ל-Gemini ----------
export function toolDeclarations(ctx: ToolContext) {
  const decls: any[] = [
    {
      name: "search_apps",
      description: "מחפש אפליקציות/תוכנות מאושרות במאגר לפי טקסט חופשי ו/או מסננים. משתמשים בזה כשהמשתמש מחפש משהו ספציפי.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "מילות חיפוש חופשיות (שם/נושא)" },
          category: { type: "string", description: "ערך קטגוריה (value) מתוך רשימת הקטגוריות" },
          offline: { type: "boolean", description: "true = רק כאלה שעובדות אופליין" },
          type: { type: "string", enum: ["apk", "software"], description: "apk = אפליקציית אנדרואיד, software = תוכנת מחשב" },
          sort: { type: "string", enum: ["downloads", "rating", "new"], description: "מיון התוצאות" },
          limit: { type: "number", description: "כמה תוצאות (ברירת מחדל 8, מקסימום 12)" }
        }
      }
    },
    {
      name: "get_app_details",
      description: "פרטים מלאים על אפליקציה אחת: תיאור מלא, דירוג, מספר ביקורות, דיווחים מאושרים, גרסה, גודל, מפתח.",
      parameters: { type: "object", properties: { app_id: { type: "string" } }, required: ["app_id"] }
    },
    {
      name: "recommend_for_user",
      description: "מחזיר המלצות אפליקציות מותאמות למשתמש הזה לפי מה שהוריד בעבר ומה פופולרי שהוא עוד לא הוריד. משתמשים בזה כשהמשתמש מבקש המלצות או לא יודע מה לחפש.",
      parameters: { type: "object", properties: { limit: { type: "number" } } }
    },
    {
      name: "whats_updated",
      description: "אילו אפליקציות שהמשתמש הוריד בעבר קיבלו מאז גרסה חדשה.",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "get_my_notifications",
      description: "ההתראות של המשתמש במרכז ההתראות באתר - מה חדש, מה עדיין לא ראה. משתמשים בזה לשאלות 'מה פספסתי', 'יש לי התראות', 'מה חדש מהמפתחים שאני עוקב'.",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "get_my_notification_subscriptions",
      description: "למי/למה המשתמש רשום לקבל התראות (מפתחים, קטגוריות, אפליקציות ספציפיות, כל חדש).",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "manage_notification",
      description: "רושם או מבטל מנוי התראות למשתמש. developer=לפי שם מפתח, app=לפי שם אפליקציה, category=לפי שם קטגוריה, community=בקשות קהילה חדשות, new_public=כל אפליקציה ציבורית חדשה, all_new=כל אפליקציה חדשה. פעולה זו הפיכה ולא דורשת אישור.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["subscribe", "unsubscribe"] },
          target_type: { type: "string", enum: ["developer", "app", "category", "community", "new_public", "all_new"] },
          target_name: { type: "string", description: "שם המפתח / האפליקציה / הקטגוריה (לא צריך לסוגים הגלובליים)" }
        },
        required: ["action", "target_type"]
      }
    },
    {
      name: "get_my_progress",
      description: "מצב המשתמש: מוניטין, כמה חסר ל-PRO וללייק/תגובה/צ'אט, כמה חברים הזמין, וסטטוס האפליקציות שלו. משתמשים בזה לשאלות על 'איפה אני עומד' או כשרוצים לדחוף אותו לפעולה.",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "explain_how_to",
      description: "מחזיר את הטקסט הרשמי של חוקי האתר וההסברים (העלאה, מוניטין, PRO, הפניות, מסלולי העלאה, תמיכה).",
      parameters: { type: "object", properties: { topic: { type: "string", description: "הנושא שרוצים להסביר" } } }
    },
    {
      name: "get_referral_link",
      description: "הקישור האישי של המשתמש להזמנת חברים + כמה הרוויח וכמה הפניות נותרו היום.",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "draft_referral_message",
      description: "מנסח הודעת שיתוף מוכנה (עם קישור ההפניה) שהמשתמש יכול לשלוח לחברים בוואטסאפ.",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "what_can_i_earn_today",
      description: "מחזיר רשימה קונקרטית של מה שהמשתמש יכול להרוויח היום (מוניטין מהורדות שנותרו, מהפניות, מהעלאות) - עם המספרים המדויקים. השתמש בזה כדי לתמרץ אותו.",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "get_leaderboard",
      description: "טבלת המובילים במוניטין + המיקום של המשתמש. משתמשים בזה לשאלות 'איפה אני בטבלה' או כדי לעורר תחרותיות.",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "get_points_history",
      description: "מאיפה המשתמש קיבל מוניטין לאחרונה (העלאות, הורדות, הפניות...).",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "check_duplicate",
      description: "בודק אם כבר קיימת במאגר אפליקציה בשם דומה - למפתח שרוצה להעלות, כדי למנוע כפילות.",
      parameters: { type: "object", properties: { app_name: { type: "string" } }, required: ["app_name"] }
    },
    {
      name: "list_community_requests",
      description: "רשימת בקשות קהילה פתוחות (אפליקציות שמשתמשים ביקשו ומחכות שמישהו יעלה). שימושי להצעה למפתח מה כדאי לו להעלות.",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "get_site_stats",
      description: "סטטיסטיקות ציבוריות של האתר: מספר אפליקציות, הורדות, משתמשים.",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "offer_download",
      description: "מציע למשתמש להוריד אפליקציה ספציפית - מציג כפתור הורדה בולט בצ'אט. השתמש בזה כשהמשתמש מחפש אפליקציה, מצאת אותה, והוא רוצה להתקין. אם המשתמש אמר במפורש 'תוריד לי' / 'כן תוריד' - קבע auto=true והצ'אט יתחיל את ההורדה לבד.",
      parameters: {
        type: "object",
        properties: { app_id: { type: "string" }, auto: { type: "boolean", description: "true = להתחיל הורדה אוטומטית (רק אם המשתמש ביקש במפורש)" } },
        required: ["app_id"]
      }
    },
    {
      name: "go_to_page",
      description: "מעביר את המשתמש לדף אחר באתר (הצ'אט ינווט). השתמש בזה כשהמשתמש רוצה להגיע למקום מסוים - תמיכה, בקשות קהילה, הרשמה כמפתח וכו'. אם המשתמש אמר 'קח אותי לשם' - קבע auto=true.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: `אחד מ: ${ALLOWED_NAV.join(", ")}` },
          auto: { type: "boolean" }
        },
        required: ["path"]
      }
    },
    {
      name: "start_upload",
      description: "פותח למשתמש (מפתח) את דף העלאת האפליקציה עם השדות ממולאים מראש ממה שסוכם בשיחה. השתמש בזה אחרי שהבנת מהמשתמש איזו אפליקציה הוא מעלה, שמה, תיאור וקטגוריה. אם המשתמש מוכן - קבע auto=true והצ'אט יעביר אותו לשם.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          short_description: { type: "string", description: "תיאור קצר עד 140 תווים" },
          description: { type: "string", description: "תיאור מלא" },
          category: { type: "string", description: "ערך קטגוריה (value)" },
          min_android: { type: "string" },
          offline_support: { type: "string", enum: ["offline", "online", "unknown"] },
          auto: { type: "boolean" }
        }
      }
    },
    {
      name: "propose_support_ticket",
      description: "כשאי אפשר לעזור למשתמש - מכינים פנייה לצוות. זה לא שולח מיד; המשתמש יאשר. השתמש בזה במקום להגיד 'אני לא יודע'.",
      parameters: {
        type: "object",
        properties: { subject: { type: "string" }, body: { type: "string", description: "כולל סיכום קצר של מה שהמשתמש צריך" } },
        required: ["subject", "body"]
      }
    },
    {
      name: "propose_app_suggestion",
      description: "מכין הצעת אפליקציה ציבורית להוספה למאגר (כשהמשתמש אמר 'חבל שאין את X'). לא שולח מיד; המשתמש יאשר.",
      parameters: {
        type: "object",
        properties: {
          app_name: { type: "string" },
          app_link: { type: "string", description: "קישור למקור האפליקציה אם ידוע" },
          note: { type: "string", description: "למה כדאי להוסיף אותה" }
        },
        required: ["app_name"]
      }
    }
  ];

  if (ctx.isDeveloper) {
    decls.push({
      name: "get_my_apps_status",
      description: "סטטוס כל האפליקציות שהמשתמש (מפתח) העלה: מאושר/ממתין/נדחה + סיבת דחייה + הערות צוות.",
      parameters: { type: "object", properties: {} }
    });
  }

  return decls;
}

// ---------- ה-executors ----------
export async function executeTool(name: string, rawArgs: any, ctx: ToolContext): Promise<ToolOutcome> {
  const admin = createAdminSupabase();
  const args = rawArgs && typeof rawArgs === "object" ? rawArgs : {};

  switch (name) {
    case "search_apps": {
      const limit = Math.min(12, Math.max(1, Number(args.limit) || 8));
      let q = admin
        .from("apps")
        .select("id, name, short_description, category, version, min_android_version, offline_support, downloads_count, file_name, file_key, icon_key")
        .eq("status", "approved");
      if (typeof args.category === "string" && args.category) q = q.eq("category", args.category);
      if (args.offline === true) q = q.eq("offline_support", "offline");
      if (typeof args.query === "string" && args.query.trim()) {
        const term = args.query.trim().replace(/[%,()]/g, " ");
        q = q.or(`name.ilike.%${term}%,short_description.ilike.%${term}%`);
      }
      if (args.sort === "downloads") q = q.order("downloads_count", { ascending: false });
      else if (args.sort === "new") q = q.order("created_at", { ascending: false });
      else q = q.order("downloads_count", { ascending: false });

      let { data } = await q.limit(args.type ? 40 : limit);
      let rows = (data ?? []) as any[];
      if (args.type === "apk") rows = rows.filter((r) => isApkFile(r.file_name, r.file_key));
      if (args.type === "software") rows = rows.filter((r) => !isApkFile(r.file_name, r.file_key));
      rows = rows.slice(0, limit);
      rows = await attachRatings(admin, rows);
      if (args.sort === "rating") rows.sort((a, b) => (b.__rating ?? 0) - (a.__rating ?? 0));

      return {
        result: rows.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          type: isApkFile(r.file_name, r.file_key) ? "אפליקציית אנדרואיד" : "תוכנת מחשב",
          offline: r.offline_support,
          min_android: r.min_android_version,
          downloads: r.downloads_count,
          rating: r.__rating,
          short: r.short_description
        })),
        appCards: await toCards(rows),
        summary: `search_apps → ${rows.length} תוצאות`
      };
    }

    case "get_app_details": {
      const { data: a } = await admin
        .from("apps")
        .select("*, developer:profiles!apps_developer_id_fkey(username)")
        .eq("id", String(args.app_id))
        .eq("status", "approved")
        .single();
      if (!a) return { result: { error: "האפליקציה לא נמצאה או לא מאושרת" }, summary: "get_app_details → not found" };
      const [withRating] = await attachRatings(admin, [a]);
      const { data: reports } = await admin
        .from("app_reports")
        .select("reason")
        .eq("app_id", a.id)
        .eq("status", "approved");
      return {
        result: {
          id: a.id,
          name: a.name,
          description: stripHtml(a.description_html || "").slice(0, 1200),
          short: a.short_description,
          category: a.category,
          version: a.version,
          min_android: a.min_android_version,
          offline: a.offline_support,
          size_mb: Math.round((a.file_size_bytes / 1024 / 1024) * 10) / 10,
          type: isApkFile(a.file_name, a.file_key) ? "אפליקציית אנדרואיד" : "תוכנת מחשב",
          developer: a.developer?.username,
          developer_name: a.developer_name,
          downloads: a.downloads_count,
          rating: withRating.__rating,
          review_count: withRating.__reviewCount,
          approved_reports: (reports ?? []).map((r: any) => r.reason)
        },
        appCards: await toCards([withRating]),
        summary: `get_app_details → ${a.name}`
      };
    }

    case "recommend_for_user": {
      const limit = Math.min(10, Math.max(1, Number(args.limit) || 5));
      const { data: dl } = await admin
        .from("download_events")
        .select("app_id, apps(category)")
        .eq("user_id", ctx.userId)
        .limit(50);
      const downloadedIds = new Set((dl ?? []).map((d: any) => d.app_id));
      const favCats = [...new Set((dl ?? []).map((d: any) => d.apps?.category).filter(Boolean))];

      let rows: any[] = [];
      if (favCats.length) {
        const { data } = await admin
          .from("apps")
          .select("id, name, short_description, category, downloads_count, file_name, file_key, icon_key")
          .eq("status", "approved")
          .in("category", favCats)
          .order("downloads_count", { ascending: false })
          .limit(40);
        rows = (data ?? []).filter((r: any) => !downloadedIds.has(r.id));
      }
      if (rows.length < limit) {
        const { data } = await admin
          .from("apps")
          .select("id, name, short_description, category, downloads_count, file_name, file_key, icon_key")
          .eq("status", "approved")
          .order("downloads_count", { ascending: false })
          .limit(40);
        for (const r of data ?? []) {
          if (!downloadedIds.has(r.id) && !rows.find((x) => x.id === r.id)) rows.push(r);
          if (rows.length >= limit) break;
        }
      }
      rows = await attachRatings(admin, rows.slice(0, limit));
      return {
        result: rows.map((r) => ({ id: r.id, name: r.name, category: r.category, downloads: r.downloads_count, rating: r.__rating, short: r.short_description })),
        appCards: await toCards(rows),
        summary: `recommend_for_user → ${rows.length}`
      };
    }

    case "whats_updated": {
      const map = await getUserAppUpdates(ctx.userId);
      const updates = [...map.values()];
      if (!updates.length) return { result: { updates: [] }, summary: "whats_updated → 0" };
      const ids = updates.map((u: any) => u.appId);
      const { data } = await admin
        .from("apps")
        .select("id, name, version, short_description, category, downloads_count, file_name, file_key, icon_key")
        .in("id", ids);
      const rows = await attachRatings(admin, data ?? []);
      return {
        result: rows.map((r) => ({ id: r.id, name: r.name, current_version: r.version })),
        appCards: await toCards(rows),
        summary: `whats_updated → ${rows.length}`
      };
    }

    case "get_my_notifications": {
      const { data: items } = await admin
        .from("user_notifications")
        .select("kind, title, url, seen_at, created_at")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: false })
        .limit(20);
      const list = items ?? [];
      return {
        result: {
          unseen: list.filter((i: any) => !i.seen_at).length,
          recent: list.map((i: any) => ({
            title: i.title,
            new: !i.seen_at,
            url: i.url,
            when: i.created_at
          }))
        },
        summary: `get_my_notifications → ${list.length}`
      };
    }

    case "get_my_notification_subscriptions": {
      const { data: subs } = await admin
        .from("notification_subscriptions")
        .select("type, target_id")
        .eq("user_id", ctx.userId);
      const rows = subs ?? [];
      const devIds = rows.filter((r: any) => r.type === "developer").map((r: any) => r.target_id);
      const appIds = rows.filter((r: any) => r.type === "app").map((r: any) => r.target_id);
      const [{ data: devs }, { data: apps }, cats] = await Promise.all([
        devIds.length ? admin.from("profiles").select("id, username").in("id", devIds) : Promise.resolve({ data: [] as any[] }),
        appIds.length ? admin.from("apps").select("id, name").in("id", appIds) : Promise.resolve({ data: [] as any[] }),
        getCategoriesServer()
      ]);
      const devMap = new Map((devs ?? []).map((d: any) => [d.id, d.username]));
      const appMap = new Map((apps ?? []).map((a: any) => [a.id, a.name]));
      const catMap = new Map(cats.map((c) => [c.value, c.label]));
      return {
        result: {
          subscriptions: rows.map((r: any) => ({
            type: r.type,
            name:
              r.type === "developer"
                ? devMap.get(r.target_id) ?? "מפתח"
                : r.type === "app"
                ? appMap.get(r.target_id) ?? "אפליקציה"
                : r.type === "category"
                ? catMap.get(r.target_id) ?? r.target_id
                : r.type === "new_public"
                ? "כל אפליקציה ציבורית חדשה"
                : "כל אפליקציה חדשה"
          }))
        },
        summary: `get_my_notification_subscriptions → ${rows.length}`
      };
    }

    case "manage_notification": {
      const action = args.action === "unsubscribe" ? "unsubscribe" : "subscribe";
      const tt = String(args.target_type || "");
      const name = String(args.target_name || "").trim();

      let type = tt;
      let target = "";
      if (tt === "developer") {
        if (!name) return { result: { error: "צריך שם מפתח" }, summary: "manage_notification → no name" };
        const { data: dev } = await admin.from("profiles").select("id").ilike("username", name).limit(1).maybeSingle();
        if (!dev) return { result: { error: `לא נמצא מפתח בשם "${name}"` }, summary: "manage_notification → dev not found" };
        target = (dev as any).id;
      } else if (tt === "app") {
        if (!name) return { result: { error: "צריך שם אפליקציה" }, summary: "manage_notification → no name" };
        const { data: ap } = await admin
          .from("apps")
          .select("id")
          .eq("status", "approved")
          .ilike("name", `%${name.replace(/[%,()]/g, " ")}%`)
          .limit(1)
          .maybeSingle();
        if (!ap) return { result: { error: `לא נמצאה אפליקציה בשם "${name}"` }, summary: "manage_notification → app not found" };
        target = (ap as any).id;
      } else if (tt === "category") {
        const cats = await getCategoriesServer();
        const match = cats.find((c) => c.label === name || c.value === name || c.label.includes(name));
        if (!match) return { result: { error: `לא נמצאה קטגוריה בשם "${name}"` }, summary: "manage_notification → cat not found" };
        target = match.value;
      } else if (tt === "new_public" || tt === "all_new" || tt === "community") {
        target = "";
      } else {
        return { result: { error: "סוג מנוי לא חוקי" }, summary: "manage_notification → bad type" };
      }

      if (action === "subscribe") {
        await admin
          .from("notification_subscriptions")
          .upsert({ user_id: ctx.userId, type, target_id: target }, { onConflict: "user_id,type,target_id" });
      } else {
        await admin
          .from("notification_subscriptions")
          .delete()
          .eq("user_id", ctx.userId)
          .eq("type", type)
          .eq("target_id", target);
      }
      return {
        result: { ok: true, action, type, name: name || (tt === "new_public" ? "אפליקציות ציבוריות חדשות" : "כל אפליקציה חדשה") },
        summary: `manage_notification → ${action} ${type}`
      };
    }

    case "get_my_progress": {
      const p = ctx.profile;
      const { count: activeApps } = await admin.from("apps").select("id", { count: "exact", head: true }).eq("developer_id", p.id).neq("status", "archived");
      const { count: referred } = await admin.from("referral_events").select("id", { count: "exact", head: true }).eq("referrer_id", p.id).eq("status", "rewarded");
      const plan = p.is_pro ? LIMITS.pro : LIMITS.free;
      return {
        result: {
          username: p.username,
          role: ctx.isStaff ? "צוות" : ctx.isDeveloper ? (p.is_pro ? "מפתח PRO" : "מפתח") : "משתמש רגיל",
          points: p.points,
          is_pro: p.is_pro,
          points_to_pro: p.is_pro ? 0 : Math.max(0, 300 - (p.points ?? 0)),
          active_apps: activeApps ?? 0,
          max_apps: plan.maxApps,
          referred_friends: referred ?? 0,
          referral_reward_each: REFERRAL.referrerPoints,
          is_developer: ctx.isDeveloper
        },
        summary: "get_my_progress"
      };
    }

    case "explain_how_to": {
      const settings = await getSiteSettingsServer();
      const rules = stripHtml(settings.site_rules_html || DEFAULT_SITE_RULES_HTML);
      const facts = [
        `מכסות מפתח רגיל: עד ${LIMITS.free.maxApps} אפליקציות, עד ${LIMITS.free.maxFileMb}MB. PRO: עד ${LIMITS.pro.maxApps} / ${LIMITS.pro.maxFileMb}MB. הצעה ציבורית: עד ${MAX_SUGGESTION_MB}MB.`,
        `מוניטין: +5 אפליקציה שאושרה, +5 הצעה ציבורית שאושרה, +2 להורדה (עד 10/יום), +${REFERRAL.referrerPoints} הפניה מוצלחת. PRO אוטומטי ב-300.`,
        `הפניות: /?ref=שם-המשתמש. מפנה +${REFERRAL.referrerPoints} מוניטין + קרדיט ${REFERRAL.sizeOverrideMb}MB, מצטרף +${REFERRAL.joinerPoints}. עד ${REFERRAL.dailyRewardCap}/יום.`,
        `העלאה פרטית: דרך /profile (חשבון מפתח). הצעה ציבורית: דרך /suggest-app (כל משתמש). תמיכה: /support.`
      ].join("\n");
      return { result: { topic: args.topic ?? "", facts, rules: rules.slice(0, 4000) }, summary: `explain_how_to → ${args.topic ?? ""}` };
    }

    case "get_referral_link": {
      const { data: events } = await admin
        .from("referral_events")
        .select("status, referrer_points_awarded, created_at")
        .eq("referrer_id", ctx.userId);
      const list = events ?? [];
      const rewarded = list.filter((e: any) => e.status === "rewarded");
      const since = Date.now() - 24 * 3600 * 1000;
      const todayRewarded = rewarded.filter((e: any) => new Date(e.created_at).getTime() > since).length;
      return {
        result: {
          link: `/?ref=${encodeURIComponent(ctx.profile.username)}`,
          username: ctx.profile.username,
          friends_joined: rewarded.length,
          points_earned: rewarded.reduce((s: number, e: any) => s + (e.referrer_points_awarded || 0), 0),
          rewarded_today: todayRewarded,
          daily_cap: REFERRAL.dailyRewardCap,
          reward_each: REFERRAL.referrerPoints,
          joiner_bonus: REFERRAL.joinerPoints
        },
        summary: "get_referral_link"
      };
    }

    case "draft_referral_message": {
      const link = `/?ref=${encodeURIComponent(ctx.profile.username)}`;
      const msg = `היי! מצאתי אתר מעולה לאפליקציות ותוכנות מסוננות ומאושרות - "עוגן פליי". כל אפליקציה עוברת בדיקה ידנית לפני פרסום. הרשמה דרך הקישור שלי: ${link}`;
      return {
        result: {
          message: msg,
          note: "הצג את ההודעה למשתמש. בעמוד הפרופיל יש כפתור שיתוף וואטסאפ מוכן עם הקישור המלא."
        },
        clientAction: { kind: "navigate", url: "/profile", label: "לכרטיס ההפניה (העתקה ושיתוף)", auto: false },
        summary: "draft_referral_message"
      };
    }

    case "what_can_i_earn_today": {
      const p = ctx.profile;
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [{ count: dlToday }, { count: refToday }, { count: pending }] = await Promise.all([
        admin.from("download_events").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).gte("created_at", since),
        admin.from("referral_events").select("id", { count: "exact", head: true }).eq("referrer_id", ctx.userId).eq("status", "rewarded").gte("created_at", since),
        admin.from("apps").select("id", { count: "exact", head: true }).eq("developer_id", ctx.userId).eq("status", "pending")
      ]);
      const opportunities: string[] = [];
      const dlLeft = Math.max(0, 10 - (dlToday ?? 0));
      // מוניטין להורדה הולך למפתח של האפליקציה, לא למוריד - אז זה רלוונטי רק אם למשתמש יש אפליקציות
      if (ctx.isDeveloper) opportunities.push(`כל הורדה של אפליקציה שלך ע"י משתמש אחר = +2 מוניטין (עד 10 ליום).`);
      const refLeft = Math.max(0, REFERRAL.dailyRewardCap - (refToday ?? 0));
      if (refLeft > 0) opportunities.push(`עוד ${refLeft} הזמנות חברים היום = עד +${refLeft * REFERRAL.referrerPoints} מוניטין (${REFERRAL.referrerPoints} כל אחת).`);
      if (ctx.isDeveloper) opportunities.push(`כל אפליקציה/תוכנה חדשה שתעלה ותאושר = +5 מוניטין.`);
      opportunities.push(`כל הצעת אפליקציה ציבורית שתאושר = +5 מוניטין.`);
      if ((pending ?? 0) > 0) opportunities.push(`יש לך ${pending} אפליקציות בתור בדיקה - כל אחת שתאושר = +5 מוניטין.`);
      return {
        result: {
          current_points: p.points,
          points_to_pro: p.is_pro ? 0 : Math.max(0, 300 - (p.points ?? 0)),
          referrals_left_today: refLeft,
          opportunities
        },
        summary: "what_can_i_earn_today"
      };
    }

    case "get_leaderboard": {
      const { data: top } = await admin
        .from("profiles")
        .select("username, points, is_pro")
        .order("points", { ascending: false })
        .limit(10);
      const { count: ahead } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gt("points", ctx.profile.points ?? 0);
      return {
        result: {
          top: (top ?? []).map((t: any, i: number) => ({ rank: i + 1, username: t.username, points: t.points, pro: t.is_pro })),
          my_rank: (ahead ?? 0) + 1,
          my_points: ctx.profile.points
        },
        summary: "get_leaderboard"
      };
    }

    case "get_points_history": {
      const { data } = await admin
        .from("points_log")
        .select("delta, reason, created_at")
        .eq("profile_id", ctx.userId)
        .order("created_at", { ascending: false })
        .limit(15);
      const reasonHe: Record<string, string> = {
        upload: "העלאת אפליקציה שאושרה",
        download: "הורדה של אפליקציה שלך",
        referral: "הזמנת חבר",
        referral_join: "בונוס הצטרפות",
        referral_revoked: "ביטול תגמול הפניה",
        suggestion: "הצעת אפליקציה שאושרה",
        app_suggestion_approved: "הצעת אפליקציה שאושרה",
        community_request_fulfilled: "מילוי בקשת קהילה"
      };
      return {
        result: {
          total: ctx.profile.points,
          recent: (data ?? []).map((r: any) => ({ change: r.delta, reason: reasonHe[r.reason] ?? r.reason, at: r.created_at }))
        },
        summary: `get_points_history → ${(data ?? []).length}`
      };
    }

    case "check_duplicate": {
      const term = String(args.app_name || "").trim();
      if (!term) return { result: { error: "חסר שם" }, summary: "check_duplicate → no name" };
      const { data } = await admin
        .from("apps")
        .select("id, name, status")
        .ilike("name", `%${term.replace(/[%,()]/g, " ")}%`)
        .limit(8);
      return {
        result: {
          query: term,
          matches: (data ?? []).map((d: any) => ({ id: d.id, name: d.name, status: d.status })),
          exists: (data ?? []).some((d: any) => d.status === "approved")
        },
        summary: `check_duplicate → ${(data ?? []).length}`
      };
    }

    case "list_community_requests": {
      const { data } = await admin
        .from("community_requests")
        .select("id, title, source_link, category, status")
        .in("status", ["open", "claimed"])
        .order("created_at", { ascending: false })
        .limit(15);
      return { result: { requests: data ?? [] }, summary: `list_community_requests → ${(data ?? []).length}` };
    }

    case "get_site_stats": {
      const [{ count: apps }, { count: users }] = await Promise.all([
        admin.from("apps").select("id", { count: "exact", head: true }).eq("status", "approved"),
        admin.from("profiles").select("id", { count: "exact", head: true })
      ]);
      const { data: dl } = await admin.from("apps").select("downloads_count").eq("status", "approved");
      const downloads = (dl ?? []).reduce((s: number, a: any) => s + (a.downloads_count ?? 0), 0);
      return { result: { approved_apps: apps ?? 0, users: users ?? 0, total_downloads: downloads }, summary: "get_site_stats" };
    }

    case "get_my_apps_status": {
      if (!ctx.isDeveloper) return { result: { error: "רק למפתחים" }, summary: "get_my_apps_status → denied" };
      const { data } = await admin
        .from("apps")
        .select("id, name, status, version, review_note, admin_note, downloads_count")
        .eq("developer_id", ctx.userId)
        .order("created_at", { ascending: false });
      return { result: { apps: data ?? [] }, summary: `get_my_apps_status → ${(data ?? []).length}` };
    }

    case "offer_download": {
      const { data: a } = await admin
        .from("apps")
        .select("id, name, status, download_paused, download_paused_until, icon_key, category, downloads_count, file_name, file_key")
        .eq("id", String(args.app_id))
        .single();
      if (!a || a.status !== "approved") return { result: { error: "האפליקציה לא נמצאה או לא זמינה להורדה" }, summary: "offer_download → not found" };
      const paused = a.download_paused || (a.download_paused_until && new Date(a.download_paused_until).getTime() > Date.now());
      if (paused) return { result: { error: "ההורדה של האפליקציה הזו מושהית כרגע ע\"י המפתח" }, summary: "offer_download → paused" };
      const [withRating] = await attachRatings(admin, [a]);
      return {
        result: { id: a.id, name: a.name, ready: true },
        appCards: await toCards([withRating]),
        clientAction: { kind: "download", appId: a.id, label: `הורדת ${a.name}`, auto: args.auto === true },
        summary: `offer_download → ${a.name}${args.auto ? " (auto)" : ""}`
      };
    }

    case "go_to_page": {
      const path = String(args.path || "").trim();
      if (!ALLOWED_NAV.includes(path)) {
        return { result: { error: `נתיב לא מותר. מותרים: ${ALLOWED_NAV.join(", ")}` }, summary: `go_to_page → blocked ${path}` };
      }
      const labels: Record<string, string> = {
        "/": "מעבר לחנות",
        "/community": "מעבר לבקשות הקהילה",
        "/support": "מעבר לתמיכה",
        "/suggest-app": "מעבר להוספת אפליקציה למאגר",
        "/profile": "מעבר לפרופיל שלי",
        "/profile/become-developer": "מעבר להרשמה כמפתח",
        "/dashboard/developer/upload": "מעבר להעלאת אפליקציה",
        "/users": "מעבר לרשימת המשתמשים",
        "/about": "מעבר להסברים",
        "/site-rules": "מעבר לחוקי האתר"
      };
      return {
        result: { navigating_to: path },
        clientAction: { kind: "navigate", url: path, label: labels[path] || "מעבר לדף", auto: args.auto === true },
        summary: `go_to_page → ${path}`
      };
    }

    case "start_upload": {
      if (!ctx.isDeveloper) {
        return {
          result: { error: "המשתמש עדיין לא מפתח - צריך קודם לשדרג לחשבון מפתח" },
          clientAction: { kind: "navigate", url: "/profile/become-developer", label: "הרשמה כמפתח", auto: false },
          summary: "start_upload → not developer"
        };
      }
      const params = new URLSearchParams();
      if (args.name) params.set("name", String(args.name).slice(0, 120));
      if (args.short_description) params.set("short", String(args.short_description).slice(0, 140));
      if (args.description) params.set("desc", String(args.description).slice(0, 4000));
      if (args.category) params.set("cat", String(args.category).slice(0, 60));
      if (args.min_android) params.set("minandroid", String(args.min_android).slice(0, 20));
      if (["offline", "online", "unknown"].includes(args.offline_support)) params.set("offline", args.offline_support);
      const url = `/dashboard/developer/upload${params.toString() ? `?${params.toString()}` : ""}`;
      return {
        result: { prefilled: true, url },
        clientAction: { kind: "navigate", url, label: "המשך להעלאת האפליקציה", auto: args.auto === true },
        summary: "start_upload"
      };
    }

    case "propose_support_ticket": {
      const subject = String(args.subject || "").trim().slice(0, 120) || "פנייה מהעוזר החכם";
      const body = String(args.body || "").trim().slice(0, 2000);
      return {
        result: { proposed: true, subject, body },
        proposedAction: { kind: "support_ticket", payload: { subject, body }, summary: `פתיחת פנייה לצוות: "${subject}"` },
        summary: "propose_support_ticket"
      };
    }

    case "propose_app_suggestion": {
      const appName = String(args.app_name || "").trim().slice(0, 120);
      if (!appName) return { result: { error: "חסר שם אפליקציה" }, summary: "propose_app_suggestion → no name" };
      const payload = {
        app_name: appName,
        app_link: String(args.app_link || "").trim().slice(0, 400) || null,
        note: String(args.note || "").trim().slice(0, 1000) || null
      };
      return {
        result: { proposed: true, ...payload },
        proposedAction: { kind: "app_suggestion", payload, summary: `הגשת הצעת אפליקציה: "${appName}"` },
        summary: "propose_app_suggestion"
      };
    }

    default:
      return { result: { error: `כלי לא מוכר: ${name}` }, summary: `unknown tool ${name}` };
  }
}
