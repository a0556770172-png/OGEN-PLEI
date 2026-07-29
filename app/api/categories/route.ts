import { NextResponse } from "next/server";
import { getCategoriesServer } from "@/lib/categories";

// רשימת קטגוריות - ציבורי, לכל המשתמשים (טופס העלאה, סינון בחנות וכו')
export async function GET() {
  const categories = await getCategoriesServer();
  return NextResponse.json({ categories });
}
