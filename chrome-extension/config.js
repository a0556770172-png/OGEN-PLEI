// הגדרות משותפות לחלונות התוסף (popup / options / alert). ה-service worker (background.js)
// מחזיק עותק זהה משלו - ראו ההסבר בראש background.js.
// התוסף מדבר רק עם כתובת האתר (ולא ישירות עם Supabase) - ראו app/api/staff/token באתר.
const DEFAULT_SITE_URL = "https://ogenplay.com";

// כתובות ישנות שכבר לא עובדות (האתר עבר מ-Vercel לדומיין העצמאי) - מי שהגדיר אותן בעבר
// בעמוד האפשרויות מועבר אוטומטית לכתובת הנוכחית.
function normalizeSiteUrl(url) {
  const value = (url || "").trim().replace(/\/$/, "");
  if (!value || /vercel\.app/i.test(value)) return DEFAULT_SITE_URL;
  return value;
}

const ITEM_LABELS = {
  review: "אפליקציות ממתינות לבדיקה",
  pro: "בקשות PRO ממתינות",
  suggestions: "הצעות אפליקציות ממתינות",
  tickets: "הודעות ממתינות למענה",
  deletionRequests: "בקשות מחיקת משתמשים",
  council: "ועדות שנפתחו אוטומטית",
  reports: "דיווחים על אפליקציות",
  banAppeals: "ערעורי חסימה ממתינים",
  communityReview: "בקשות קהילה לאישור ביצוע"
};
