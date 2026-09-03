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
