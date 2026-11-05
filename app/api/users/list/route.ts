import { NextResponse } from "next/server";
import { getPublicUsersPage } from "@/lib/users-data";
import { memo } from "@/lib/memo";

export const dynamic = "force-dynamic";

// עמוד אחד מרשימת המשתמשים (חיפוש, סינון "מחוברים", דפדוף) - ראו components/UsersDirectoryList.tsx.
// התשובה משותפת בין גולשים למשך כמה שניות.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "60", 10) || 60));
  const q = (sp.get("q") ?? "").trim().slice(0, 40);
  const onlineOnly = sp.get("online") === "1";

  const data = await memo(`users-list:${offset}:${limit}:${q.toLowerCase()}:${onlineOnly}`, 8_000, () =>
    getPublicUsersPage({ offset, limit, q, onlineOnly })
  );
  return NextResponse.json(data);
}
