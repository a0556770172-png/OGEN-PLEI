"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Send, Loader2 } from "lucide-react";

interface DmMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export default function DmThreadPage() {
  const params = useParams<{ id: string }>();
  const threadId = params.id;
  const [userId, setUserId] = useState<string | null>(null);
  const [otherUsername, setOtherUsername] = useState("");
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch(`/api/dm/threads/${threadId}/messages`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessages(json.messages ?? []);
      setOtherUsername(json.otherUsername ?? "");
    } else {
      setError(json.error || "שגיאה בטעינת השיחה");
    }
    setLoading(false);
    fetch(`/api/dm/threads/${threadId}/mark-read`, { method: "POST" }).catch(() => {});
  }

  useEffect(() => {
    fetch("/api/profile/heartbeat", { method: "POST" }).catch(() => {});
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    // מזהה את המשתמש הנוכחי מתוך supabase בצד לקוח, כדי לדעת אילו הודעות "שלי"
    import("@/lib/supabase/client").then(({ createClient }) => {
      createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    });
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/dm/threads/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error || "שגיאה בשליחה"); return; }
    setText("");
    await load();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">{loading ? "טוען..." : `שיחה עם ${otherUsername}`}</h1>

      <div className="card flex max-h-[500px] flex-col gap-3 overflow-y-auto p-6">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
              m.sender_id === userId ? "self-end bg-primary/20 text-white" : "self-start bg-surface2 text-gray-200"
            }`}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <form onSubmit={send} className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="input-field flex-1 resize-none"
          placeholder="הקלידו הודעה..."
        />
        <button type="submit" disabled={busy || !text.trim()} className="btn-primary shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
