// יעד חזרה בטוח אחרי התחברות: רק נתיב פנימי באתר (מתחיל ב-"/"), אף פעם לא כתובת חיצונית.
// בלי זה, קישור כמו /login?redirect=https://אתר-זדוני היה מעביר את המשתמש אליו אחרי שהתחבר.
export function safeRedirect(value: string | null | undefined, fallback = "/"): string {
  if (!value || value.length > 500) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
