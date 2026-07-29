import { rm, mkdtemp } from "fs/promises";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { tmpdir } from "os";
import path from "path";
// @ts-ignore - אין טיפוסי TypeScript רשמיים לחבילה הזו
import AppInfoParser from "app-info-parser";
import AdmZip from "adm-zip";
import { createDownloadUrl, createUploadUrl, BUCKETS } from "@/lib/r2";

export type ExtractIconResult =
  | { iconKey: string; appName?: string; versionName?: string }
  | { iconKey: null; reason: string; detail?: string };

async function downloadToTempFile(url: string, destPath: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`הורדת הקובץ מהאחסון נכשלה (קוד ${res.status})`);
  }
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(destPath));
}

// כמה מהאפליקציות (בעיקר כאלה שאושרו מתוך "הצעות אפליקציה" שהורדו מ-APKPure) מגיעות
// כ-".apks" - זהו לא קובץ APK רגיל אלא ארכיון ZIP שמכיל בתוכו כמה קבצי APK (base.apk +
// splits לפי שפה/מסך/ארכיטקטורה). כדי לחלץ אייקון מקובץ כזה צריך קודם לפתוח את ה-ZIP
// ולמצוא בתוכו את ה-base.apk (או, אם אין קובץ בשם הזה, את קובץ ה-.apk הכי גדול - הוא כמעט
// תמיד ה-base שמכיל את המשאבים כולל האייקון, בעוד ה-splits הם קבצים קטנים לרוב).
function findBaseApkEntry(zip: AdmZip) {
  const apkEntries = zip.getEntries().filter((e) => !e.isDirectory && e.entryName.toLowerCase().endsWith(".apk"));
  if (apkEntries.length === 0) return null;
  const named = apkEntries.find((e) => e.entryName.toLowerCase().endsWith("base.apk"));
  if (named) return named;
  return apkEntries.reduce((biggest, e) => (e.header.size > biggest.header.size ? e : biggest), apkEntries[0]);
}

// לוגיקת חילוץ האייקון המשותפת - מנותקת מבדיקת הרשאות/בעלות על הקובץ, כדי שאפשר יהיה
// להשתמש בה גם מתוך זרימות שאינן "מפתח מעלה APK משלו" (למשל: אישור הצעת אפליקציה ע"י
// צוות, או חילוץ למפרע לאפליקציות ישנות) - הבדיקות האלה קורות בכל נתיב API בנפרד.
export async function extractApkIcon(fileKey: string, ownerId: string): Promise<ExtractIconResult> {
  const lowerKey = fileKey.toLowerCase();
  const isApks = lowerKey.endsWith(".apks");
  if (!lowerKey.endsWith(".apk") && !isApks) {
    return { iconKey: null, reason: "not-apk" };
  }

  let tempDir: string | null = null;
  let stage = "init";
  try {
    stage = "download";
    const downloadUrl = await createDownloadUrl(BUCKETS.apps, fileKey);
    tempDir = await mkdtemp(path.join(tmpdir(), "ogenplay-apk-"));
    const downloadedPath = path.join(tempDir, isApks ? "bundle.apks" : "app.apk");
    await downloadToTempFile(downloadUrl, downloadedPath);

    let apkPath = downloadedPath;
    if (isApks) {
      stage = "unzip-bundle";
      const zip = new AdmZip(downloadedPath);
      const baseEntry = findBaseApkEntry(zip);
      if (!baseEntry) {
        return { iconKey: null, reason: "no-apk-in-bundle" };
      }
      apkPath = path.join(tempDir, "base-extracted.apk");
      zip.extractEntryTo(baseEntry, tempDir, false, true, false, "base-extracted.apk");
    }

    stage = "parse";
    const parser = new AppInfoParser(apkPath);
    const parsed = await parser.parse();

    if (!parsed?.icon || typeof parsed.icon !== "string" || !parsed.icon.startsWith("data:")) {
      return { iconKey: null, reason: "no-icon-found" };
    }

    stage = "decode";
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(parsed.icon);
    if (!match) {
      return { iconKey: null, reason: "unsupported-icon-format" };
    }
    const [, mimeType, base64Data] = match;
    const iconBuffer = Buffer.from(base64Data, "base64");

    stage = "upload";
    const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "png";
    const iconKey = `icons/${ownerId}/${crypto.randomUUID()}-auto-extracted.${extension}`;
    const uploadUrl = await createUploadUrl(BUCKETS.assets, iconKey, mimeType);

    const putRes = await fetch(uploadUrl, { method: "PUT", body: iconBuffer, headers: { "Content-Type": mimeType } });
    if (!putRes.ok) {
      return { iconKey: null, reason: "icon-upload-failed", detail: `R2 PUT status ${putRes.status}` };
    }

    return { iconKey, appName: parsed.name, versionName: parsed.versionName };
  } catch (err: any) {
    return { iconKey: null, reason: "parse-error", detail: `[${stage}] ${String(err?.message || err)}` };
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
