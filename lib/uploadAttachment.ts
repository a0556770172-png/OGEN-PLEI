// העלאת קובץ מצורף מהדפדפן (פניות / ועדה): מבקשים מהשרת קישור העלאה חתום (initUrl), ואז
// מעלים את הקובץ ישירות ל-R2. מחזיר את פרטי הקובץ לשליחה יחד עם ההודעה, או זורק שגיאה בעברית.
export type UploadedAttachment = { attachmentKey: string; attachmentName: string; attachmentType: string };

export const MAX_ATTACHMENT_MB = 50;

export async function uploadAttachment(initUrl: string, file: File): Promise<UploadedAttachment> {
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
    throw new Error(`גודל הקובץ חורג מהמותר (מקסימום ${MAX_ATTACHMENT_MB}MB)`);
  }
  const initRes = await fetch(initUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, fileSize: file.size, contentType: file.type })
  });
  const initJson = await initRes.json().catch(() => ({}));
  if (!initRes.ok) throw new Error(initJson.error || "שגיאה בהעלאת הקובץ");

  const putRes = await fetch(initJson.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": initJson.attachmentType }
  }).catch(() => null);
  if (!putRes?.ok) throw new Error("שגיאה בהעלאת הקובץ - נסו שוב");

  return { attachmentKey: initJson.attachmentKey, attachmentName: initJson.attachmentName, attachmentType: initJson.attachmentType };
}
