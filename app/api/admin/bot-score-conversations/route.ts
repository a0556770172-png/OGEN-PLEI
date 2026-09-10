import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { scorePendingConversations } from "@/lib/botInterest";

// מדרג (ב-AI) שיחות בוט שעדיין לא דורגו - צוות בלבד. נקרא אוטומטית בכניסה לטאב הבוט,
// וגם ידנית ("דרג שיחות"). limit קטן כדי לא לשרוף מכסת Gemini.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const { limit } = await request.json().catch(() => ({}));
  const n = Math.min(30, Math.max(1, Number(limit) || 12));

  try {
    const scored = await scorePendingConversations(n);
    return NextResponse.json({ ok: true, scored });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e).slice(0, 200) }, { status: 500 });
  }
}
