import { NextResponse } from "next/server";
import { getCategoriesServer } from "@/lib/categories";

// באג #7 (תיקון): נתיב GET זה נשמר במטמון סטטי כברירת מחדל ב-Next.js, ולכן קטגוריות
// חדשות שהמנהל יצר לא הופיעו ברשימת הבחירה בטופסי ההעלאה/ההצעה עד פריסה מחדש. שתי
// השורות האלה מכריחות רינדור דינמי בכל בקשה - כך שהרשימה תמיד מעודכנת מיד.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// רשימת קטגוריות - ציבורי, לכל המשתמשים (טופס העלאה, סינון בחנות וכו')
export async function GET() {
  const categories = await getCategoriesServer();
  return NextResponse.json({ categories });
}
