// fetch שלעולם לא נשמר ב-Data Cache של Next.js. שאילתות Supabase הן קריאות GET רגילות, ו-Next
// מנסה לשמור אותן במטמון - מה שגרם לנתונים ישנים (למשל מוניטין שונה ברשימת המשתמשים ובפרופיל).
export const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });
