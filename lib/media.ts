// כללי סרטון הסבר לאפליקציה (משותף ללקוח ולשרת - בלי תלות בשרת).
export const MAX_VIDEO_MB = 40;
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export function isAllowedVideoType(type: unknown): boolean {
  return typeof type === "string" && VIDEO_TYPES.includes(type.toLowerCase());
}

// בדיקת בקשת העלאת סרטון: מחזיר הודעת שגיאה, או null אם תקין.
export function validateVideoRequest(v: any): string | null {
  if (!v || typeof v.fileName !== "string" || !v.fileName.trim()) return "חסרים פרטי הסרטון";
  if (!isAllowedVideoType(v.contentType)) return "סוג הסרטון לא נתמך - יש להעלות MP4 או WEBM";
  const size = Number(v.fileSize);
  if (!Number.isFinite(size) || size <= 0) return "חסרים פרטי הסרטון";
  if (size > MAX_VIDEO_BYTES) return `הסרטון גדול מדי (מקסימום ${MAX_VIDEO_MB}MB)`;
  return null;
}

// מפתח סרטון תקין של מעלה מסוים (videos/<userId>/...)
export function isValidVideoKey(key: unknown, ownerId: string): key is string {
  return typeof key === "string" && key.startsWith(`videos/${ownerId}/`) && !key.includes("..");
}
