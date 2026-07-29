"use client";

// עוזר משותף להעלאת קובץ ישירות ל-Cloudflare R2 דרך Presigned URL.
// משמש גם בהעלאת אפליקציה חדשה וגם בהעלאת גרסה חדשה לאפליקציה קיימת.
export async function putToR2(url: string, file: File) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" }
    });
  } catch {
    // דפדפן שחוסם בקשת PUT ישירה ל-R2 (בד"כ עקב חוסר הגדרת CORS על הדלי) זורק שגיאת "Failed to fetch"
    throw new Error(
      "ההעלאה לשרת האחסון נכשלה (Failed to fetch) — לרוב זה קורה כי לדלי ה-R2 חסרה מדיניות CORS. יש להגדיר CORS Policy בדלי ב-Cloudflare (ראו README, סעיף פתרון תקלות) ולנסות שוב."
    );
  }
  if (!res.ok) {
    throw new Error(`העלאת הקובץ נכשלה (קוד ${res.status}). בדקו שהדלי וההרשאות ב-R2 מוגדרים נכון.`);
  }
}

// טקסט הסבר קריא-אדם לקוד הסיבה שמחזיר /api/apps/extract-icon כשלא הצליח לחלץ אייקון.
export function extractIconFailureReason(reason?: string): string | null {
  switch (reason) {
    case "no-icon-found":
      return "לא נמצא אייקון בקובץ (ייתכן שמדובר באייקון אדפטיבי מודרני שהמערכת עדיין לא תומכת בו).";
    case "unsupported-icon-format":
      return "פורמט האייקון שנמצא בקובץ אינו נתמך.";
    case "icon-upload-failed":
      return "האייקון חולץ אך העלאתו לאחסון נכשלה.";
    case "parse-error":
      return "לא הצלחנו לפענח את קובץ ה-APK.";
    case "not-apk":
      return null;
    default:
      return reason ? "חילוץ האייקון נכשל מסיבה לא ידועה." : null;
  }
}
