import { rm, mkdtemp } from "fs/promises";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { tmpdir } from "os";
import path from "path";
// @ts-ignore - אין טיפוסי TypeScript רשמיים לחבילה הזו
import AppInfoParser from "app-info-parser";
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

// לוגיקת חילוץ האייקון המשותפת - מנותקת מבדיקת הרשאות/בעלות על הקובץ, כדי שאפשר יהיה
// להשתמש בה גם מתוך זרימות שאינן "מפתח מעלה APK משלו" (למשל: אישור הצעת אפליקציה ע"י
// צוות, או חילוץ למפרע לאפליקציות ישנות) - הבדיקות האלה קורות בכל נתיב API בנפרד.
export async function extractApkIcon(fileKey: string, ownerId: string): Promise<ExtractIconResult> {
  if (!fileKey.toLowerCase().endsWith(".apk")) {
    return { iconKey: null, reason: "not-apk" };
  }

  let tempDir: string | null = null;
  let stage = "init";
  try {
    stage = "download";
    const downloadUrl = await createDownloadUrl(BUCKETS.apps, fileKey);
    tempDir = await mkdtemp(path.join(tmpdir(), "ogenplay-apk-"));
    const apkPath = path.join(tempDir, "app.apk");
    await downloadToTempFile(downloadUrl, apkPath);

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
