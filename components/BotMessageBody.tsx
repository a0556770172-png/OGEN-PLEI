"use client";
import React from "react";
import Link from "next/link";

// רינדור תשובת הבוט: פסקאות, **מודגש**, ורשימות פשוטות, וגם קישורי מרקדאון [טקסט](כתובת).
// קישור פנימי (/apps/... וכו') מרונדר כ-Link; קישור חיצוני (https) כ-<a> בטאב חדש.
// בלי dangerouslySetInnerHTML - בונים React nodes בלבד.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // מפצל לפי קישורי מרקדאון תחילה, ואז מטפל ב-**מודגש** בתוך כל קטע רגיל.
  const linkRe = /\[([^\]]+)\]\((\/[^\s)]+|https?:\/\/[^\s)]+)\)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = linkRe.exec(text)) !== null) {
    if (m.index > last) nodes.push(...renderBold(text.slice(last, m.index), `${keyPrefix}-t${i}`));
    const label = m[1];
    const href = m[2];
    if (href.startsWith("/")) {
      nodes.push(
        <Link key={`${keyPrefix}-lk${i}`} href={href} className="font-bold text-primary-light hover:underline">
          {label}
        </Link>
      );
    } else {
      nodes.push(
        <a
          key={`${keyPrefix}-lk${i}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="font-bold text-primary-light hover:underline"
        >
          {label}
        </a>
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(...renderBold(text.slice(last), `${keyPrefix}-t${i}`));
  return nodes;
}

function renderBold(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push(<strong key={`${keyPrefix}-b${idx}`}>{part.slice(2, -2)}</strong>);
      return;
    }
    // הפיכת כתובות URL "חשופות" (לא בתוך מרקדאון) לקישורים לחיצים - למשל קישור הפניה.
    const urlRe = /(https?:\/\/[^\s<>()]+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let j = 0;
    while ((m = urlRe.exec(part)) !== null) {
      if (m.index > last) out.push(<React.Fragment key={`${keyPrefix}-p${idx}-${j}a`}>{part.slice(last, m.index)}</React.Fragment>);
      const clean = m[1].replace(/[.,;:!?]+$/, "");
      out.push(
        <a
          key={`${keyPrefix}-u${idx}-${j}`}
          href={clean}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="break-all font-bold text-primary-light hover:underline"
        >
          {clean}
        </a>
      );
      last = m.index + clean.length;
      j++;
    }
    if (last < part.length) out.push(<React.Fragment key={`${keyPrefix}-p${idx}-${j}b`}>{part.slice(last)}</React.Fragment>);
  });
  return out;
}

export default function BotMessageBody({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const bullet = /^[-*•]\s+/.test(trimmed);
        return (
          <p key={idx} className={`whitespace-pre-wrap leading-relaxed ${bullet ? "ps-3" : ""}`}>
            {bullet ? "• " : ""}
            {renderInline(bullet ? trimmed.replace(/^[-*•]\s+/, "") : line, `l${idx}`)}
          </p>
        );
      })}
    </div>
  );
}
