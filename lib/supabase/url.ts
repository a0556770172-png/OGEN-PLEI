// כתובת Supabase לקריאות שרת-לשרת. בשרת הייצור ה-Supabase רץ על אותה מכונה, ולכן אפשר לפנות אליו ישירות
// (למשל http://127.0.0.1:8000) במקום דרך הכתובת הציבורית (https://api.ogenplay.com), שמוסיפה לכל שאילתה
// TLS + nginx + יציאה לאינטרנט וחזרה (נמדד: כ-50ms במקום פחות ממילי-שנייה לכל קריאה).
// מגדירים SUPABASE_INTERNAL_URL ב-.env.local בשרת; בלי המשתנה - נופלים חזרה לכתובת הציבורית כמו קודם.
// הדפדפן לא משתמש בזה (הוא עובר דרך /api/sb), והכתובת הציבורית נשארת ל-NEXT_PUBLIC בלבד.
export function serverSupabaseUrl(): string {
  return (process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!;
}
