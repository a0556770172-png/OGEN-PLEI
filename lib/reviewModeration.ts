import { geminiOneShot } from "./bot";

export interface ModerationVerdict {
  flag: boolean;
  reason: string;
}

const SYSTEM = `אתה מסנן תוכן לביקורות משתמשים על אתר "עוגן פליי" (חנות אפליקציות חרדית).
תפקידך: לזהות ביקורות שאסור לפרסם.

סמן (flag=true) רק אם הביקורת:
- ספאם / פרסומת / קישורים / קידום מוצר
- ניבול פה, קללות, השמצות, התקפה אישית על אדם
- תוכן לא צנוע / לא הולם לקהל חרדי (קנה מידה: נטפרי)
- שפה פוגענית, גזענית, או דברי שנאה
- לגמרי לא קשור לאתר (טקסט אקראי, ג'יבריש, בדיחה חסרת הקשר)
- ניסיון טרולינג ברור / התחזות / הודעה שנועדה רק להזיק

אל תסמן ביקורת שהיא רק ביקורת שלילית כנה. משתמש שכותב "האתר איטי" או "חסרות אפליקציות" או "לא אהבתי את X" - זו ביקורת לגיטימית, השאר אותה (flag=false).

החזר JSON בלבד בפורמט: {"flag": true/false, "reason": "משפט קצר בעברית"}`;

// בודק ביקורת מול Gemini. fail-open: אם הסינון לא זמין / נכשל - מאשרים לפרסום.
export async function moderateReviewText(rating: number, comment: string): Promise<ModerationVerdict> {
  const text = comment.trim();
  if (!text) return { flag: false, reason: "" };

  try {
    const out = await geminiOneShot(SYSTEM, `דירוג: ${rating}/5\nטקסט הביקורת:\n"""${text.slice(0, 1500)}"""`);
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return { flag: false, reason: "" };
    const parsed = JSON.parse(m[0]);
    return { flag: !!parsed.flag, reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "" };
  } catch {
    return { flag: false, reason: "" };
  }
}
