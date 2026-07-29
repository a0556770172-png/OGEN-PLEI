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
      "/api/apps/extract-icon": ["./node_modules/app-info-parser/**/*"]
    },
    serverComponentsExternalPackages: ["app-info-parser"]
  }
};
export default nextConfig;
