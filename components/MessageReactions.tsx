"use client";
import { useState } from "react";
import { SmilePlus } from "lucide-react";
import { QUICK_REACTIONS } from "@/lib/chatFormat";
import type { MessageReactions } from "@/types/database";

// שורת תגובות אימוג'י מתחת להודעה - פילים לתגובות קיימות (עם ספירה, מודגשות אם אני הגבתי),
// וכפתור "+" שפותח בורר אימוג'י מהיר להוספת תגובה.
export default function MessageReactionsBar({
  reactions,
  currentUserId,
  onToggle
}: {
  reactions: MessageReactions | null | undefined;
  currentUserId: string;
  onToggle: (emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const entries = Object.entries(reactions ?? {}).filter(([, users]) => users.length > 0);

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {entries.map(([emoji, users]) => {
        const mine = users.includes(currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
              mine ? "border-primary bg-primary/20 text-white" : "border-border bg-surface2/70 text-gray-300 hover:border-primary/40"
            }`}
          >
            <span>{emoji}</span>
            <span className="font-bold">{users.length}</span>
          </button>
        );
      })}

      <div className="relative">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-full border border-border bg-surface2/70 p-1 text-gray-400 hover:border-primary/40 hover:text-white"
          title="הוספת תגובה"
        >
          <SmilePlus className="h-3.5 w-3.5" />
        </button>
        {pickerOpen && (
          <div className="absolute bottom-full z-10 mb-1 flex gap-1 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onToggle(emoji);
                  setPickerOpen(false);
                }}
                className="rounded-lg p-1 text-base hover:bg-surface2"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
