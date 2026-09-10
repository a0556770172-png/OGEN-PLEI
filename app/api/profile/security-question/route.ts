import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { hashAnswer } from "@/lib/securityAnswer";

// שאלת אבטחה לאיפוס סיסמה - הגדרה/שינוי/מחיקה (רק כשמחוברים).
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const q = (result.profile as any).security_question ?? null;
  return NextResponse.json({ hasQuestion: !!q && !!(result.profile as any).security_answer_hash, question: q });
}

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { question, answer } = await request.json().catch(() => ({}));
  const q = typeof question === "string" ? question.trim().slice(0, 200) : "";
  const a = typeof answer === "string" ? answer.trim() : "";
  if (q.length < 5) return NextResponse.json({ error: "השאלה קצרה מדי" }, { status: 400 });
  if (a.length < 2) return NextResponse.json({ error: "התשובה קצרה מדי" }, { status: 400 });
  if (a.length > 200) return NextResponse.json({ error: "התשובה ארוכה מדי" }, { status: 400 });

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("profiles")
    .update({ security_question: q, security_answer_hash: hashAnswer(a) })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const admin = createAdminSupabase();
  await admin
    .from("profiles")
    .update({ security_question: null, security_answer_hash: null })
    .eq("id", result.user.id);
  return NextResponse.json({ ok: true });
}
