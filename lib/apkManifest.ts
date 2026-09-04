import { MIN_ANDROID_VERSIONS } from "./androidVersions";

// ממפה רמת API של אנדרואיד לגרסת אנדרואיד "ראשית" (מספר שלם).
function apiLevelToAndroidMajor(api: number): number {
  if (api <= 20) return 4; // 4.x (עד KitKat)
  if (api <= 22) return 5; // Lollipop
  if (api === 23) return 6; // Marshmallow
  if (api <= 25) return 7; // Nougat
  if (api <= 27) return 8; // Oreo
  if (api === 28) return 9; // Pie
  if (api === 29) return 10;
  if (api === 30) return 11;
  if (api <= 32) return 12; // 12 / 12L
  if (api === 33) return 13;
  if (api === 34) return 14;
  return 15; // 35 ומעלה
}

// ממיר minSdkVersion (רמת API) לאחת מהאפשרויות ברשימה MIN_ANDROID_VERSIONS.
export function minSdkToLabel(api: number): string {
  const label = `אנדרואיד ${apiLevelToAndroidMajor(api)} ומעלה`;
  if (MIN_ANDROID_VERSIONS.includes(label)) return label;
  return api <= 20 ? "אנדרואיד 4 ומעלה" : MIN_ANDROID_VERSIONS[MIN_ANDROID_VERSIONS.length - 1];
}

export interface ApkFormInfo {
  minSdkLabel?: string;
  versionName?: string;
  packageName?: string;
}

// זיהוי אוטומטי של גרסת אנדרואיד/גרסה מתוך APK בדפדפן.
// מושבת כרגע: app-info-parser עושה require('fs') ולא ניתן לאגד אותו לדפדפן (שבר את הבנייה).
// הפונקציה נשארת כ-hook - הטפסים כבר מטפלים ב-{} (נופלים לבחירה ידנית).
// TODO: לממש דרך נתיב שרת שקורא רק את AndroidManifest.xml מה-APK ב-R2, או פרסר AXML קליל.
export async function parseApkForForm(_file: File): Promise<ApkFormInfo> {
  return {};
}
