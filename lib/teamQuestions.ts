// שאלון הקבלה לצוות הפיקוח - מקור אחד לטופס, לאימות בשרת ולתצוגה בפאנל הניהול.
export type TeamQuestionType = "text" | "textarea" | "number" | "select";

export interface TeamQuestion {
  id: string;
  section: string;
  label: string;
  hint?: string;
  type: TeamQuestionType;
  required?: boolean;
  options?: string[];
  min?: number; // מינימום תווים (textarea/text) או ערך מינימלי (number)
  max?: number; // מקסימום תווים או ערך מקסימלי
  placeholder?: string;
}

export const TEAM_COOLDOWN_DAYS = 14;

export const TEAM_QUESTIONS: TeamQuestion[] = [
  // ---- היכרות ----
  { id: "name", section: "היכרות", label: "איך קוראים לך?", type: "text", required: true, min: 2, max: 80 },
  {
    id: "mitmachim",
    section: "היכרות",
    label: "מה הפרופיל שלך במתמחים טופ?",
    hint: "קישור לפרופיל או שם המשתמש שלך שם",
    type: "text",
    required: true,
    min: 2,
    max: 200,
    placeholder: "https://mitmachim.top/user/..."
  },
  { id: "age", section: "היכרות", label: "בן כמה אתה?", type: "number", required: true, min: 13, max: 99 },
  {
    id: "contact",
    section: "היכרות",
    label: "דרך נוספת ליצור איתך קשר (לא חובה)",
    hint: "טלפון או מייל - רק אם נוח לך. אנחנו יכולים גם לפנות אליך דרך האתר",
    type: "text",
    max: 120
  },

  // ---- זמינות ומחויבות ----
  {
    id: "hoursPerDay",
    section: "זמינות ומחויבות",
    label: "כמה זמן ביום אתה מתכוון להשקיע באתר?",
    type: "select",
    required: true,
    options: ["עד שעה ביום", "בין שעה לשעתיים", "בין שעתיים לארבע שעות", "יותר מארבע שעות ביום"]
  },
  {
    id: "availableHours",
    section: "זמינות ומחויבות",
    label: "באילו שעות ביום אתה בדרך כלל זמין?",
    type: "text",
    required: true,
    min: 3,
    max: 150,
    placeholder: "למשל: בבקרים ובערבים, לא בשבת"
  },
  {
    id: "seriousness",
    section: "זמינות ומחויבות",
    label: "האם אתה מתכוון לקחת את זה ברצינות, או שזה יותר מסקרנות?",
    type: "select",
    required: true,
    options: ["ברצינות מלאה ובמחויבות", "ברצינות, אבל אני לא תמיד זמין", "יותר מסקרנות - אני רוצה לראות איך זה"]
  },
  {
    id: "alwaysActive",
    section: "זמינות ומחויבות",
    label: "אם תצטרף לצוות - האם תוכל להיות שותף פעיל תמיד, ולא רק בין הזמנים?",
    type: "select",
    required: true,
    options: ["כן, אהיה פעיל באופן קבוע", "בדרך כלל כן, עם הפסקות", "לא תמיד - אהיה זמין כשיתאפשר לי"]
  },
  {
    id: "alwaysActiveDetails",
    section: "זמינות ומחויבות",
    label: "איך תשלב את הפיקוח עם שאר החיים שלך (לימודים, עבודה, משפחה)?",
    type: "textarea",
    required: true,
    min: 15,
    max: 800
  },
  {
    id: "confidentiality",
    section: "זמינות ומחויבות",
    label: "הפיקוח הוא התנדבותי, ללא שכר, וכולל שמירה על סודיות והסכם צוות. האם זה מתאים לך?",
    type: "select",
    required: true,
    options: ["כן, מתאים לי", "יש לי שאלות לפני שאחליט"]
  },

  // ---- ידע וניסיון ----
  {
    id: "experience",
    section: "ידע וניסיון",
    label: "האם יש לך ניסיון בפיקוח או בניהול קהילה, פורום או קבוצה?",
    type: "select",
    required: true,
    options: ["אין לי ניסיון", "קצת ניסיון", "ניסיון רב"]
  },
  {
    id: "experienceDetails",
    section: "ידע וניסיון",
    label: "אם יש - פרט: איפה, כמה זמן, ובאיזה תפקיד",
    type: "textarea",
    max: 800
  },
  {
    id: "netfree",
    section: "ידע וניסיון",
    label: "האם אתה מכיר את חוקי נטפרי?",
    type: "select",
    required: true,
    options: ["כן, אני מכיר היטב", "אני מכיר חלקית", "לא מכיר"]
  },
  {
    id: "netfreeDetails",
    section: "ידע וניסיון",
    label: "לדעתך, מה החשוב ביותר לבדוק לפני שמאשרים אפליקציה או תוכנה בחנות שלנו?",
    type: "textarea",
    required: true,
    min: 20,
    max: 1000
  },

  // ---- מוטיבציה ----
  {
    id: "whyJoin",
    section: "מוטיבציה",
    label: "למה אתה רוצה להצטרף לצוות הפיקוח שלנו?",
    type: "textarea",
    required: true,
    min: 40,
    max: 1500
  },
  {
    id: "whyBest",
    section: "מוטיבציה",
    label: "למה אתה חושב שאתה הכי מתאים לתפקיד?",
    type: "textarea",
    required: true,
    min: 40,
    max: 1500
  },

  // ---- אופי ושיקול דעת ----
  {
    id: "scenarioFight",
    section: "אופי ושיקול דעת",
    label: "משתמש מקלל ומתגרה באחרים בפורום ובהודעות. מה תעשה?",
    type: "textarea",
    required: true,
    min: 20,
    max: 1000
  },
  {
    id: "scenarioFriend",
    section: "אופי ושיקול דעת",
    label: "חבר קרוב שלך העלה אפליקציה שלא עומדת בכללים, והוא מבקש ממך לאשר אותה. מה תעשה?",
    type: "textarea",
    required: true,
    min: 20,
    max: 1000
  },
  {
    id: "scenarioPopular",
    section: "אופי ושיקול דעת",
    label: "אפליקציה מאוד פופולרית, אבל היא כוללת תוכן לא צנוע. משתמשים כותבים לך \"כולם מורידים, למה לא מאשרים?\". איך תפעל?",
    type: "textarea",
    required: true,
    min: 20,
    max: 1000
  },
  {
    id: "scenarioMistake",
    section: "אופי ושיקול דעת",
    label: "הוצאת משתמש מהאתר, ואחר כך הבנת שטעית. מה תעשה?",
    type: "textarea",
    required: true,
    min: 20,
    max: 1000
  },
  {
    id: "criticism",
    section: "אופי ושיקול דעת",
    label: "איך אתה מגיב כשמבקרים אותך, או כשחולקים עליך בפומבי?",
    type: "textarea",
    required: true,
    min: 20,
    max: 800
  },
  {
    id: "teamwork",
    section: "אופי ושיקול דעת",
    label: "אתה לא מסכים עם החלטה של חבר צוות אחר. איך אתה מתנהג?",
    type: "textarea",
    required: true,
    min: 20,
    max: 800
  },
  {
    id: "strengths",
    section: "אופי ושיקול דעת",
    label: "מהן שלוש החוזקות העיקריות שלך, ומהן החולשות שלך?",
    type: "textarea",
    required: true,
    min: 20,
    max: 1000
  },
  {
    id: "extra",
    section: "אופי ושיקול דעת",
    label: "משהו נוסף שחשוב לך שנדע עליך? (לא חובה)",
    type: "textarea",
    max: 1000
  }
];

// אימות תשובות: מחזיר הודעת שגיאה, או את התשובות המנוקות
export function validateTeamAnswers(input: unknown): { error: string } | { answers: Record<string, string> } {
  if (!input || typeof input !== "object") return { error: "חסרות תשובות" };
  const raw = input as Record<string, unknown>;
  const answers: Record<string, string> = {};
  for (const q of TEAM_QUESTIONS) {
    const v = typeof raw[q.id] === "string" ? (raw[q.id] as string).trim() : typeof raw[q.id] === "number" ? String(raw[q.id]) : "";
    if (!v) {
      if (q.required) return { error: `חובה לענות: ${q.label}` };
      continue;
    }
    if (q.type === "select") {
      if (!q.options?.includes(v)) return { error: `תשובה לא תקינה: ${q.label}` };
    } else if (q.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < (q.min ?? 0) || n > (q.max ?? 999)) return { error: `ערך לא תקין: ${q.label}` };
    } else {
      if (q.min && v.length < q.min) return { error: `התשובה קצרה מדי: ${q.label}` };
      if (q.max && v.length > q.max) return { error: `התשובה ארוכה מדי: ${q.label}` };
    }
    answers[q.id] = v;
  }
  return { answers };
}
