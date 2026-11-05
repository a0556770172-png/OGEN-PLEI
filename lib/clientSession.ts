"use client";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

// מצב המשתמש המחובר בצד הלקוח, משותף לכל הקומפוננטות בעמוד (תפריט, שערי חוקים, עוזר חכם,
// באנר אימות מייל...). קודם כל אחת מהן שאלה בעצמה את שרת האימות ואת טבלת הפרופילים בכל ניווט
// - עשרות בקשות מיותרות לכל כניסה לעמוד. עכשיו: בקשה אחת משותפת, שנשמרת דקה.
// לא מאמתים מול השרת (getSession מקומי) - זה רק למצב התצוגה; כל פעולה אמיתית נבדקת בשרת.
export type MeUser = { id: string; email?: string | null; email_confirmed_at?: string | null };
export type Me = { user: MeUser | null; profile: Profile | null };

const TTL_MS = 60_000;
let cached: (Me & { at: number }) | null = null;
let inflight: Promise<Me> | null = null;
const listeners = new Set<() => void>();
let authHooked = false;

function notify() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // מאזין שנכשל לא מפיל את האחרים
    }
  });
}

function hookAuth() {
  if (authHooked || typeof window === "undefined") return;
  authHooked = true;
  createClient().auth.onAuthStateChange((event, session) => {
    const id = session?.user?.id ?? null;
    // התחברות מחדש של אותו משתמש (למשל בחזרה ללשונית) לא מצדיקה שליפה מחדש
    if (event === "SIGNED_OUT" || event === "USER_UPDATED" || id !== (cached?.user?.id ?? null)) {
      cached = null;
      notify();
    }
  });
}

export function getMe(force = false): Promise<Me> {
  hookAuth();
  if (!force && cached && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = (async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const u = session?.user ?? null;
    let profile: Profile | null = null;
    if (u) {
      const { data } = await supabase.from("profiles").select("*").eq("id", u.id).single();
      profile = (data as Profile) ?? null;
    }
    const me: Me = { user: u ? { id: u.id, email: u.email, email_confirmed_at: u.email_confirmed_at } : null, profile };
    cached = { ...me, at: Date.now() };
    return me;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

// קוראים לזה אחרי שינוי בפרופיל (תמונה, שם...) כדי שכל הרכיבים ישלפו מחדש.
export function refreshMe() {
  cached = null;
  inflight = null;
  notify();
}

export function onMeChange(cb: () => void): () => void {
  hookAuth();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// GET JSON עם מטמון קצר ושיתוף בקשות מקבילות - לנתיבי API שכמה קומפוננטות קוראות להם באותו עמוד
// (סטטוס הבוט, התראות...). תשובה שנכשלה לא נשמרת.
const jsonCache = new Map<string, { at: number; p: Promise<any> }>();

export function cachedJson<T = any>(url: string, ttlMs = 30_000): Promise<T | null> {
  const hit = jsonCache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.p;
  const p: Promise<T | null> = fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((v) => {
      if (v === null) jsonCache.delete(url);
      return v;
    });
  jsonCache.set(url, { at: Date.now(), p });
  return p;
}

export function invalidateJson(prefix: string) {
  for (const k of jsonCache.keys()) if (k.startsWith(prefix)) jsonCache.delete(k);
}
