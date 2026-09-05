// זיהוי ניסיונות להסיט את הבוט משיחה לגיטימית על עוגן פליי - jailbreak / חילוץ פרומפט /
// גרירה לנושאים לא קשורים בדרכי הונאה. תפיסה גסה בצד השרת; המודל עצמו מוסיף שכבה
// (מחזיר [[ABUSE_BLOCK]] אם הוא מזהה ניסיון מכוון). על flag: חסימה לשעה + התראה למנהל.

const PATTERNS: { re: RegExp; reason: string }[] = [
  // חילוץ / עקיפת הוראות המערכת
  { re: /ignore\s+(all\s+)?(previous|above|prior|the)\s+(instructions|prompts?|rules)/i, reason: "ניסיון לעקוף הוראות מערכת" },
  { re: /disregard\s+(your|all|the|previous)\s+(instructions|rules|guidelines)/i, reason: "ניסיון לעקוף הוראות מערכת" },
  { re: /(reveal|show|print|repeat|output|tell me)\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions|rules|guidelines)/i, reason: "ניסיון לחלץ את הוראות המערכת" },
  { re: /what\s+(are|were)\s+your\s+(exact\s+)?(instructions|system prompt|rules)/i, reason: "ניסיון לחלץ את הוראות המערכת" },
  { re: /repeat\s+(the\s+)?(words|text|everything)\s+above/i, reason: "ניסיון לחלץ את הוראות המערכת" },
  { re: /התעלם\s+(מ)?(כל\s+)?(ה)?(הוראות|הנחיות|כללים)\s*(הקודמ|שקיבלת|שלמעלה)/i, reason: "ניסיון לעקוף הוראות מערכת" },
  { re: /(תחשוף|תראה לי|תדפיס|תשחזר|תצטט|תחזור על|מה)\s*(את\s+)?(ה)?(הוראות|הנחיות|פרומפט|prompt|כללים)\s*(שלך|שקיבלת|שהוגדרו)/i, reason: "ניסיון לחלץ את הוראות המערכת" },
  { re: /מה\s+(נאמר|כתוב|הוגדר)\s+לך\s+(ב|לפני)/i, reason: "ניסיון לחלץ את הוראות המערכת" },
  { re: /תחזור\s+על\s+(כל\s+)?(מה\s+שכתוב|הטקסט|המילים)\s+(למעלה|קודם)/i, reason: "ניסיון לחלץ את הוראות המערכת" },
  // משחקי תפקידים / מצב מפתח
  { re: /\b(dan mode|do anything now|developer mode|jailbreak|jail break)\b/i, reason: "ניסיון jailbreak" },
  { re: /pretend\s+(you\s+are|to\s+be|that\s+you)/i, reason: "ניסיון משחק תפקידים לעקיפת מגבלות" },
  { re: /you\s+are\s+now\s+(a|an|no longer|not)\b/i, reason: "ניסיון להחליף את זהות הבוט" },
  { re: /act\s+as\s+(if\s+you\s+are\s+)?(a|an|my)\b.*(unrestricted|no rules|anything|hacker|expert)/i, reason: "ניסיון משחק תפקידים לעקיפת מגבלות" },
  { re: /(מעכשיו|מהרגע הזה)\s+אתה\s+(לא|כבר לא|תהיה)/i, reason: "ניסיון להחליף את זהות הבוט" },
  { re: /תשכח\s+(מ)?(כל\s+)?(מה\s+ש)?(אמרו|הגדירו|כתבו)\s+לך/i, reason: "ניסיון לעקוף הוראות מערכת" },
  { re: /(עשה|תעשה|בוא נשחק)\s+כאילו\s+(אתה|ש?אין לך)/i, reason: "ניסיון משחק תפקידים לעקיפת מגבלות" },
  { re: /אין\s+לך\s+(כללים|הגבלות|מגבלות)\s+(יותר|עכשיו|מעכשיו)/i, reason: "ניסיון לעקוף מגבלות" },
  { re: /בלי\s+(שום\s+)?(צנזורה|מגבלות|כללים|סינון)/i, reason: "ניסיון לעקוף מגבלות" },
];

export function detectBotManipulation(text: string): { flagged: boolean; reason: string } {
  const t = (text || "").slice(0, 4000);
  for (const p of PATTERNS) {
    if (p.re.test(t)) return { flagged: true, reason: p.reason };
  }
  return { flagged: false, reason: "" };
}

export const ABUSE_BLOCK_SENTINEL = "[[ABUSE_BLOCK]]";
export const BOT_BLOCK_MINUTES = 60;
