import type { MetadataRoute } from "next";
import { getApprovedApps } from "@/lib/apps-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ogen-plei-qype.vercel.app";

// מפת אתר דינמית: כוללת את דפי הבסיס בנוסף לדף פרטי כל אפליקציה מאושרת בחנות, כדי שגוגל
// ימצא וידע לאנדקס גם את כל דפי האפליקציות (לא רק את דף הבית).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/users`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${SITE_URL}/signup/user`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/signup/developer`, changeFrequency: "yearly", priority: 0.3 }
  ];

  let appRoutes: MetadataRoute.Sitemap = [];
  try {
    const apps = await getApprovedApps();
    appRoutes = apps.map((app) => ({
      url: `${SITE_URL}/apps/${app.id}`,
      lastModified: app.updated_at ?? app.created_at ?? undefined,
      changeFrequency: "weekly",
      priority: 0.7
    }));
  } catch {
    // אם שליפת האפליקציות נכשלת מסיבה כלשהי בזמן בניית המפה - עדיף להחזיר לפחות את הדפים
    // הסטטיים במקום להפיל את כל ה-build
  }

  return [...staticRoutes, ...appRoutes];
}
