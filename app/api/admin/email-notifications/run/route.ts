import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { runEmailDigestBatch } from "@/lib/emailNotifications";

export const dynamic = "force-dynamic";

// כפתור "שלח עכשיו" בניהול - מריץ ידנית את אותה לוגיקה שה-cron מריץ אוטומטית.
export async function POST() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") {
    return NextResponse.json({ error: "רק מנהל יכול לבצע פעולה זו" }, { status: 403 });
  }

  const run = await runEmailDigestBatch();
  return NextResponse.json(run, { status: run.ok ? 200 : 500 });
}
