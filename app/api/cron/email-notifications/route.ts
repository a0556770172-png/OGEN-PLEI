import { NextResponse } from "next/server";
import { runEmailDigestBatch } from "@/lib/emailNotifications";

export const dynamic = "force-dynamic";

// נקרא ע"י cron בשרת (ראו crontab - סקריפט שמריץ curl עם הכותרת הזו כל כמה דקות) כדי
// לשלוח דייג'סט מייל להתראות ממתינות, בתוך המכסה/חלון השעות שהוגדרו בניהול.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }

  const result = await runEmailDigestBatch();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
