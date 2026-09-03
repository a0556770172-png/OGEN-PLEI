"use client";
import { useCallback, useEffect, useState } from "react";
import { Bot, Plus, Trash2, MessageSquare, Loader2 } from "lucide-react";
import BotChat from "./BotChat";

interface Conv {
  id: string;
  title: string;
  updated_at: string;
}

export default function AssistantClient() {
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/bot/conversations");
      const json = await res.json();
      setConversations(json.conversations ?? []);
    } catch {
      // מתעלמים - הצ'אט עדיין עובד גם בלי רשימת ההיסטוריה
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  function handleConversationChange(id: string) {
    setActiveId(id);
    loadList();
  }

  async function deleteConv(id: string) {
    if (!confirm("למחוק את השיחה הזו?")) return;
    await fetch(`/api/bot/conversations/${id}`, { method: "DELETE" });
    if (activeId === id) setActiveId(null);
    loadList();
  }

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <aside className="flex flex-col gap-2">
        <button onClick={() => setActiveId(null)} className="btn-primary w-full justify-center text-sm">
          <Plus className="h-4 w-4" /> שיחה חדשה
        </button>
        <div className="card flex max-h-[60vh] flex-col gap-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-3 text-center text-xs text-gray-500">אין שיחות קודמות</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm transition ${
                  activeId === c.id ? "bg-primary/15 text-white" : "text-gray-400 hover:bg-surface2"
                }`}
              >
                <button onClick={() => setActiveId(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-right">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{c.title}</span>
                </button>
                <button
                  onClick={() => deleteConv(c.id)}
                  className="shrink-0 rounded p-1 text-gray-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  title="מחיקה"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[#fff]">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <p className="font-black text-white">עוזר עוגן פליי</p>
            <p className="text-xs text-gray-500">כאן לעזור עם האתר ולמצוא לכם אפליקציות</p>
          </div>
        </div>
        <BotChat variant="page" conversationId={activeId} onConversationChange={handleConversationChange} />
      </div>
    </div>
  );
}
