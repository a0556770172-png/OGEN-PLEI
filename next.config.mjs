/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: {
    // כל תמונה באתר (אייקונים, תמונות פרופיל, צילומי מסך) מוגשת בנתיב יחסי דרך
    // app/api/cdn/[...path]/route.ts (ראו lib/r2.ts: publicAssetUrl) - אף <Image> בקוד
    // לא טוען URL חיצוני מוחלט. לכן אין צורך ב-remotePatterns בכלל, והשארתו פתוחה
    // לכל דומיין ("**") הייתה חור אבטחה: Next.js מריץ RCE/SSRF ידועים (CVE-ים שתוקנו
    // רק ב-15.x, לא ב-14.2.x) ב-API של אופטימיזציית תמונות עבור כל URL חיצוני שמותר לו
    // לגשת אליו. בלי רשימת דומיינים כאן, ה-Image Optimizer מסרב מראש לכל בקשה חיצונית.
    //
    // אייקונים/תמונות באתר לא משתנים (מפתח חדש לכל העלאה) - אין סיבה שהאופטימייזר של Next יבצע
    // אותה המרה מחדש כל דקה (ברירת המחדל), זו עבודת מעבד מיותרת.
    minimumCacheTTL: 2592000
  },
  // חילוץ אייקון מ-APK (app-info-parser) עושה require() מרובה לקבצים פנימיים בחבילה.
  // בלי ההגדרות האלה, ה-Output File Tracing של Vercel/Next עלול "לשכוח" חלק מהקבצים
  // האלה בפריסה לפרודקשן (עובד ב-dev מקומי, נכשל דווקא אחרי דיפלוי) - זו הסיבה השכיחה
  // ביותר לכך שחילוץ אייקון "פתאום מפסיק לעבוד" רק בסביבת הפרודקשן.
  experimental: {
    outputFileTracingIncludes: {
      "/api/apps/extract-icon": ["./node_modules/app-info-parser/**/*"],
      "/api/suggestions/[id]": ["./node_modules/app-info-parser/**/*"],
      "/api/admin/apps/backfill-icons": ["./node_modules/app-info-parser/**/*"]
    },
    serverComponentsExternalPackages: ["app-info-parser"]
  },
  // משתיק אזהרת webpack לא-קריטית: bytebuffer (תלות פנימית של app-info-parser) מנסה
  // לטעון תוסף native אופציונלי בשם memcpy (להאצת ביצועים בלבד) שלא קיים בסביבת הבנייה -
  // הספרייה כבר עוטפת את זה ב-try/catch משלה ונופלת חזרה למימוש JS רגיל, זה לא משפיע
  // בפועל על חילוץ האייקונים. משתיקים רק כדי לנקות את לוגי הבנייה מרעש לא רלוונטי.
  webpack: (config) => {
    config.ignoreWarnings = [...(config.ignoreWarnings || []), /Can't resolve 'memcpy'/];
    return config;
  },
  // מעבר דומיין רשמי ל-ogenplay.com: הפניית 301 מכל נתיב בדיפלוי הישן הזה (ogen-plei-qype.vercel.app)
  // לאותו נתיב בדיוק בדומיין החדש. נדרש כדי ש-Google Search Console יאשר את "שינוי כתובת".
  // מוגבל בכוונה לפי כותרת ה-Host של הבקשה: זה אותו next.config.mjs שרץ גם על שרת הפרודקשן
  // האמיתי (ogenplay.com) - בלי ההגבלה הזו, דיפלוי בטעות לשרת האמיתי היה גורם ללולאת הפניה
  // אינסופית של האתר החי לעצמו.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "ogen-plei-qype.vercel.app" }],
        destination: "https://ogenplay.com/:path*",
        permanent: true
      }
    ];
  }
};
export default nextConfig;
