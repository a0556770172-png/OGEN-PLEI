import { createDownloadUrl, BUCKETS } from "@/lib/r2";

// תמונת פרופיל מאוחסנת ב-R2 (דלי assets, כמו אייקוני אפליקציות) ומוגשת דרך URL חתום זמני.
export async function getAvatarUrl(avatarKey: string | null | undefined): Promise<string | null> {
  if (!avatarKey) return null;
  try {
    return await createDownloadUrl(BUCKETS.assets, avatarKey);
  } catch {
    return null;
  }
}
