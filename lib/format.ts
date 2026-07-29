// תצוגת גודל קובץ חכמה - קבצים קטנים (למשל הצעות אפליקציה שהן קובצי טקסט/תמונה קטנים)
// הוצגו עד עכשיו תמיד כ"0.0MB" כי ההמרה הייתה תמיד לפי מגה-בייט. עכשיו בוחרים את היחידה
// המתאימה לפי הגודל בפועל: בייטים / קילובייט / מגה-בייט.
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
