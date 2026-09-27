"use client";
import { useEffect, useState } from "react";
import { Download, FileArchive, FileText, Loader2 } from "lucide-react";

// מציג קובץ מצורף בהודעה (פניות / ועדה). תמונה/וידאו/קול מוטמעים ישירות, וכל קובץ - כולל
// אותם - מקבל גם כפתור "הורדה" שמוריד אותו בשמו המקורי (הקישור החתום כולל
// Content-Disposition: attachment, ראו createDownloadUrl ב-lib/r2.ts).
// שולף קישור חתום זמני מה-API בטעינה (לא שומרים קישורים חתומים בבסיס הנתונים).
export default function TicketAttachment({ attachmentKey, attachmentName, attachmentType }: {
  attachmentKey: string;
  attachmentName: string | null;
  attachmentType: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/tickets/attachment-url?key=${encodeURIComponent(attachmentKey)}`)
      .then((r) => r.json())
      .then((j) => { if (active) setUrl(j.url ?? null); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attachmentKey]);

  if (loading) return <div className="mt-2 flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> טוען קובץ מצורף...</div>;
  if (!url) return <div className="mt-2 text-xs text-red-400">לא ניתן לטעון את הקובץ המצורף</div>;

  const name = attachmentName ?? "קובץ מצורף";
  const downloadLink = (
    <a
      href={url}
      download={name}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary-light transition hover:bg-primary/25"
    >
      <Download className="h-3.5 w-3.5" /> הורדה
    </a>
  );

  if (attachmentType?.startsWith("image/")) {
    return (
      <div className="mt-2 flex flex-col items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="max-h-64 rounded-xl object-contain" />
        {downloadLink}
      </div>
    );
  }
  if (attachmentType?.startsWith("video/")) {
    return (
      <div className="mt-2 flex flex-col items-start">
        <video src={url} controls className="max-h-64 rounded-xl" />
        {downloadLink}
      </div>
    );
  }
  if (attachmentType?.startsWith("audio/")) {
    return (
      <div className="mt-2 flex flex-col items-start">
        <audio src={url} controls className="w-full" />
        {downloadLink}
      </div>
    );
  }

  const isArchive = /zip|rar|7z|tar|gzip|compressed/i.test(attachmentType ?? "") || /\.(zip|rar|7z|tar|gz)$/i.test(name);
  const Icon = isArchive ? FileArchive : FileText;
  return (
    <a
      href={url}
      download={name}
      className="mt-2 flex max-w-xs items-center gap-2.5 rounded-xl border border-border bg-surface/60 px-3 py-2.5 transition hover:border-primary/50"
    >
      <Icon className="h-8 w-8 shrink-0 text-primary-light" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-white" data-no-translate>{name}</span>
        <span className="flex items-center gap-1 text-[11px] text-primary-light"><Download className="h-3 w-3" /> לחצו להורדה</span>
      </span>
    </a>
  );
}
