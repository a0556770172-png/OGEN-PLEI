import type { AppRow } from "@/types/database";

// אפליקציות מובייל (APK/APKS) לעומת תוכנות מחשב (כל שאר סוגי הקבצים - EXE, MSI, ZIP וכו') -
// השיוך נקבע לפי סיומת הקובץ בפועל שהמפתח העלה, לא לפי הקטגוריה שנבחרה, כדי שהחלוקה
// תמיד תהיה מדויקת בלי תלות בבחירת קטגוריה שגויה. בודקים גם file_name וגם file_key (מפתח
// האחסון ב-R2) - כדי שקובץ יסווג נכון גם אם אחד מהשדות חסר/לא מעודכן מסיבה כלשהי.
// באג שתוקן: קבצי .apks (חבילת APK מפוצלת) לא זוהו כי הבדיקה חיפשה ".apk" בלבד -
// הם נפלו בטעות ל"תוכנות" והנפיחו את הספירה שם.
// (בקובץ נפרד כדי שגם קוד שרת יוכל להשתמש בו - AppGrid הוא קומפוננטת לקוח.)
const APK_EXTENSIONS = [".apk", ".apks", ".xapk"];

function endsWithAny(value: string | null | undefined, suffixes: string[]) {
  const v = value?.toLowerCase().trim();
  if (!v) return false;
  return suffixes.some((s) => v.endsWith(s));
}

export function isApk(app: Pick<AppRow, "platform_override" | "file_name" | "file_key">) {
  // שיוך ידני (צוות פיקוח/מנהל, ראו ReviewQueue.tsx) גובר תמיד על הסיווג האוטומטי.
  if (app.platform_override === "apk") return true;
  if (app.platform_override === "software") return false;
  return endsWithAny(app.file_name, APK_EXTENSIONS) || endsWithAny(app.file_key, APK_EXTENSIONS);
}
