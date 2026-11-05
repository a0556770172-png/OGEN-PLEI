// גוף הודעה בפורום, עם תמיכה בציטוט: שורות שמתחילות ב-">" מוצגות כבלוק ציטוט (כמו בפורומים רגילים).
// בלי dangerouslySetInnerHTML - רק טקסט, כך שאי אפשר להזריק תוכן.
export default function ForumBody({ text, className = "" }: { text: string; className?: string }) {
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
            {t}
          </p>
        );
      })}
    </div>
  );
}
