import type { ReactNode } from "react";

// הופך כתובות (http/https/www) בתוך טקסט חופשי לקישורים לחיצים - בלי dangerouslySetInnerHTML:
// הטקסט נשאר טקסט רגיל (React מבצע escape), ורק הקטעים שזוהו ככתובת נעטפים ב-<a>.
// רק פרוטוקול http/https מותר (לא javascript: וכד'), ופותחים בלשונית חדשה עם noopener+nofollow.

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'‏‎]+/gi;
// סימני פיסוק שנצמדים לסוף כתובת בכתיבה רגילה ("ראו https://x.com/a.") ואינם חלק ממנה
const TRAILING = /[.,!?;:)\]}"'׳״]+$/;

function toSafeHref(raw: string): string | null {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export default function LinkifiedText({ text, linkClassName }: { text: string; linkClassName?: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let url = m[0];
    const trail = url.match(TRAILING)?.[0] ?? "";
    if (trail) url = url.slice(0, -trail.length);
    const href = url ? toSafeHref(url) : null;
    if (!href) continue;
    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        dir="ltr"
        className={linkClassName ?? "break-all underline decoration-1 underline-offset-2 [unicode-bidi:isolate]"}
      >
        {url}
      </a>
    );
    last = start + url.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}
