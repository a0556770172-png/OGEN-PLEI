import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isStaff } from "@/lib/auth-helpers";
import {
  getPendingReviewCount,
  getPendingProRequestsCount,
  getPendingSuggestionsCount,
  getTicketsNeedingReplyCount,
  getPendingDeletionRequestsCount,
  getOpenAutoApprovedCouncilCount,
  getPendingAppReportsCount
} from "@/lib/admin-data";

export const dynamic = "force-dynamic";

// endpoint ייעודי לתוסף הכרום ולאפליקציית האנדרואיד של צוות פיקוח/ניהול - לא לשימוש
// מהאתר עצמו (שם ההתראות כבר מחושבות ישירות ב-Server Component). ההתחברות כאן היא
// לא באמצעות cookies (כמו שאר האתר) אלא באמצעות Authorization: Bearer <access_token>
// של Supabase - כי התוסף/האפליקציה הם לקוחות חיצוניים נפרדים עם מסך התחברות משלהם,
// לא דפדפן שכבר מחובר לאתר.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "נדרש טוקן התחברות" }, { status: 401 });
  }

  // מאמתים את הטוקן מול Supabase (בלי צורך ב-cookies) - זה בודק שהטוקן תקף ומחזיר את
  // המשתמש ששייך אליו, בלי לסמוך על שום דבר שמגיע מהלקוח מלבד הטוקן עצמו.
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data: userData, error: userError } = await anon.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "טוקן לא תקף - יש להתחבר מחדש" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", userData.user.id).single();
  if (!profile) return NextResponse.json({ error: "פרופיל לא נמצא" }, { status: 404 });
  if (profile.banned) return NextResponse.json({ error: "החשבון חסום" }, { status: 403 });
  if (!isStaff(profile)) {
    return NextResponse.json({ error: "רק צוות פיקוח או ניהול יכולים להתחבר כאן" }, { status: 403 });
  }

  const [review, pro, suggestions, tickets, deletionRequests, council, reports] = await Promise.all([
    getPendingReviewCount(),
    profile.role === "admin" ? getPendingProRequestsCount() : Promise.resolve(0),
    getPendingSuggestionsCount(),
    getTicketsNeedingReplyCount(),
    profile.role === "admin" ? getPendingDeletionRequestsCount() : Promise.resolve(0),
    getOpenAutoApprovedCouncilCount(),
    getPendingAppReportsCount()
  ]);

  const items = { review, pro, suggestions, tickets, deletionRequests, council, reports };
  const total = review + pro + suggestions + tickets + deletionRequests + council + reports;

  return NextResponse.json({
    total,
    items,
    profile: { username: profile.username, role: profile.role, is_moderator: profile.is_moderator }
  });
}
