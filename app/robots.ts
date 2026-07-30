import type { MetadataRoute } from "next";

// כתובת האתר בפרודקשן - נלקחת ממשתנה הסביבה NEXT_PUBLIC_SITE_URL (יש להגדיר אותו ב-Vercel
// לכתובת הדומיין האמיתי, למשל https://ogen-plei-qype.vercel.app, אחרת המפה תצביע בטעות ל-localhost).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ogen-plei-qype.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/profile/"]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
