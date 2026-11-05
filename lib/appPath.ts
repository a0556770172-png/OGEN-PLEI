// עוזרי כתובת לעמוד אפליקציה - טהורים (בלי תלות בשרת), בטוחים לשימוש גם בקומפוננטות לקוח.
// יצירה ושמירה של slug בפועל: lib/appSlug.ts.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// שם חבילה של אנדרואיד: לפחות שני חלקים מופרדים בנקודה (com.example.app)
const PACKAGE_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function cleanPackageName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length <= 150 && PACKAGE_RE.test(v) ? v : null;
}

// ניקוי טקסט לקטע בכתובת: אותיות (גם עברית), מספרים, נקודה ומקף. רווחים -> מקף.
export function slugPart(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}.\-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60);
}

// הכתובת הציבורית של האפליקציה. אם עדיין אין slug (אפליקציה ישנה) - ה-id; העמוד מפנה משם
// אוטומטית לכתובת הקריאה ברגע שנוצר slug.
export function appPath(app: { id: string; slug?: string | null }): string {
  if (!app.slug) return `/apps/${app.id}`;
  return `/apps/${app.slug.split("/").map(encodeURIComponent).join("/")}`;
}
