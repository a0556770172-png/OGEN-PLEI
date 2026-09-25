import { cookies } from "next/headers";

// שם העוגייה/מפתח ה-localStorage שבהם נשמרת בחירת השפה של המשתמש (ראו components/LanguageToggle.tsx).
export const LANG_COOKIE = "ogen-lang";

// האם הבקשה הנוכחית הגיעה ממשתמש שבחר באתר באנגלית - לשימוש בצד השרת בלבד
// (למשל כדי שהבוט יענה באנגלית). כל ה-UI עצמו מתורגם בצד הלקוח ע"י lib/i18n/translator.ts.
export function isEnglishRequest(): boolean {
  try {
    return cookies().get(LANG_COOKIE)?.value === "en";
  } catch {
    return false;
  }
}

export const ENGLISH_REPLY_RULE =
  "\n---\n## Language\nThe user is browsing the site in English. Always reply in clear, natural English (not Hebrew), even if the question or the background information above is written in Hebrew. When you mention site pages or buttons, use their English names.";
