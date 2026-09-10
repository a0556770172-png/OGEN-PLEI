// כתובת האתר בפרודקשן - להגדיר NEXT_PUBLIC_SITE_URL ב-Vercel (Settings -> Environment Variables)
// לכתובת האמיתית. משמש כשצריך קישור *מוחלט* שאפשר להעתיק/לשתף מחוץ לאתר (למשל קישור הפניה
// שהבוט נותן למשתמש). לניווט פנימי באתר עצמו משתמשים בנתיב יחסי.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ogen-plei-qype.vercel.app").replace(/\/+$/, "");

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}
