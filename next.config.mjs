/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
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
  }
};
export default nextConfig;
