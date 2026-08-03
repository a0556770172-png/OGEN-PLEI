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
export const revalidate = 0;
export const fetchCache = "force-no-store";

// עוזר קטן - כל תשובה מה-endpoint הזה חייבת לצאת עם no-store מפורש, כי זהו endpoint
// שנסרק שוב ושוב (כל דקה מהתוסף/האפליקציה) ואסור בשום מקרה שדפדפן/CDN יגיש תשובה ישנה
// מהמטמון במקום לפנות בפועל לשרת - בדיוק זה גרם לבאג "המספרים לא מתעדכנים".
function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
  });
}

// endpoint ייעודי לתוסף הכרום ולאפליקציית האנדרואיד של צוות פיקוח/ניהול - לא לשימוש
// מהאתר עצמו (שם ההתראות כבר מחושבות ישירות ב-Server Component). ההתחברות כאן היא
// לא באמצעות cookies (כמו שאר האתר) אלא באמצעות Authorization: Bearer <access_token>
// של Supabase - כי התוסף/האפליקציה הם לקוחות חיצוניים נפרדים עם מסך התחברות משלהם,
// לא דפדפן שכבר מחובר לאתר.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) {
    return json({ error: "נדרש טוקן התחברות" }, 401);
  }

  // מאמתים את הטוקן מול Supabase (בלי צורך ב-cookies) - זה בודק שהטוקן תקף ומחזיר את
  // המשתמש ששייך אליו, בלי לסמוך על שום דבר שמגיע מהלקוח מלבד הטוקן עצמו.
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data: userData, error: userError } = await anon.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ error: "טוקן לא תקף - יש להתחבר מחדש" }, 401);
  }

  const admin = createAdminSupabase();
  const { data: profile, error: profileError } = await admin.from("profiles").select("*").eq("id", userData.user.id).single();
  if (!profile) {
    return json(
      { error: "פרופיל לא נמצא", debugUserId: userData.user.id, debugUserEmail: userData.user.email, debugDbError: profileError?.message ?? null },
      404
    );
  }
  if (profile.banned) return json({ error: "החשבון חסום" }, 403);
  if (!isStaff(profile)) {
    return json(
      {
        error: "רק צוות פיקוח או ניהול יכולים להתחבר כאן",
        debugUserId: userData.user.id,
        debugProfileId: profile.id,
        debugRole: profile.role,
        debugIsModerator: profile.is_moderator,
        debugUsername: profile.username
      },
      403
    );
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

  return json({
    total,
    items,
    profile: { username: profile.username, role: profile.role, is_moderator: profile.is_moderator },
    fetchedAt: Date.now()
  });
}
