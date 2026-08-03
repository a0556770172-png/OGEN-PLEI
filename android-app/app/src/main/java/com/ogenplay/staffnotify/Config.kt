package com.ogenplay.staffnotify

// הגדרות קבועות - בטוחות לחשיפה בצד לקוח (מפתח "publishable" בלבד, לא סודי).
// כתובת האתר עצמה ניתנת לעריכה במסך ההתחברות (נשמרת ב-SharedPreferences) - כי היא עשויה
// להשתנות (דומיין מותאם אישית וכו') בלי צורך לבנות מחדש את האפליקציה.
object Config {
    const val SUPABASE_URL = "https://ipflzyjbhfqktnjjjsyg.supabase.co"
    const val SUPABASE_ANON_KEY = "sb_publishable_wH5MS_iGTl9c7HlN-y7GTg_5v49mZcW"
    const val DEFAULT_SITE_URL = "https://ogen-play.vercel.app"

    // מרווח הסריקה בפועל - 30 שניות, כמו שביקשת. בניגוד לתוסף הכרום, כאן זה אפשרי במלואו כי
    // מדובר בשירות חזית (Foreground Service) עם התראה קבועה - זו הדרך התקנית של אנדרואיד
    // להריץ קוד ברקע בלי הגבלת זמן, אבל המחיר הוא שההתראה הקבועה חייבת להישאר גלויה כל עוד
    // הניטור פעיל (זו דרישה של המערכת, לא בחירה שלנו).
    const val POLL_INTERVAL_MS = 30_000L
}
