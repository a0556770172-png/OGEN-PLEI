import { createAdminSupabase } from "./supabase/admin";
import { geminiOneShot } from "./bot";

// דירוג "עניין/ערך" של שיחת בוט למנהל: 1-10. גבוה = צורך אמיתי, פער במוצר, באג,
// בלבול לגבי איך משהו עובד, משתמש לא מרוצה, בקשת פיצ'ר, שימוש מעניין. נמוך = שגרתי
// (חיפוש אפליקציה פשוט, "כמה מוניטין יש לי", ברכה).
const SYSTEM = `אתה מנתח שיחות של צ'אט-בוט תמיכה באתר "עוגן פליי" (חנות אפליקציות) עבור מנהל האתר.
דרג מ-1 עד 10 כמה השיחה מעניינת ושווה עיון עבור המנהל:
- 8-10: חושף באג, פער במוצר, בלבול אמיתי לגבי איך משהו עובד, משתמש מתוסכל/כועס, בקשת פיצ'ר, רעיון, או שימוש/צורך מעניין שכדאי שהמנהל יידע עליו.
- 4-7: שאלה לגיטימית אך שגרתית, או משוב קל.
- 1-3: טריוויאלי (חיפוש אפליקציה פשוט, "כמה מוניטין יש לי", "מה חדש", ברכה, שיחת סרק).
החזר JSON בלבד: {"score": <מספר 1-10>, "note": "<משפט אחד קצר בעברית למה>"}`;

interface Verdict {
  score: number;
  note: string;
}

function parseVerdict(raw: string): Verdict | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    const score = Math.round(Number(o.score));
    if (!Number.isFinite(score) || score < 1 || score > 10) return null;
    return { score, note: String(o.note ?? "").slice(0, 240) };
  } catch {
    return null;
  }
}

// מדרג שיחה אחת. fail-open: בכל בעיה לא משנה כלום.
export async function scoreConversationInterest(conversationId: string): Promise<Verdict | null> {
  const admin = createAdminSupabase();
  const { data: msgs } = await admin
    .from("bot_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(40);

  const rows = msgs ?? [];
  const userCount = rows.filter((r) => r.role === "user").length;
  if (userCount < 2) return null; // שיחה קצרה מדי - לא מדרגים

  const transcript = rows
    .map((r) => `${r.role === "user" ? "משתמש" : "בוט"}: ${String(r.content).slice(0, 500)}`)
    .join("\n")
    .slice(0, 6000);

  let verdict: Verdict | null = null;
  try {
    const raw = await geminiOneShot(SYSTEM, transcript);
    verdict = parseVerdict(raw);
  } catch {
    return null;
  }
  if (!verdict) return null;

  try {
    await admin
      .from("bot_conversations")
      .update({ interest_score: verdict.score, interest_note: verdict.note, interest_scored_msgs: userCount })
      .eq("id", conversationId);
  } catch {
    // מיגרציה 0050 עוד לא רצה
  }
  return verdict;
}

// מדרג שיחות שעדיין לא דורגו / שהתרחבו משמעותית מאז הדירוג. מוגבל כדי לא לשרוף מכסה.
export async function scorePendingConversations(limit = 12): Promise<number> {
  const admin = createAdminSupabase();

  // מזהי שיחות עם לפחות 2 הודעות משתמש
  const { data: convs } = await admin
    .from("bot_conversations")
    .select("id, interest_score, interest_scored_msgs, updated_at")
    .order("updated_at", { ascending: false })
    .limit(300);

  const candidates: string[] = [];
  for (const c of convs ?? []) {
    const { count } = await admin
      .from("bot_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", c.id)
      .eq("role", "user");
    const userMsgs = count ?? 0;
    if (userMsgs < 2) continue;
    const scoredAt = (c as any).interest_scored_msgs ?? null;
    if (scoredAt == null || userMsgs - scoredAt >= 3) candidates.push(c.id);
    if (candidates.length >= limit) break;
  }

  let done = 0;
  for (const id of candidates) {
    const v = await scoreConversationInterest(id);
    if (v) done++;
  }
  return done;
}
