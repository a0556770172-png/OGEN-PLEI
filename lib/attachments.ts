// כללים משותפים לקבצים מצורפים בהודעות הפניות (/support ופאנל הצוות) ובוועדה.
// כל סוג קובץ מותר (תמונה, וידאו, קול, ZIP, PDF וכו'). הקבצים לא מוגשים מהדומיין של האתר
// אלא מ-R2 עם קישור חתום זמני ו-Content-Disposition: attachment (ראו createDownloadUrl
// ב-lib/r2.ts), כך שגם קובץ HTML/SVG שהועלה לא ירוץ בהקשר של האתר.
export const MAX_ATTACHMENT_MB = 50;
export const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;

export function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

// דפדפנים לא תמיד יודעים לזהות סוג (למשל ZIP בחלק מהמערכות מגיע כמחרוזת ריקה).
export function normalizeContentType(contentType: unknown): string {
  return typeof contentType === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(contentType) ? contentType : "application/octet-stream";
}

// בדיקת בקשת העלאה - מחזיר הודעת שגיאה, או null אם תקין.
export function validateAttachment(fileName: unknown, fileSize: unknown): string | null {
  if (typeof fileName !== "string" || !fileName.trim()) return "חסרים פרטי קובץ";
  const size = Number(fileSize);
  if (!Number.isFinite(size) || size <= 0) return "חסרים פרטי קובץ";
  if (size > MAX_ATTACHMENT_BYTES) return `גודל הקובץ חורג מהמותר (מקסימום ${MAX_ATTACHMENT_MB}MB)`;
  return null;
}
