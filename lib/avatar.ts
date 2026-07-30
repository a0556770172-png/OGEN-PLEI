import { createDownloadUrl, BUCKETS } from "@/lib/r2";

// לוגו ברירת המחדל של האתר (עוגן פליי) - משמש כתמונת הפרופיל של המנהל בפועל כל עוד
// הוא לא העלה תמונת פרופיל משלו ידנית.
const ADMIN_DEFAULT_LOGO = "/logo-512.png";

// תמונת פרופיל מאוחסנת ב-R2 (דלי assets, כמו אייקוני אפליקציות) ומוגשת דרך URL חתום זמני.
// role אופציונלי - עבור מנהל בפועל ללא תמונת פרופיל, מחזיר את לוגו האתר כברירת מחדל.
export async function getAvatarUrl(avatarKey: string | null | undefined, role?: string | null): Promise<string | null> {
  if (!avatarKey) return role === "admin" ? ADMIN_DEFAULT_LOGO : null;
  try {
    return await createDownloadUrl(BUCKETS.assets, avatarKey);
  } catch {
    return role === "admin" ? ADMIN_DEFAULT_LOGO : null;
  }
}
