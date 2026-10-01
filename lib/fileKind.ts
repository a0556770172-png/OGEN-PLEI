// סידור אוטומטי לפי סוג הקובץ בהעלאה (אפליקציה חדשה / גרסה חדשה):
//   * APK (apk/apks/xapk) - לאפליקציות (אנדרואיד), בקטגוריה שהמשתמש בחר
//   * ZIP - לאן שהמשתמש בחר בטופס (אפליקציות או תוכנות)
//   * כל השאר (exe/msi/וכו') - אוטומטית לתוכנות
// הסיווג בתצוגה עצמה נעשה ב-isApk (components/AppGrid.tsx) לפי הסיומת, אלא אם נקבע
// platform_override - ולכן צריך לשמור override רק כשמשתמש בחר "אפליקציות" לקובץ ZIP.
export const APK_EXTENSIONS = [".apk", ".apks", ".xapk"];

export type FileKind = "apk" | "zip" | "software";

export function detectFileKind(fileName: string): FileKind {
  const lower = fileName.toLowerCase();
  if (APK_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "apk";
  if (lower.endsWith(".zip")) return "zip";
  return "software";
}

// הערך לשמירה ב-apps.platform_override (null = סיווג אוטומטי לפי הסיומת).
export function platformOverrideFor(fileName: string, zipTarget: "apk" | "software" | null | undefined): "apk" | null {
  return detectFileKind(fileName) === "zip" && zipTarget === "apk" ? "apk" : null;
}
