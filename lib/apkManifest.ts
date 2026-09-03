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
  // מחוץ לטווח הרשימה - נצמדים לגבול העליון/תחתון הרלוונטי.
  return api <= 20 ? "אנדרואיד 4 ומעלה" : MIN_ANDROID_VERSIONS[MIN_ANDROID_VERSIONS.length - 1];
}

export interface ApkFormInfo {
  minSdkLabel?: string;
  versionName?: string;
  packageName?: string;
}

// מנתח קובץ APK בדפדפן ומחזיר מה שאפשר למלא בטופס אוטומטית.
// best-effort בלבד: כל כשל (לא APK, קובץ מפוצל, פרסר לא נטען) מחזיר {} בשקט.
export async function parseApkForForm(file: File): Promise<ApkFormInfo> {
  const lower = file.name.toLowerCase();
  // .apks / .xapk הם חבילות מפוצלות - הפרסר לא תמיד מסתדר איתן, ומדלגים.
  if (!lower.endsWith(".apk")) return {};

  try {
    const mod = await import("app-info-parser");
    const AppInfoParser: any = (mod as any).default ?? mod;
    const parser = new AppInfoParser(file);
    const res: any = await parser.parse();

    const minSdkRaw =
      res?.minSdkVersion ??
      res?.usesSdk?.minSdkVersion ??
      res?.manifest?.usesSdk?.minSdkVersion ??
      res?.manifest?.usesSdk?.["android:minSdkVersion"];
    const minSdk = Number(minSdkRaw);

    const versionName = res?.versionName ?? res?.manifest?.versionName;
    const packageName = res?.package ?? res?.manifest?.package;

    return {
      minSdkLabel: Number.isFinite(minSdk) && minSdk > 0 ? minSdkToLabel(minSdk) : undefined,
      versionName: typeof versionName === "string" && versionName.trim() ? versionName.trim() : undefined,
      packageName: typeof packageName === "string" && packageName.trim() ? packageName.trim() : undefined
    };
  } catch {
    return {};
  }
}
