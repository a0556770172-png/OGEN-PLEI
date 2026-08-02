import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { getDeveloperContributionCount, isDmUnlocked, DM_UNLOCK_THRESHOLD } from "@/lib/dm-eligibility";

export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const [count, unlocked] = await Promise.all([getDeveloperContributionCount(user.id), isDmUnlocked(user.id)]);
  return NextResponse.json({ count, threshold: DM_UNLOCK_THRESHOLD, unlocked });
}
