import React from "react";

// כלים משותפים לכל הצ'אטים באתר (הודעות/תמיכה וגם ועדה): הדגשת כתב (**מודגש**),
// ציטוטים (שורות שמתחילות ב-"> "), בניית טקסט ציטוט, והעתקת הודעה+קישור ללוח.

// --- רינדור טקסט מעוצב: שורות "> ציטוט" כ-blockquote, **טקסט** כמודגש ---
function renderBoldSegments(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyPrefix}-b-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={`${keyPrefix}-t-${i}`}>{part}</React.Fragment>;
  });
}

export function FormattedMessageBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let quoteBuffer: string[] = [];

  function flushQuote(key: string) {
    if (quoteBuffer.length === 0) return;
    nodes.push(
      <blockquote key={key} className="mb-1.5 border-e-2 border-current/40 pe-2 text-[13px] opacity-70">
        {quoteBuffer.map((q, i) => (
          <p key={i} className="whitespace-pre-wrap">{renderBoldSegments(q, `${key}-${i}`)}</p>
        ))}
      </blockquote>
    );
    quoteBuffer = [];
  }

  lines.forEach((line, idx) => {
    if (line.startsWith("> ")) {
      quoteBuffer.push(line.slice(2));
    } else {
      flushQuote(`q${idx}`);
      if (line.trim().length > 0) {
        nodes.push(
          <p key={`l${idx}`} className="whitespace-pre-wrap">{renderBoldSegments(line, `l${idx}`)}</p>
        );
      }
    }
  });
  flushQuote("qEnd");

  return <>{nodes}</>;
}

// --- כלי עזר לתיבת הכתיבה: הדגשת כתב (עוטף/מסיר ** סביב הבחירה או המילה בסמן) ---
export function toggleBoldAtSelection(textarea: HTMLTextAreaElement, value: string): string {
  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;
  const selected = value.slice(start, end);

  if (selected) {
    const isBold = selected.startsWith("**") && selected.endsWith("**") && selected.length > 4;
    const next = isBold ? selected.slice(2, -2) : `**${selected}**`;
    return value.slice(0, start) + next + value.slice(end);
  }
  // אין בחירה - מכניס **מודגש** בנקודת הסמן, מוכן לעריכה
  return value.slice(0, start) + "**מודגש**" + value.slice(end);
}

// --- בניית טקסט ציטוט להכנסה לתיבת הכתיבה, בעת לחיצה על "ציטוט" ---
export function buildQuoteText(senderName: string, body: string): string {
  const quotedLines = body
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => `> ${senderName}: ${l}`)
    .join("\n");
  return `${quotedLines}\n\n`;
}

// --- העתקת תוכן הודעה + קישור ישיר אליה (עוגן בעמוד) ללוח ---
export async function copyMessageWithLink(messageId: string, body: string): Promise<boolean> {
  try {
    const url = `${window.location.origin}${window.location.pathname}#msg-${messageId}`;
    const text = body ? `${body}\n\n${url}` : url;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "😢"];
