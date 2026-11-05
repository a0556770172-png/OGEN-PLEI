import Link from "next/link";
import type { ReactNode } from "react";

type Mention = { id: string; username: string };

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// הופך "@שם משתמש" (רק למשתמשים שהוזכרו בפועל בהודעה) לקישור לפרופיל שלהם.
function withMentions(text: string, mentions: Mention[]): ReactNode {
  if (!mentions.length) return text;
  const sorted = [...mentions].sort((a, b) => b.username.length - a.username.length);
  const re = new RegExp("@(" + sorted.map((m) => escapeRegExp(m.username)).join("|") + ")", "g");
  const byName = new Map(sorted.map((m) => [m.username, m.id]));
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const id = byName.get(match[1]);
    out.push(
      id ? (
        <Link
          key={`${match.index}-${id}`}
          href={`/users/${id}`}
          prefetch={false}
          onClick={(e) => e.stopPropagation()}
          className="font-bold text-primary-light hover:underline"
        >
          @{match[1]}
        </Link>
      ) : (
        match[0]
      )
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// גוף הודעה בפורום: ציטוט (שורות שמתחילות ב-">") כבלוק מעוצב, והזכרות (@שם) כקישורים לפרופיל.
// בלי dangerouslySetInnerHTML - רק טקסט ורכיבי React, כך שאי אפשר להזריק תוכן.
export default function ForumBody({
  text,
  className = "",
  mentions = []
}: {
  text: string;
  className?: string;
  mentions?: Mention[];
}) {
  const blocks: { quote: boolean; lines: string[] }[] = [];
  for (const line of text.split("\n")) {
    const isQuote = line.startsWith(">");
    const content = isQuote ? line.replace(/^>\s?/, "") : line;
    const last = blocks[blocks.length - 1];
    if (last && last.quote === isQuote) last.lines.push(content);
    else blocks.push({ quote: isQuote, lines: [content] });
  }
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        const t = b.lines.join("\n").replace(/^\n+|\n+$/g, "");
        if (!t) return null;
        return b.quote ? (
          <blockquote key={i} className="my-1.5 whitespace-pre-wrap border-r-2 border-primary/60 bg-surface2/60 px-3 py-1.5 text-xs text-gray-400">
            {t}
          </blockquote>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            {withMentions(t, mentions)}
          </p>
        );
      })}
    </div>
  );
}
