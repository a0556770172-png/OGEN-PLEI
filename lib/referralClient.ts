// עזרי צד-לקוח למערכת ההפניות (Referral). ראו lib/referral.ts לצד השרת.

const REF_COOKIE = "ogen_ref";
const REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 יום

// שם משתמש תקין באתר (עברית/אנגלית/ספרות ותווי הפרדה בסיסיים). הקוד בקישור ההפניה הוא
// שם המשתמש של המפנה, ושמות משתמש כאן יכולים להיות בעברית.
const REF_CODE_RE = /^[\p{L}\p{N}._\- ]{2,40}$/u;

// שומר קוד הפניה (שם המשתמש של המפנה) בעוגייה, כדי שישרוד ניווט עד לדף ההרשמה.
export function persistRefCode(raw: string | null | undefined): void {
  if (typeof document === "undefined" || !raw) return;
  const code = raw.trim();
  if (!REF_CODE_RE.test(code)) return;
  try {
    document.cookie = `${REF_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${REF_MAX_AGE}; samesite=lax`;
  } catch {
    // עוגיות חסומות - פשוט לא נשמור, ההרשמה עדיין תעבוד (רק בלי הפניה)
  }
}

// קורא את קוד ההפניה שנשמר (אם קיים) - נקרא בדפי ההרשמה כדי לצרף ל-signUp.
export function readRefCode(): string | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    const m = document.cookie.match(/(?:^|;\s*)ogen_ref=([^;]+)/);
    if (!m) return undefined;
    const code = decodeURIComponent(m[1]).trim();
    return REF_CODE_RE.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}
