"use client";
import { useEffect, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

// מציג קובץ מצורף בהודעת פנייה - תמונה/וידאו/קול מוטמעים ישירות, כל השאר כקישור להורדה.
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
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attachmentKey]);

  if (loading) return <div className="mt-2 flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> טוען קובץ מצורף...</div>;
  if (!url) return <div className="mt-2 text-xs text-red-400">לא ניתן לטעון את הקובץ המצורף</div>;

  if (attachmentType?.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={attachmentName ?? "תמונה מצורפת"} className="mt-2 max-h-64 rounded-xl object-contain" />;
  }
  if (attachmentType?.startsWith("video/")) {
    return <video src={url} controls className="mt-2 max-h-64 rounded-xl" />;
  }
  if (attachmentType?.startsWith("audio/")) {
    return <audio src={url} controls className="mt-2 w-full" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary-light hover:underline">
      <FileDown className="h-3.5 w-3.5" /> {attachmentName ?? "הורדת קובץ"}
    </a>
  );
}
