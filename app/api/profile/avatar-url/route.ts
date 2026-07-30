import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { getAvatarUrl } from "@/lib/avatar";

// מחזיר URL חתום זמני לתמונת הפרופיל של המשתמש המחובר (או null אם אין לו) -
// משמש קומפוננטות צד-לקוח כמו ה-Navbar שאין להן גישה ל-secrets של R2.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  const url = await getAvatarUrl(profile.avatar_key, profile.role);
  return NextResponse.json({ url });
}
