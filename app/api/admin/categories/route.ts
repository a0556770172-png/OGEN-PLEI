import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// ניהול קטגוריות - כל צוות (מנהל או פיקוח) יכול לנהל קטגוריות
function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿]+/g, "-")
    .replace(/(^-+)|(-+$)/g, "")
    .slice(0, 40);
}

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "רק צוות יכול לנהל קטגוריות" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "יש להזין שם קטגוריה" }, { status: 400 });

  const rawValue = typeof body.value === "string" && body.value.trim() ? body.value : label;
  const value = slugify(rawValue) || crypto.randomUUID().slice(0, 8);

  const admin = createAdminSupabase();
  const { count } = await admin.from("categories").select("id", { count: "exact", head: true });
  const { data, error } = await admin
    .from("categories")
    .insert({ value, label, sort_order: count ?? 0 })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message.includes("duplicate") ? "כבר קיימת קטגוריה עם מזהה כזה" : error.message }, { status: 400 });
  }

  return NextResponse.json({ category: data });
}
