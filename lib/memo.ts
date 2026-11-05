// מטמון קצר בזיכרון השרת לנתונים ציבוריים שנקראים בכל כניסה לעמוד (קטגוריות, הגדרות אתר,
// רשימת האפליקציות, ספירות...). במקום שכל גולש יפעיל שוב את אותן שאילתות, הן רצות פעם אחת
// בכל תקופת TTL ושאר הבקשות מקבלות את אותה תוצאה. בקשות מקבילות לאותו מפתח חולקות ריצה אחת.
// אין כאן מטמון של Next.js (הוא כבוי בכוונה - ראו lib/supabase/noStoreFetch.ts) אלא מטמון
// עצמאי עם זמני תפוגה קצרים, כך שהנתונים תמיד עדכניים תוך שניות בודדות.
type Entry = { v: unknown; exp: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 3000;

function sweep() {
  const now = Date.now();
  for (const [k, e] of store) if (e.exp <= now) store.delete(k);
  // אם עדיין גדול מדי (הרבה מפתחות פעילים) - מרוקנים הכול, זה רק מטמון
  if (store.size > MAX_ENTRIES) store.clear();
}

export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.v as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = fn()
    .then((v) => {
      if (store.size >= MAX_ENTRIES) sweep();
      store.set(key, { v, exp: Date.now() + ttlMs });
      return v;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

// מוחק את כל המפתחות שמתחילים בקידומת (למשל אחרי שמנהל שינה הגדרות) כדי שהשינוי ייראה מיד.
export function memoInvalidate(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
